import asyncio
import ipaddress
import json
import math
import os
import sys
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlparse

from nextloop import AnthropicProvider, ModelProvider, OpenAIProvider

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


def number(value: Any, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("invalid number")
    result = float(value)
    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise ValueError("invalid number")
    return result


def positive_integer(value: Any) -> int:
    if type(value) is not int or value < 1:
        raise ValueError("invalid positive integer")
    return value


def is_loopback(hostname: str | None) -> bool:
    if hostname is None:
        return False
    if hostname == "localhost":
        return True
    try:
        return ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        return False


def base_url(value: Any) -> str:
    raw = string(value)
    parsed = urlparse(raw)
    loopback = is_loopback(parsed.hostname)
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
    integer(value["maxOutputTokens"], 256, 1_000_000)
    integer(value["timeoutMs"], 1_000, 900_000)
    provider = value["provider"]
    if not isinstance(provider, dict):
        raise ValueError("invalid provider")
    provider_type = provider.get("type", "openai")
    if provider_type not in {"openai", "anthropic"}:
        raise ValueError("invalid provider type")
    provider["type"] = provider_type
    string(provider["modelId"], nonempty=True)
    provider["baseUrl"] = base_url(provider["baseUrl"])
    if "temperature" in value:
        value["temperature"] = number(
            value["temperature"], 0, 1 if provider_type == "anthropic" else 2
        )
    if "topP" in value:
        value["topP"] = number(value["topP"], 0, 1)
    if "topK" in value:
        value["topK"] = positive_integer(value["topK"])
    return value


def provider(request: Mapping[str, Any]) -> ModelProvider:
    api_key = os.environ.get("INKDRIFT_API_KEY", "").strip()
    if not api_key:
        raise ValueError("missing provider credential")
    config = request["provider"]
    default_parameters: dict[str, Any] = {
        "max_tokens": integer(request["maxOutputTokens"], 256, 1_000_000)
    }
    for request_key, parameter_key in (
        ("temperature", "temperature"),
        ("topP", "top_p"),
        ("topK", "top_k"),
    ):
        if request_key in request:
            default_parameters[parameter_key] = request[request_key]
    provider_class: type[OpenAIProvider] | type[AnthropicProvider]
    if config.get("type", "openai") == "anthropic":
        provider_class = AnthropicProvider
    else:
        provider_class = OpenAIProvider
    return provider_class(
        model_id=str(config["modelId"]),
        base_url=str(config["baseUrl"]),
        api_key=api_key,
        default_parameters=default_parameters,
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
