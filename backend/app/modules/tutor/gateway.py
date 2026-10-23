"""AI Gateway: обращение к Claude API. Без ключа работает заглушка."""
import logging

import anthropic

from app.core.config import settings

log = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def enabled() -> bool:
    return bool(settings.llm_api_key)


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.llm_api_key, timeout=60.0, max_retries=2)
    return _client


class TutorUnavailable(Exception):
    pass


def complete(system: str, messages: list[dict]) -> tuple[str, int, int]:
    """Возвращает (текст, input_tokens, output_tokens)."""
    try:
        resp = _get_client().beta.messages.create(
            model=settings.llm_model,
            max_tokens=4000,
            system=system,
            messages=messages,
            betas=["server-side-fallback-2026-07-01"],
            # короткий диалог: низкое усилие; при отказе классификатора сервер сам переключит модель
            extra_body={"fallbacks": "default", "output_config": {"effort": "low"}},
        )
    except anthropic.RateLimitError as e:
        log.warning("LLM rate limit: %s", e)
        raise TutorUnavailable from e
    except anthropic.APIStatusError as e:
        log.error("LLM API error %s: %s", e.status_code, e)
        raise TutorUnavailable from e
    except anthropic.APIConnectionError as e:
        log.error("LLM connection error: %s", e)
        raise TutorUnavailable from e

    usage = resp.usage
    log.info("LLM %s stop=%s in=%s out=%s", resp.model, resp.stop_reason, usage.input_tokens, usage.output_tokens)
    if resp.stop_reason == "refusal":
        return "", usage.input_tokens, usage.output_tokens
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    return text, usage.input_tokens, usage.output_tokens
