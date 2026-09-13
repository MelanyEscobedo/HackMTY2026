import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")


class GeminiError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise GeminiError("GEMINI_API_KEY no configurada en backend/.env")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def chat(messages: list[dict], system: str | None = None) -> str:
    client = _get_client()
    contents = [
        types.Content(role=m["role"], parts=[types.Part(text=m["text"])])
        for m in messages
    ]
    config = types.GenerateContentConfig(system_instruction=system) if system else None
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=config,
        )
    except Exception as e:
        raise GeminiError(str(e))
    if not response.text:
        raise GeminiError("Gemini no devolvió texto")
    return response.text