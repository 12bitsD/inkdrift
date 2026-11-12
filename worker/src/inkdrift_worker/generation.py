import asyncio
from collections.abc import Mapping
from typing import Any

import httpx
from nextloop import (
    AgentLoop,
    CandidateRequest,
    FinishReason,
    InMemoryEventStore,
    LoopConfig,
    MemoryDeliveryOwner,
    ModelProvider,
    ModelResponse,
    ProviderError,
    ToolRegistry,
    TurnContext,
    TurnStatus,
)

from .svg import SvgError, sanitize_svg


class ObservedProvider:
    def __init__(self, delegate: ModelProvider) -> None:
        self.delegate = delegate
        self.response: ModelResponse | None = None
        self.error: ProviderError | None = None

    async def complete(
        self, request: CandidateRequest, *, attempt: int, cancel: asyncio.Event
    ) -> ModelResponse:
        try:
            self.response = await self.delegate.complete(request, attempt=attempt, cancel=cancel)
        except ProviderError as error:
            self.error = error
            raise
        return self.response


def finish_reason(value: FinishReason | None) -> str | None:
    if value is None:
        return None
    return {
        FinishReason.STOP: "stop",
        FinishReason.TOOL_CALLS: "tool-calls",
        FinishReason.LENGTH: "length",
        FinishReason.CONTENT_FILTER: "content-filter",
        FinishReason.ERROR: "error",
        FinishReason.CANCELLED: "error",
    }[value]


def usage(response: ModelResponse | None) -> dict[str, int | None]:
    value = response.usage if response is not None else None
    return {
        "inputTokens": value.input_tokens if value is not None else None,
        "outputTokens": value.output_tokens if value is not None else None,
    }


async def generate_svg(request: Mapping[str, Any], provider: ModelProvider) -> dict[str, Any]:
    observed = provider if isinstance(provider, ObservedProvider) else ObservedProvider(provider)
    delivery = MemoryDeliveryOwner()
    outcome = await AgentLoop().run(
        TurnContext(
            session_id=str(request["runId"]),
            input_id=f"{request['runId']}-input",
            initial_input=str(request["prompt"]),
            config=LoopConfig(
                system_prompt=str(request["system"]),
                context_window=2_000_000_000,
                output_reserve=0,
                max_protocol_corrections=0,
                max_provider_attempts=1,
                max_steps=1,
                max_model_calls=1,
                max_output_tokens=int(request["maxOutputTokens"]),
                turn_deadline_seconds=float(request["timeoutMs"]) / 1000,
            ),
            store=InMemoryEventStore(),
            provider=observed,
            tools=ToolRegistry(),
            delivery=delivery,
        )
    )
    response = observed.response
    if outcome.status != TurnStatus.SUCCEEDED or len(delivery.messages) != 1:
        provider_timed_out = observed.error is not None and isinstance(
            observed.error.__cause__, (TimeoutError, httpx.TimeoutException)
        )
        timed_out = outcome.error == "turn_deadline_exceeded" or provider_timed_out
        return {
            "kind": "failed",
            "code": "timeout" if timed_out else "provider-error",
            "message": "The model request timed out"
            if timed_out
            else "The model provider could not complete the request",
            "finishReason": finish_reason(response.finish_reason if response is not None else None),
            "usage": usage(response),
        }

    raw_text = delivery.messages[0].content
    if response is not None and response.finish_reason == FinishReason.LENGTH:
        return {
            "kind": "failed",
            "code": "invalid-svg",
            "message": "The response was truncated before the SVG was complete",
            "rawText": raw_text,
            "finishReason": "length",
            "usage": usage(response),
        }
    try:
        svg = sanitize_svg(raw_text)
    except SvgError as error:
        return {
            "kind": "failed",
            "code": "invalid-svg",
            "message": str(error),
            "rawText": raw_text,
            "finishReason": finish_reason(response.finish_reason if response is not None else None),
            "usage": usage(response),
        }
    return {
        "kind": "succeeded",
        "rawText": raw_text,
        "svg": svg,
        "finishReason": finish_reason(response.finish_reason if response is not None else None),
        "usage": usage(response),
    }
