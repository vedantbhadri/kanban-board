import json
import os
from typing import Literal

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError


MODEL = "openai/gpt-oss-120b"
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["create", "edit", "move"]},
        "cardId": {"type": "string"},
        "columnId": {"type": "string"},
        "title": {"type": "string"},
        "details": {"type": "string"},
        "targetCardId": {"type": "string"},
    },
    "required": ["type", "cardId", "columnId", "title", "details", "targetCardId"],
    "additionalProperties": False,
}
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "response": {"type": "string"},
        "actions": {"type": "array", "items": ACTION_SCHEMA},
    },
    "required": ["response", "actions"],
    "additionalProperties": False,
}


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["create", "edit", "move"]
    cardId: str
    columnId: str
    title: str
    details: str
    targetCardId: str


class ChatOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    response: str
    actions: list[Action] = Field(max_length=20)


async def generate(board: dict, message: str, history: list[dict]) -> ChatOutput:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise HTTPException(503, "OpenRouter key is not configured")
    instructions = (
        "You are a concise project assistant for a Kanban board. The current board JSON follows. "
        "Use the exact card and column IDs in it. If the user asks to change cards, return one or more actions. "
        "For create, supply columnId, title, and details. For edit, supply cardId and the full new title and details, "
        "preserving any field the user did not ask to change. For move, supply cardId and columnId; "
        "targetCardId is an optional destination card ID or an empty string to append. "
        "Set unused action fields to empty strings. Do not invent IDs for existing cards. "
        "Do not change columns. If the request is only a question, return no actions. "
        "Keep the response brief. Current board: " + json.dumps(board)
    )
    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": instructions}, *history, {"role": "user", "content": message}],
        "provider": {"require_parameters": True},
        "response_format": {"type": "json_schema", "json_schema": {"name": "kanban_assistant", "strict": True, "schema": RESPONSE_SCHEMA}},
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return ChatOutput.model_validate_json(content)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValidationError, ValueError) as error:
        raise HTTPException(502, "AI response failed. Please try again.") from error
