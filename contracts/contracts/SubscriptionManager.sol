// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SubscriptionManager
 * @notice Recurring pull payments authorised once, bounded on-chain.
 *
 * @dev Non-custodial by construction. This contract never holds user funds:
 * `charge` performs `transferFrom(payer -> merchant)`, so tokens move directly
 * between the two parties and the contract's own balance is never credited.
 * What it holds is *permission*, bounded by terms fixed at creation:
 *
 *   - amountPerPeriod   — the exact amount each charge moves. Cannot be raised.
 *   - totalAuthorised   — the lifetime ceiling for THIS subscription.
 *   - periodSeconds     — the minimum gap between charges.
 *   - merchant          — the only address that can ever receive the funds.
 *   - endTime/maxPeriods — a hard end to the authorisation.
 *
 * Because every rule is enforced here, `charge` is permissionless: anyone may
 * submit it (typically a relayer paying gas). A submitter cannot overcharge,
 * charge early, redirect funds, or continue past cancellation.
 *
 * Three properties are worth calling out, because each addresses a way the
 * naive version of this contract went wrong:
 *
 * 1. Per-subscription budgets. An ERC-20 allowance is a single pool shared by
 *    every spender-approved transfer, so without accounting here a second
 *    subscription would quietly spend the first one's budget. Each subscription
 *    reserves `totalAuthorised` from the payer's allowance, and creation fails
 *    if the outstanding reservations would exceed it.
 *
 * 2. Cancellation cannot be front-run. When a notice period is set, a charge
 *    must be announced and then wait before it can execute. The payer therefore
 *    always has an uncontested window in which to cancel — otherwise a merchant
 *    watching the mempool could race a `cancel` with a `charge` and win.
 *
 * 3. Token allowlist. Fee-on-transfer and rebasing tokens deliver less than
 *    `amountPerPeriod` to the merchant while this contract reports the full
 *    figure, so only tokens the owner has vetted may be used.
 */
contract SubscriptionManager is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // Types
    // ============================================

    /// @dev Creation parameters, grouped so the two entry points stay within the
    /// EVM's stack limits and callers pass named fields rather than a long
    /// positional list.
    struct SubscriptionTerms {
        address merchant;
        address token;
        uint256 amountPerPeriod;
        uint256 totalAuthorised;
        uint64 periodSeconds;
        uint64 firstChargeAt;
        uint64 endTime;
        uint64 noticeSeconds;
        uint32 maxPeriods;
    }

    struct Subscription {
        address payer;
        address merchant;
        address token;
        uint256 amountPerPeriod;
        /// Remaining lifetime budget. Decremented by every charge.
        uint256 remainingAuthorised;
        uint64 periodSeconds;
        uint64 nextChargeAt;
        uint64 endTime; // 0 = no end date
        /// Delay between announcing a charge and executing it. 0 = no notice.
        uint64 noticeSeconds;
        /// When the pending charge was announced. 0 = none pending.
        uint64 announcedAt;
        uint32 periodsCharged;
        uint32 maxPeriods; // 0 = unlimited
        bool cancelled;
    }

    // ============================================
    // Events
    // ============================================

    event SubscriptionCreated(
        bytes32 indexed subscriptionId,
        address indexed payer,
        address indexed merchant,
        address token,
        uint256 amountPerPeriod,
        uint256 totalAuthorised,
        uint64 periodSeconds,
        uint64 firstChargeAt,
        uint64 endTime,
        uint64 noticeSeconds,
        uint32 maxPeriods
    );

    event ChargeAnnounced(
        bytes32 indexed subscriptionId,
        address indexed payer,
        uint64 executableAt
    );

    event SubscriptionCharged(
        bytes32 indexed subscriptionId,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        uint32 periodIndex,
        uint64 nextChargeAt,
        uint256 remainingAuthorised
    );

    event SubscriptionCancelled(
        bytes32 indexed subscriptionId,
        address indexed cancelledBy,
        uint256 releasedAuthorisation
    );

    /// @notice Emitted when a charge lands so late that intervening periods are
    /// skipped rather than accumulated. Those periods are never charged, so the
    /// forgiveness is recorded on-chain instead of happening silently.
    event PeriodsSkipped(bytes32 indexed subscriptionId, uint64 missedDue, uint64 rebasedTo);

    event TokenAllowed(address indexed token, bool allowed);

    // ============================================
    // Errors
    // ============================================

    error SubscriptionNotFound();
    error SubscriptionInactive();
    error ChargeNotDue(uint64 nextChargeAt);
    error SubscriptionExpired();
    error NotAuthorised();
    error InvalidTerms();
    error PermitFailed();
    error TokenNotAllowed();
    error AuthorisationExceedsAllowance(uint256 committed, uint256 allowance);
    error AuthorisationExhausted();
    error ChargeNotAnnounced();
    error NoticePeriodPending(uint64 executableAt);

    // ============================================
    // State
    // ============================================

    /// @dev Upper bound on a billing period. Well below the point where
    /// `nextChargeAt + periodSeconds` could overflow uint64, and far longer than
    /// any real subscription interval.
    uint64 public constant MAX_PERIOD_SECONDS = 365 days;

    /// @dev Upper bound on the notice period, so a subscription cannot be made
    /// permanently unchargeable by setting an absurd notice.
    uint64 public constant MAX_NOTICE_SECONDS = 30 days;

    mapping(bytes32 => Subscription) public subscriptions;

    /// @dev Per-payer counter so a payer can hold several subscriptions with the
    /// same merchant/token without their ids colliding.
    mapping(address => uint256) public subscriptionNonce;

    /// @dev Sum of `remainingAuthorised` across a payer's active subscriptions
    /// for a token. Keeps one subscription from spending another's budget.
    mapping(address => mapping(address => uint256)) public committedAuthorisation;

    /// @dev Tokens vetted by the owner. Excludes fee-on-transfer and rebasing
    /// tokens, whose actual delivered amount differs from `amountPerPeriod`.
    mapping(address => bool) public allowedTokens;

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ============================================
    // Token allowlist
    // ============================================

    /**
     * @notice Allow or disallow a token for new subscriptions.
     * @dev Disallowing a token does not affect existing subscriptions: their
     * terms are already fixed, and stopping their charges would hand the owner
     * a way to break agreements between two other parties.
     */
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert InvalidTerms();
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    // ============================================
    // Creation
    // ============================================

    /**
     * @notice Create a subscription. Callable only by the payer.
     *
     * @param terms Subscription parameters:
     *   - merchant: sole recipient of every charge
     *   - token: ERC-20 to charge; must be on the allowlist
     *   - amountPerPeriod: exact amount moved per charge
     *   - totalAuthorised: lifetime ceiling for this subscription
     *   - periodSeconds: minimum seconds between charges
     *   - firstChargeAt: timestamp of the first permitted charge (0 = now)
     *   - endTime: authorisation expiry (0 = no expiry)
     *   - noticeSeconds: delay between announcing and executing a charge
     *   - maxPeriods: maximum number of charges (0 = unlimited)
     */
    function createSubscription(SubscriptionTerms calldata terms)
        external
        nonReentrant
        whenNotPaused
        returns (bytes32 subscriptionId)
    {
        return _createSubscription(terms);
    }

    /// @dev Guarded by its public callers. Kept separate so
    /// `createSubscriptionWithPermit` can reuse it without tripping its own
    /// reentrancy guard.
    function _createSubscription(SubscriptionTerms calldata terms)
        private
        returns (bytes32 subscriptionId)
    {
        if (!allowedTokens[terms.token]) revert TokenNotAllowed();

        if (
            terms.merchant == address(0) ||
            terms.amountPerPeriod == 0 ||
            terms.periodSeconds == 0 ||
            // An unbounded period overflows `nextChargeAt + periodSeconds` on
            // the first charge, permanently bricking the subscription.
            terms.periodSeconds > MAX_PERIOD_SECONDS ||
            terms.noticeSeconds > MAX_NOTICE_SECONDS ||
            // A budget below one charge could never fund even the first period.
            terms.totalAuthorised < terms.amountPerPeriod
        ) {
            revert InvalidTerms();
        }

        // A bounded subscription must not be authorised for more than it can
        // ever spend, or the surplus is reserved from the allowance for nothing.
        if (
            terms.maxPeriods != 0 &&
            terms.totalAuthorised > terms.amountPerPeriod * uint256(terms.maxPeriods)
        ) {
            revert InvalidTerms();
        }

        uint64 start = terms.firstChargeAt == 0 ? uint64(block.timestamp) : terms.firstChargeAt;

        // A back-dated start would be immediately overdue, letting the first
        // charge land before the payer expects it.
        if (start < block.timestamp) revert InvalidTerms();
        if (terms.endTime != 0 && terms.endTime <= start) revert InvalidTerms();
        // Reject a subscription that is already dead on arrival.
        if (terms.endTime != 0 && terms.endTime <= block.timestamp) revert InvalidTerms();

        // Reserve this subscription's budget. Creation fails rather than letting
        // the new subscription quietly draw down an existing one's headroom.
        uint256 committed = committedAuthorisation[msg.sender][terms.token] + terms.totalAuthorised;
        uint256 allowance = IERC20(terms.token).allowance(msg.sender, address(this));
        if (committed > allowance) revert AuthorisationExceedsAllowance(committed, allowance);
        committedAuthorisation[msg.sender][terms.token] = committed;

        subscriptionId = keccak256(
            abi.encode(msg.sender, terms.merchant, terms.token, subscriptionNonce[msg.sender]++)
        );

        subscriptions[subscriptionId] = Subscription({
            payer: msg.sender,
            merchant: terms.merchant,
            token: terms.token,
            amountPerPeriod: terms.amountPerPeriod,
            remainingAuthorised: terms.totalAuthorised,
            periodSeconds: terms.periodSeconds,
            nextChargeAt: start,
            endTime: terms.endTime,
            noticeSeconds: terms.noticeSeconds,
            announcedAt: 0,
            periodsCharged: 0,
            maxPeriods: terms.maxPeriods,
            cancelled: false
        });

        emit SubscriptionCreated(
            subscriptionId,
            msg.sender,
            terms.merchant,
            terms.token,
            terms.amountPerPeriod,
            terms.totalAuthorised,
            terms.periodSeconds,
            start,
            terms.endTime,
            terms.noticeSeconds,
            terms.maxPeriods
        );
    }

    /**
     * @notice Grant the allowance and create the subscription in one call.
     *
     * @dev Must be sent by the payer: the permit applies to `msg.sender`, and
     * `createSubscription` records `msg.sender` as the payer. This collapses
     * setup to a single transaction, after which every period is charged with no
     * further input from the payer.
     *
     * Deliberately not relayer-submittable. An EIP-2612 permit commits only to
     * an allowance, not to the subscription terms, so a relayer holding a valid
     * permit could otherwise create a subscription naming any merchant.
     */
    function createSubscriptionWithPermit(
        SubscriptionTerms calldata terms,
        uint256 permitValue,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (bytes32 subscriptionId) {
        address token = terms.token;

        // The permit must cover what this subscription reserves, on top of
        // whatever the payer has already committed elsewhere.
        if (permitValue < committedAuthorisation[msg.sender][token] + terms.totalAuthorised) {
            revert InvalidTerms();
        }

        uint256 nonceBefore = IERC20Permit(token).nonces(msg.sender);

        try
            IERC20Permit(token).permit(
                msg.sender,
                address(this),
                permitValue,
                permitDeadline,
                v,
                r,
                s
            )
        {} catch {
            // Only one failure is tolerable: someone front-ran this call with
            // the same signature, which consumes the nonce and sets the
            // allowance anyway. Anything else — expired deadline, a token
            // without permit, a malformed signature — must revert.
            //
            // Checking the allowance alone is NOT sufficient: allowance is a
            // single pool, so an unrelated earlier approval would let a garbage
            // signature through. The nonce proves this signature was consumed.
            if (IERC20Permit(token).nonces(msg.sender) == nonceBefore) revert PermitFailed();
            if (IERC20(token).allowance(msg.sender, address(this)) < permitValue) {
                revert PermitFailed();
            }
        }

        return _createSubscription(terms);
    }

    // ============================================
    // Charging
    // ============================================

    /**
     * @notice Announce a due charge, starting its notice period.
     *
     * @dev Only needed when the subscription sets `noticeSeconds`. The waiting
     * period is what makes cancellation safe from front-running: the payer can
     * see the announcement and cancel while the charge still cannot execute,
     * instead of racing a merchant who is watching the mempool.
     */
    function announceCharge(bytes32 subscriptionId) external whenNotPaused {
        Subscription storage sub = subscriptions[subscriptionId];
        _assertChargeable(sub);

        // Re-announcing would restart the notice period, so a merchant could
        // keep a charge perpetually pending; the first announcement stands.
        if (sub.announcedAt == 0) {
            sub.announcedAt = uint64(block.timestamp);
            emit ChargeAnnounced(subscriptionId, sub.payer, uint64(block.timestamp) + sub.noticeSeconds);
        }
    }

    /**
     * @notice Execute one due charge. Permissionless — every limit is enforced
     * here, so the submitter is untrusted and only pays gas.
     */
    function charge(bytes32 subscriptionId) external nonReentrant whenNotPaused {
        Subscription storage sub = subscriptions[subscriptionId];
        _assertChargeable(sub);

        if (sub.noticeSeconds != 0) {
            if (sub.announcedAt == 0) revert ChargeNotAnnounced();
            uint64 executableAt = sub.announcedAt + sub.noticeSeconds;
            if (block.timestamp < executableAt) revert NoticePeriodPending(executableAt);
        }

        uint32 periodIndex = sub.periodsCharged;
        uint256 amount = sub.amountPerPeriod;

        // Advance state before transferring so a reentrant call cannot charge
        // the same period twice.
        //
        // The next due time is anchored to the schedule rather than to `now`, so
        // a late charge does not push every later period back. The comparison
        // must be `<=`: leaving `next == block.timestamp` would set nextChargeAt
        // to now, and the due check (`<`) would pass again in the same block,
        // allowing two charges zero seconds apart.
        uint64 next = sub.nextChargeAt + sub.periodSeconds;
        if (next <= uint64(block.timestamp)) {
            emit PeriodsSkipped(subscriptionId, next, uint64(block.timestamp) + sub.periodSeconds);
            next = uint64(block.timestamp) + sub.periodSeconds;
        }
        sub.nextChargeAt = next;
        sub.periodsCharged = periodIndex + 1;
        sub.announcedAt = 0;

        // Draw down this subscription's own budget, and release the same amount
        // from the payer's committed total.
        sub.remainingAuthorised -= amount;
        committedAuthorisation[sub.payer][sub.token] -= amount;

        // Funds move payer -> merchant directly; this contract is never a holder.
        //
        // Static analysers flag this as "arbitrary from in transferFrom", which
        // is the correct thing to look for — but `sub.payer` is not caller
        // controlled. It is set to `msg.sender` when the subscription is created
        // and has no setter, so a charge can only ever pull from someone who
        // created that subscription themselves and granted the allowance. Pull
        // payments require exactly this shape; the protections are the immutable
        // terms and the payer's revocable allowance, checked above.
        IERC20(sub.token).safeTransferFrom(sub.payer, sub.merchant, amount);

        emit SubscriptionCharged(
            subscriptionId,
            sub.payer,
            sub.merchant,
            amount,
            periodIndex,
            next,
            sub.remainingAuthorised
        );
    }

    /// @dev Shared validity checks for announcing and executing a charge.
    function _assertChargeable(Subscription storage sub) private view {
        if (sub.payer == address(0)) revert SubscriptionNotFound();
        if (sub.cancelled) revert SubscriptionInactive();
        if (block.timestamp < sub.nextChargeAt) revert ChargeNotDue(sub.nextChargeAt);
        if (sub.endTime != 0 && block.timestamp > sub.endTime) revert SubscriptionExpired();
        if (sub.maxPeriods != 0 && sub.periodsCharged >= sub.maxPeriods) {
            revert SubscriptionExpired();
        }
        if (sub.remainingAuthorised < sub.amountPerPeriod) revert AuthorisationExhausted();
    }

    // ============================================
    // Cancellation
    // ============================================

    /**
     * @notice Cancel a subscription. Either party may cancel at any time.
     * @dev Releases the unspent budget back to the payer's headroom so it can be
     * used by another subscription.
     */
    /// @dev Guarded so `committedAuthorisation` cannot be mutated re-entrantly
    /// from a token callback while a create or charge is mid-flight. Not
    /// `whenNotPaused`: a payer must always be able to exit.
    function cancel(bytes32 subscriptionId) external nonReentrant {
        Subscription storage sub = subscriptions[subscriptionId];
        if (sub.payer == address(0)) revert SubscriptionNotFound();
        if (msg.sender != sub.payer && msg.sender != sub.merchant) revert NotAuthorised();
        if (sub.cancelled) revert SubscriptionInactive();

        uint256 released = sub.remainingAuthorised;
        sub.cancelled = true;
        sub.remainingAuthorised = 0;
        sub.announcedAt = 0;
        committedAuthorisation[sub.payer][sub.token] -= released;

        emit SubscriptionCancelled(subscriptionId, msg.sender, released);
    }

    // ============================================
    // Views
    // ============================================

    function getSubscription(bytes32 subscriptionId) external view returns (Subscription memory) {
        Subscription memory sub = subscriptions[subscriptionId];
        if (sub.payer == address(0)) revert SubscriptionNotFound();
        return sub;
    }

    /// @notice Whether `charge` would currently succeed, including funding and
    /// any pending notice period.
    function isChargeable(bytes32 subscriptionId) external view returns (bool) {
        // `charge` is whenNotPaused; without this a relayer would keep
        // submitting doomed transactions and burning gas while paused.
        if (paused()) return false;

        Subscription memory sub = subscriptions[subscriptionId];
        if (sub.payer == address(0) || sub.cancelled) return false;
        if (block.timestamp < sub.nextChargeAt) return false;
        if (sub.endTime != 0 && block.timestamp > sub.endTime) return false;
        if (sub.maxPeriods != 0 && sub.periodsCharged >= sub.maxPeriods) return false;
        if (sub.remainingAuthorised < sub.amountPerPeriod) return false;

        if (sub.noticeSeconds != 0) {
            if (sub.announcedAt == 0) return false;
            if (block.timestamp < sub.announcedAt + sub.noticeSeconds) return false;
        }

        IERC20 token = IERC20(sub.token);
        if (token.allowance(sub.payer, address(this)) < sub.amountPerPeriod) return false;
        if (token.balanceOf(sub.payer) < sub.amountPerPeriod) return false;

        return true;
    }

    /// @notice Whether `announceCharge` would currently succeed.
    function isAnnounceable(bytes32 subscriptionId) external view returns (bool) {
        if (paused()) return false;

        Subscription memory sub = subscriptions[subscriptionId];
        if (sub.payer == address(0) || sub.cancelled) return false;
        if (sub.announcedAt != 0) return false;
        if (block.timestamp < sub.nextChargeAt) return false;
        if (sub.endTime != 0 && block.timestamp > sub.endTime) return false;
        if (sub.maxPeriods != 0 && sub.periodsCharged >= sub.maxPeriods) return false;
        if (sub.remainingAuthorised < sub.amountPerPeriod) return false;

        return true;
    }

    /// @notice Authorisation a payer could still commit for a token, given the
    /// allowance they have granted and what their existing subscriptions reserve.
    function availableAuthorisation(address payer, address token)
        external
        view
        returns (uint256)
    {
        uint256 allowance = IERC20(token).allowance(payer, address(this));
        uint256 committed = committedAuthorisation[payer][token];
        return allowance > committed ? allowance - committed : 0;
    }

    // ============================================
    // Admin
    // ============================================

    /**
     * @notice Halt new charges, announcements, and subscription creation.
     * @dev Together with the token allowlist, the only privileged power here. It
     * can stop charges but cannot redirect, seize, or increase them — the owner
     * has no path to user funds, which never enter this contract.
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
