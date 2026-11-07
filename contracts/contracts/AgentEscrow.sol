// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract AgentEscrow is EIP712, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum State {
        None,
        Created,
        Funded,
        Delivered,
        Released,
        Refunded,
        Disputed,
        Cancelled
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        uint64 deliveryDue;
        bytes32 termsHash;
        bytes32 deliveryHash;
        State state;
    }

    bytes32 private constant RELEASE_TYPEHASH =
        keccak256("Release(bytes32 orderId,bytes32 deliveryHash,uint256 nonce,uint256 deadline)");
    bytes32 private constant REFUND_TYPEHASH =
        keccak256("Refund(bytes32 orderId,uint256 nonce,uint256 deadline)");

    IERC20 public immutable token;
    address public resolver;

    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => uint256) public actionNonces;

    event OrderCreated(bytes32 indexed orderId, address indexed buyer, address indexed seller, uint256 amount, bytes32 termsHash);
    event OrderFunded(bytes32 indexed orderId, address indexed buyer, uint256 amount);
    event OrderDelivered(bytes32 indexed orderId, address indexed seller, bytes32 deliveryHash);
    event OrderReleased(bytes32 indexed orderId, address indexed seller, uint256 amount);
    event OrderRefunded(bytes32 indexed orderId, address indexed buyer, uint256 amount);
    event OrderDisputed(bytes32 indexed orderId, address indexed by, bytes32 reasonHash);
    event OrderResolved(bytes32 indexed orderId, bool releasedToSeller, bytes32 resolutionHash);
    event OrderCancelled(bytes32 indexed orderId);
    event ResolverChanged(address indexed resolver);

    modifier onlyResolver() {
        require(msg.sender == resolver, "not resolver");
        _;
    }

    constructor(address token_, address owner_, address resolver_) EIP712("Protocol Bank Agent Escrow", "1") Ownable(owner_) {
        require(token_ != address(0), "token required");
        require(resolver_ != address(0), "resolver required");
        token = IERC20(token_);
        resolver = resolver_;
    }

    function createOrder(
        bytes32 orderId,
        address seller,
        uint256 amount,
        uint64 deliveryDue,
        bytes32 termsHash
    ) external {
        require(orders[orderId].state == State.None, "order exists");
        require(seller != address(0) && seller != msg.sender, "bad seller");
        require(amount > 0, "bad amount");
        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            deliveryDue: deliveryDue,
            termsHash: termsHash,
            deliveryHash: bytes32(0),
            state: State.Created
        });
        emit OrderCreated(orderId, msg.sender, seller, amount, termsHash);
    }

    function fundWithAuthorization(
        bytes32 orderId,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.state == State.Created, "order not fundable");
        require(from == order.buyer, "not buyer");
        require(value == order.amount, "wrong amount");
        IERC3009(address(token)).transferWithAuthorization(
            from,
            address(this),
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
        order.state = State.Funded;
        emit OrderFunded(orderId, from, value);
    }

    function markDelivered(bytes32 orderId, bytes32 deliveryHash) external {
        Order storage order = orders[orderId];
        require(msg.sender == order.seller, "not seller");
        require(order.state == State.Funded, "order not funded");
        require(deliveryHash != bytes32(0), "empty delivery");
        order.deliveryHash = deliveryHash;
        order.state = State.Delivered;
        emit OrderDelivered(orderId, msg.sender, deliveryHash);
    }

    function release(bytes32 orderId, uint256 nonce, uint256 deadline, bytes calldata signature) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.state == State.Delivered, "not delivered");
        require(block.timestamp <= deadline, "release expired");
        require(nonce == actionNonces[orderId], "bad nonce");
        actionNonces[orderId] = nonce + 1;
        bytes32 structHash = keccak256(abi.encode(RELEASE_TYPEHASH, orderId, order.deliveryHash, nonce, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == order.buyer, "bad release signature");
        order.state = State.Released;
        token.safeTransfer(order.seller, order.amount);
        emit OrderReleased(orderId, order.seller, order.amount);
    }

    function refund(bytes32 orderId, uint256 nonce, uint256 deadline, bytes calldata signature) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.state == State.Funded, "not refundable");
        require(block.timestamp <= deadline, "refund expired");
        require(nonce == actionNonces[orderId], "bad nonce");
        actionNonces[orderId] = nonce + 1;
        bytes32 structHash = keccak256(abi.encode(REFUND_TYPEHASH, orderId, nonce, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == order.buyer, "bad refund signature");
        order.state = State.Refunded;
        token.safeTransfer(order.buyer, order.amount);
        emit OrderRefunded(orderId, order.buyer, order.amount);
    }

    function dispute(bytes32 orderId, bytes32 reasonHash) external {
        Order storage order = orders[orderId];
        require(msg.sender == order.buyer || msg.sender == order.seller, "not party");
        require(order.state == State.Funded || order.state == State.Delivered, "not disputable");
        order.state = State.Disputed;
        emit OrderDisputed(orderId, msg.sender, reasonHash);
    }

    function resolve(bytes32 orderId, bool releaseToSeller, bytes32 resolutionHash) external onlyResolver nonReentrant {
        Order storage order = orders[orderId];
        require(order.state == State.Disputed, "not disputed");
        order.state = releaseToSeller ? State.Released : State.Refunded;
        if (releaseToSeller) {
            token.safeTransfer(order.seller, order.amount);
        } else {
            token.safeTransfer(order.buyer, order.amount);
        }
        emit OrderResolved(orderId, releaseToSeller, resolutionHash);
    }

    function cancel(bytes32 orderId) external {
        Order storage order = orders[orderId];
        require(msg.sender == order.buyer, "not buyer");
        require(order.state == State.Created, "not cancellable");
        order.state = State.Cancelled;
        emit OrderCancelled(orderId);
    }

    function setResolver(address next) external onlyOwner {
        require(next != address(0), "resolver required");
        resolver = next;
        emit ResolverChanged(next);
    }
}
