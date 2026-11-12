import asyncio
import json
import os
import sys
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlparse

from nextloop import OpenAIProvider

from .generation import generate_svg

MAX_REQUEST_BYTES = 1024 * 1024


def string(value: Any, *, nonempty: bool = False) -> str:
    if not isinstance(value, str) or (nonempty and not value.strip()):
        raise ValueError("invalid string")
    return value


def integer(value: Any, minimum: int, maximum: int) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError("invalid integer")
    return value


def base_url(value: Any) -> str:
    raw = string(value)
    parsed = urlparse(raw)
    loopback = (
        parsed.hostname == "localhost"
        or parsed.hostname == "::1"
        or (parsed.hostname is not None and parsed.hostname.startswith("127."))
    )
    if (
        parsed.scheme not in {"http", "https"}
        or parsed.hostname is None
        or (parsed.scheme == "http" and not loopback)
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("unsafe provider base URL")
    _ = parsed.port
    return raw.rstrip("/")


def read_request() -> Mapping[str, Any]:
    payload = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    if len(payload) > MAX_REQUEST_BYTES:
        raise ValueError("request too large")
    value = json.loads(payload)
    if not isinstance(value, dict) or value.get("version") != 1:
        raise ValueError("invalid request")
    string(value["runId"], nonempty=True)
    string(value["system"], nonempty=True)
    string(value["prompt"], nonempty=True)
    integer(value["maxOutputTokens"], 256, 64_000)
    integer(value["timeoutMs"], 1_000, 900_000)
    provider = value["provider"]
    if not isinstance(provider, dict):
        raise ValueError("invalid provider")
    string(provider["modelId"], nonempty=True)
    provider["baseUrl"] = base_url(provider["baseUrl"])
    return value


def provider(request: Mapping[str, Any]) -> OpenAIProvider:
    api_key = os.environ.get("INKDRIFT_API_KEY", "").strip()
    if not api_key:
        raise ValueError("missing provider credential")
    config = request["provider"]
    return OpenAIProvider(
        model_id=str(config["modelId"]),
        base_url=str(config["baseUrl"]),
        api_key=api_key,
        default_parameters={"max_tokens": integer(request["maxOutputTokens"], 256, 64_000)},
        timeout_seconds=integer(request["timeoutMs"], 1_000, 900_000) / 1000,
    )


def main() -> int:
    try:
        request = read_request()
        result = asyncio.run(generate_svg(request, provider(request)))
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        result = {"kind": "failed", "code": "invalid-input", "message": "Invalid worker input"}
    except Exception:
        result = {
            "kind": "failed",
            "code": "provider-error",
            "message": "The model provider could not complete the request",
        }
    sys.stdout.write(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    return 0 if result.get("kind") == "succeeded" else 1


if __name__ == "__main__":
    raise SystemExit(main())
