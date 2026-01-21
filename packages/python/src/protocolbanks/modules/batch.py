"""
ProtocolBanks SDK - Batch Payment Module

批量支付，支持:
- 批量验证 (最多 500 收款人)
- 批量提交
- 状态追踪
- 失败重试
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Callable

from protocolbanks.config import MAX_BATCH_SIZE
from protocolbanks.errors import ProtocolBanksError
from protocolbanks.types import (
    BatchItemStatus,
    BatchOptions,
    BatchProgress,
    BatchRecipient,
    BatchStatus,
    BatchSubmitResult,
    BatchValidationError,
    ErrorCodes,
)
from protocolbanks.utils.crypto import generate_uuid
from protocolbanks.utils.validation import (
    detect_homoglyphs,
    is_valid_address,
    is_valid_amount,
    is_valid_token,
)


class BatchModule:
    """Batch Payment Module"""

    def __init__(self, http_client: Any):
        self._http = http_client
        self._batches: dict[str, BatchStatus] = {}
        self._polling_tasks: dict[str, bool] = {}

    # ============================================================================
    # Public Methods
    # ============================================================================

    async def validate(
        self, recipients: list[BatchRecipient] | list[dict]
    ) -> list[BatchValidationError]:
        """
        Validate batch recipients.
        Returns errors for ALL invalid entries (not just first).
        """
        # Convert dicts to BatchRecipient if needed
        recipients_list: list[BatchRecipient] = [
            BatchRecipient(**r) if isinstance(r, dict) else r for r in recipients
        ]

        errors: list[BatchValidationError] = []

        # Check batch size
        if len(recipients_list) > MAX_BATCH_SIZE:
            raise ProtocolBanksError(
                code=ErrorCodes.BATCH_SIZE_EXCEEDED,
                message=f"Batch size {len(recipients_list)} exceeds maximum of {MAX_BATCH_SIZE}",
                details={"size": len(recipients_list), "max_size": MAX_BATCH_SIZE},
                retryable=False,
            )

        if len(recipients_list) == 0:
            raise ProtocolBanksError(
                code=ErrorCodes.BATCH_VALIDATION_FAILED,
                message="Batch cannot be empty",
                retryable=False,
            )

        # Validate each recipient
        for i, recipient in enumerate(recipients_list):
            recipient_errors: list[str] = []

            # Validate address
            if not recipient.address:
                recipient_errors.append("Address is required")
            else:
                # Check for homoglyphs
                homoglyph_details = detect_homoglyphs(recipient.address)
                if homoglyph_details:
                    recipient_errors.append(
                        "Address contains suspicious characters (possible homoglyph attack)"
                    )
                elif not is_valid_address(recipient.address):
                    recipient_errors.append("Invalid address format")

            # Validate amount
            if not recipient.amount:
                recipient_errors.append("Amount is required")
            elif not is_valid_amount(recipient.amount):
                recipient_errors.append("Invalid amount (must be positive, max 1 billion)")

            # Validate token
            if not recipient.token:
                recipient_errors.append("Token is required")
            elif not is_valid_token(recipient.token):
                recipient_errors.append(f"Unsupported token: {recipient.token}")

            # Validate memo length
            if recipient.memo and len(recipient.memo) > 256:
                recipient_errors.append("Memo exceeds maximum length of 256 characters")

            # Add errors if any
            if recipient_errors:
                errors.append(
                    BatchValidationError(
                        index=i,
                        address=recipient.address or "",
                        errors=recipient_errors,
                    )
                )

        # Check for duplicate addresses
        address_counts: dict[str, list[int]] = {}
        for i, recipient in enumerate(recipients_list):
            if recipient.address:
                address = recipient.address.lower()
                if address not in address_counts:
                    address_counts[address] = []
                address_counts[address].append(i)

        for address, indices in address_counts.items():
            if len(indices) > 1:
                # Add warning for duplicates
                for index in indices:
                    existing = next((e for e in errors if e.index == index), None)
                    if existing:
                        existing.errors.append(
                            f"Duplicate address (appears {len(indices)} times)"
                        )
                    else:
                        errors.append(
                            BatchValidationError(
                                index=index,
                                address=address,
                                errors=[f"Duplicate address (appears {len(indices)} times)"],
                            )
                        )

        return sorted(errors, key=lambda e: e.index)

    async def submit(
        self,
        recipients: list[BatchRecipient] | list[dict],
        options: BatchOptions | dict | None = None,
    ) -> BatchSubmitResult:
        """Submit batch payment"""
        # Convert dicts if needed
        recipients_list: list[BatchRecipient] = [
            BatchRecipient(**r) if isinstance(r, dict) else r for r in recipients
        ]

        if options and isinstance(options, dict):
            options = BatchOptions(**options)

        # Validate batch
        validation_errors = await self.validate(recipients_list)

        # Filter out warnings (duplicates) vs errors
        critical_errors = [
            e for e in validation_errors if not all("Duplicate" in err for err in e.errors)
        ]

        if critical_errors:
            return BatchSubmitResult(
                batch_id="",
                status="failed",
                valid_count=len(recipients_list) - len(critical_errors),
                invalid_count=len(critical_errors),
                errors=critical_errors,
            )

        # Generate batch ID
        batch_id = f"batch_{generate_uuid().replace('-', '')}"

        # Calculate total amount
        total_amount = sum(float(r.amount) for r in recipients_list)

        # Prepare batch items
        items: list[BatchItemStatus] = [
            BatchItemStatus(
                index=i,
                address=r.address,
                amount=r.amount,
                status="pending",
            )
            for i, r in enumerate(recipients_list)
        ]

        # Create batch status
        batch_status = BatchStatus(
            batch_id=batch_id,
            status="pending",
            progress=BatchProgress(
                total=len(recipients_list),
                completed=0,
                failed=0,
                pending=len(recipients_list),
            ),
            items=items,
            total_amount=str(total_amount),
            created_at=datetime.now(),
        )

        # Store locally
        self._batches[batch_id] = batch_status

        # Submit to backend
        try:
            response = await self._http.post(
                "/batch/submit",
                {
                    "batch_id": batch_id,
                    "recipients": [
                        {
                            "address": r.address,
                            "amount": r.amount,
                            "token": r.token,
                            "memo": r.memo,
                            "order_id": r.order_id,
                        }
                        for r in recipients_list
                    ],
                    "chain": options.chain if options else None,
                    "priority": options.priority if options else "medium",
                    "webhook_url": options.webhook_url if options else None,
                    "idempotency_key": options.idempotency_key if options else None,
                },
            )

            # Update local status
            batch_status.status = response.get("status", "pending")

            return BatchSubmitResult(
                batch_id=batch_id,
                status=response.get("status", "pending"),
                valid_count=len(recipients_list),
                invalid_count=0,
                errors=[],
                estimated_fee=response.get("estimated_fee"),
            )

        except Exception as e:
            batch_status.status = "failed"
            raise e

    async def get_status(self, batch_id: str) -> BatchStatus:
        """Get batch status"""
        # Check local cache first
        local_batch = self._batches.get(batch_id)

        # Fetch from backend
        try:
            response = await self._http.get(f"/batch/{batch_id}")

            # Update local cache
            if local_batch:
                local_batch.status = response.get("status", local_batch.status)
                local_batch.progress = BatchProgress(**response.get("progress", {}))
                local_batch.items = [
                    BatchItemStatus(**item) for item in response.get("items", [])
                ]
            else:
                batch_status = BatchStatus(**response)
                self._batches[batch_id] = batch_status
                return batch_status

            return local_batch

        except Exception:
            # Return local state if available
            if local_batch:
                return local_batch

            raise ProtocolBanksError(
                code=ErrorCodes.BATCH_NOT_FOUND,
                message=f"Batch {batch_id} not found",
                retryable=False,
            )

    async def retry(
        self, batch_id: str, item_indices: list[int] | None = None
    ) -> BatchSubmitResult:
        """Retry failed items in batch"""
        batch = await self.get_status(batch_id)

        # Check if batch can be retried
        if batch.status == "processing":
            raise ProtocolBanksError(
                code=ErrorCodes.BATCH_ALREADY_PROCESSING,
                message="Batch is currently processing, cannot retry",
                retryable=False,
            )

        # Get failed items
        failed_items = [
            item
            for item in batch.items
            if item.status == "failed"
            and (item_indices is None or item.index in item_indices)
        ]

        if not failed_items:
            return BatchSubmitResult(
                batch_id=batch_id,
                status=batch.status,  # type: ignore
                valid_count=0,
                invalid_count=0,
                errors=[],
            )

        # Submit retry request
        response = await self._http.post(
            f"/batch/{batch_id}/retry",
            {"item_indices": [i.index for i in failed_items]},
        )

        return BatchSubmitResult(**response)

    def poll(
        self,
        batch_id: str,
        callback: Callable[[BatchStatus], None],
        interval: float = 5.0,
    ) -> Callable[[], None]:
        """Poll batch status with callback"""
        import asyncio

        self._polling_tasks[batch_id] = True

        async def poll_fn():
            while self._polling_tasks.get(batch_id, False):
                try:
                    status = await self.get_status(batch_id)
                    callback(status)

                    # Stop polling if batch is complete
                    if self._is_final_status(status.status):
                        self.stop_polling(batch_id)
                        break

                except Exception:
                    # Continue polling on error
                    pass

                await asyncio.sleep(interval)

        # Start polling in background
        asyncio.create_task(poll_fn())

        # Return stop function
        return lambda: self.stop_polling(batch_id)

    def stop_polling(self, batch_id: str) -> None:
        """Stop polling for a batch"""
        self._polling_tasks[batch_id] = False

    def stop_all_polling(self) -> None:
        """Stop all polling"""
        for batch_id in list(self._polling_tasks.keys()):
            self.stop_polling(batch_id)

    # ============================================================================
    # Helper Methods
    # ============================================================================

    def calculate_total(
        self, recipients: list[BatchRecipient]
    ) -> dict[str, Any]:
        """Calculate total amount for batch"""
        by_token: dict[str, float] = {}

        for recipient in recipients:
            try:
                amount = float(recipient.amount)
                by_token[recipient.token] = by_token.get(recipient.token, 0) + amount
            except (ValueError, TypeError):
                pass

        # Convert to string
        by_token_str = {token: f"{amount:.6f}" for token, amount in by_token.items()}

        # Estimate USD total (assuming stablecoins = $1)
        stablecoins = ["USDC", "USDT", "DAI"]
        total_usd = sum(
            amount for token, amount in by_token.items() if token in stablecoins
        )

        return {
            "by_token": by_token_str,
            "total_usd": f"{total_usd:.2f}",
        }

    def get_progress(self, status: BatchStatus) -> int:
        """Get batch progress percentage"""
        if status.progress.total == 0:
            return 0
        return round(
            ((status.progress.completed + status.progress.failed) / status.progress.total)
            * 100
        )

    # ============================================================================
    # Private Methods
    # ============================================================================

    def _is_final_status(self, status: str) -> bool:
        """Check if status is final"""
        return status in ("completed", "failed")


def create_batch_module(http_client: Any) -> BatchModule:
    """Create a new BatchModule instance"""
    return BatchModule(http_client)
