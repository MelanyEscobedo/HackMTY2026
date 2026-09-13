"""
Thin wrapper around ElevenLabs' text-to-speech REST API. Gemini (see
assistant.py) still decides what the assistant says -- this module only
turns that text into real spoken audio. One function, one job.

Docs: https://elevenlabs.io/docs/api-reference/text-to-speech

Required env vars (add to .env):
    ELEVENLABS_API_KEY=...                       # your own key from elevenlabs.io
    ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM      # optional -- defaults to
        "Rachel", a standard premade voice every ElevenLabs account has.
        Swap in any voice id from your own Voice Library
        (elevenlabs.io/app/voice-library) for a different one.
"""

import os

import requests

TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel"


class ElevenLabsError(Exception):
    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body
        super().__init__(f"ElevenLabs TTS failed [{status_code}]: {body}")


def synthesize_speech(text: str) -> bytes:
    """Returns raw MP3 bytes of `text` spoken in the configured voice."""
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ELEVENLABS_API_KEY not set -- this is YOUR OWN key from "
            "elevenlabs.io, add it to .env."
        )
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE_ID

    resp = requests.post(
        TTS_URL.format(voice_id=voice_id),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text,
            "model_id": "eleven_multilingual_v2",  # handles the Spanish/English mix
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        timeout=20,
    )
    if resp.status_code != 200:
        raise ElevenLabsError(resp.status_code, resp.text)
    return resp.content
