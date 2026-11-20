"""AI Gateway: обращение к OpenAI API. Без ключа работает заглушка."""
import logging

import openai

from app.core.config import settings

log = logging.getLogger(__name__)

_client: openai.OpenAI | None = None


def enabled() -> bool:
    return bool(settings.llm_api_key)


def _get_client() -> openai.OpenAI:
    global _client
    if _client is None:
        _client = openai.OpenAI(api_key=settings.llm_api_key, timeout=60.0, max_retries=2)
    return _client


class TutorUnavailable(Exception):
    pass


def complete(system: str, messages: list[dict]) -> tuple[str, int, int]:
    """Возвращает (текст, input_tokens, output_tokens)."""
    try:
        resp = _get_client().chat.completions.create(
            model=settings.llm_model,
            max_completion_tokens=4000,
            messages=[{"role": "system", "content": system}, *messages],
        )
    except openai.RateLimitError as e:
        log.warning("LLM rate limit: %s", e)
        raise TutorUnavailable from e
    except openai.APIStatusError as e:
        log.error("LLM API error %s: %s", e.status_code, e)
        raise TutorUnavailable from e
    except openai.APIConnectionError as e:
        log.error("LLM connection error: %s", e)
        raise TutorUnavailable from e

    usage = resp.usage
    choice = resp.choices[0]
    log.info("LLM %s finish=%s in=%s out=%s", resp.model, choice.finish_reason, usage.prompt_tokens, usage.completion_tokens)
    if choice.finish_reason == "content_filter":
        return "", usage.prompt_tokens, usage.completion_tokens
    text = (choice.message.content or "").strip()
    return text, usage.prompt_tokens, usage.completion_tokens


def complete_vision(system: str, prompt: str, image_b64: str, mime: str = "image/jpeg") -> tuple[str, int, int]:
    """Как complete(), но с одной картинкой (vision): фото страницы тетради и т.п."""
    try:
        resp = _get_client().chat.completions.create(
            model=settings.vision_model or settings.llm_model,
            max_completion_tokens=1000,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                ]},
            ],
        )
    except openai.RateLimitError as e:
        log.warning("LLM vision rate limit: %s", e)
        raise TutorUnavailable from e
    except openai.APIStatusError as e:
        log.error("LLM vision API error %s: %s", e.status_code, e)
        raise TutorUnavailable from e
    except openai.APIConnectionError as e:
        log.error("LLM vision connection error: %s", e)
        raise TutorUnavailable from e

    usage = resp.usage
    choice = resp.choices[0]
    log.info("LLM vision %s finish=%s in=%s out=%s", resp.model, choice.finish_reason, usage.prompt_tokens, usage.completion_tokens)
    if choice.finish_reason == "content_filter":
        return "", usage.prompt_tokens, usage.completion_tokens
    text = (choice.message.content or "").strip()
    return text, usage.prompt_tokens, usage.completion_tokens
