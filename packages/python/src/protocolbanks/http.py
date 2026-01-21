"""
ProtocolBanks SDK - HTTP Client

HTTP 客户端封装，支持:
- 自动重试 (指数退避)
- 速率限制处理
- 请求/响应拦截
"""

from __future__ import annotations

import asyncio
from typing import Any, TypeVar

import httpx

from protocolbanks.errors import ProtocolBanksError, create_network_error
from protocolbanks.types import Environment, ErrorCodes, RetryConfig


T = TypeVar("T")

# ============================================================================
# Constants
# ============================================================================

BASE_URLS: dict[Environment, str] = {
    "production": "https://api.protocolbanks.com/v1",
    "sandbox": "https://sandbox-api.protocolbanks.com/v1",
    "testnet": "https://testnet-api.protocolbanks.com/v1",
}

DEFAULT_TIMEOUT = 30.0
DEFAULT_RETRY_CONFIG = RetryConfig(
    max_retries=3,
    initial_delay=1.0,
    max_delay=30.0,
    backoff_multiplier=2.0,
)


class HttpClient:
    """HTTP Client with retry and rate limiting"""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        environment: Environment = "production",
        base_url: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        retry_config: RetryConfig | None = None,
    ):
        self._api_key = api_key
        self._api_secret = api_secret
        self._base_url = base_url or BASE_URLS.get(environment, BASE_URLS["production"])
        self._timeout = timeout
        self._retry_config = retry_config or DEFAULT_RETRY_CONFIG

        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
            headers=self._get_default_headers(),
        )

    def _get_default_headers(self) -> dict[str, str]:
        """Get default request headers"""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-API-Key": self._api_key,
            "User-Agent": "ProtocolBanks-Python-SDK/0.1.0",
        }

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """Make GET request"""
        return await self._request("GET", path, params=params)

    async def post(self, path: str, data: dict[str, Any] | None = None) -> Any:
        """Make POST request"""
        return await self._request("POST", path, json=data)

    async def put(self, path: str, data: dict[str, Any] | None = None) -> Any:
        """Make PUT request"""
        return await self._request("PUT", path, json=data)

    async def delete(self, path: str) -> Any:
        """Make DELETE request"""
        return await self._request("DELETE", path)

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        """Make HTTP request with retry"""
        last_error: Exception | None = None

        for attempt in range(self._retry_config.max_retries + 1):
            try:
                response = await self._client.request(
                    method=method,
                    url=path,
                    params=params,
                    json=json,
                )

                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", "60"))
                    if attempt < self._retry_config.max_retries:
                        await asyncio.sleep(retry_after)
                        continue
                    raise ProtocolBanksError(
                        code=ErrorCodes.RATE_LIMIT_EXCEEDED,
                        message="Rate limit exceeded",
                        retry_after=retry_after,
                        retryable=True,
                    )

                # Handle errors
                if response.status_code >= 400:
                    self._handle_error_response(response)

                # Return JSON response
                if response.content:
                    return response.json()
                return {}

            except httpx.TimeoutException:
                last_error = create_network_error(
                    "Request timed out",
                    ErrorCodes.NET_TIMEOUT,
                )
            except httpx.ConnectError:
                last_error = create_network_error(
                    "Connection failed",
                    ErrorCodes.NET_CONNECTION_FAILED,
                )
            except ProtocolBanksError:
                raise
            except Exception as e:
                last_error = ProtocolBanksError.from_exception(e)

            # Retry with backoff
            if attempt < self._retry_config.max_retries:
                delay = min(
                    self._retry_config.initial_delay
                    * (self._retry_config.backoff_multiplier**attempt),
                    self._retry_config.max_delay,
                )
                await asyncio.sleep(delay)

        # Raise last error
        if last_error:
            raise last_error

        raise create_network_error("Request failed after retries")

    def _handle_error_response(self, response: httpx.Response) -> None:
        """Handle error response"""
        try:
            data = response.json()
            error_code = data.get("code", ErrorCodes.NET_CONNECTION_FAILED)
            error_message = data.get("message", "Request failed")
            error_details = data.get("details")

            raise ProtocolBanksError(
                code=error_code,
                message=error_message,
                details=error_details,
                retryable=response.status_code >= 500,
            )
        except ValueError:
            # Non-JSON response
            raise ProtocolBanksError(
                code=ErrorCodes.NET_CONNECTION_FAILED,
                message=f"Request failed with status {response.status_code}",
                retryable=response.status_code >= 500,
            )

    async def close(self) -> None:
        """Close HTTP client"""
        await self._client.aclose()

    async def __aenter__(self) -> "HttpClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
