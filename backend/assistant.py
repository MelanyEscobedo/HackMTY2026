"""
The assistant "brain" -- one Gemini tool-use loop shared by every interface
that talks to it: the in-app chat and its spoken replies (voice.py, via
ElevenLabs). It calls the exact same compute_* functions main.py's HTTP
routes use (imported from main.py below), so nothing here can ever
disagree with what the app shows on screen.

Four things it can actually do, on purpose: check balance, check for an
active fraud alert, freeze/unfreeze the card, get a spending summary.

Uses Google's Gemini API (free tier, no card required) instead of a paid
API -- swap this file out for a different provider later if you want to;
main.py and voice.py only ever call run_agent_turn(), nothing else here
is a public interface.

Required env var (add to .env):
    GOOGLE_API_KEY=...   # your own free key from aistudio.google.com/apikey
"""

import os

from google import genai
from google.genai import types

import main as backend  # reuse compute_risk / compute_spending / etc. directly
import frozen_store

# Grounded against the installed google-genai SDK's own docstring example
# (not guessed) -- check ai.google.dev/gemini-api/docs/models for a newer
# free-tier "flash" model if this one 404s or gets retired.
MODEL = "gemini-3.6-flash"

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY not set -- get your own free key at "
                "aistudio.google.com/apikey (no credit card needed) and "
                "add it to .env."
            )
        _client = genai.Client(api_key=api_key)
    return _client


SYSTEM_PROMPT = """\
You are Hopscotch, an in-app banking assistant. You help one customer, \
Maria Hopper, check her balance, review a possible fraud alert, freeze her \
card, and see a spending summary -- using the tools provided. Only use the \
tools; never invent numbers yourself.

Reply in the same language the customer writes in (Spanish or English). \
Keep replies short -- 2-4 sentences, meant to be read on a phone screen AND \
read aloud by a text-to-speech voice, not an essay. Be warm but direct, \
like a competent human support agent, not a chatbot reading a script. When \
a tool result includes an explanation or category sequence, translate it \
into plain conversational language rather than dumping raw fields.
"""

# Plain JSON Schema, same shape regardless of which model provider reads
# it -- built into a Gemini FunctionDeclaration list below via
# parameters_json_schema (confirmed by inspecting the installed SDK: that
# field takes a raw JSON Schema dict directly, unlike `parameters`, which
# wants Google's own Schema type).
TOOL_SPECS = [
    {
        "name": "get_balance",
        "description": "Get the customer's current checking account balance.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_active_alert",
        "description": "Check whether there's a current fraud alert on the "
                        "account, including the risk score and why it was "
                        "flagged (or confirmation that nothing looks unusual).",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "freeze_card",
        "description": "Freeze (or unfreeze) the customer's card. Use freeze "
                        "when the customer says a transaction wasn't them, "
                        "asks to freeze/block/lock their card, or reports "
                        "their card lost or stolen. Use unfreeze only if "
                        "they explicitly ask to unfreeze/unblock it.",
        "input_schema": {
            "type": "object",
            "properties": {
                "freeze": {
                    "type": "boolean",
                    "description": "true to freeze the card, false to unfreeze it.",
                }
            },
            "required": ["freeze"],
        },
    },
    {
        "name": "get_spending_summary",
        "description": "Get a breakdown of where the customer's money went "
                        "this period, by category, plus any recurring "
                        "charges that look like subscriptions.",
        "input_schema": {"type": "object", "properties": {}},
    },
]

GEMINI_TOOL = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name=spec["name"],
        description=spec["description"],
        parameters_json_schema=spec["input_schema"],
    )
    for spec in TOOL_SPECS
])


def execute_tool(name: str, tool_input: dict) -> dict:
    """Runs a tool against the SAME functions main.py's HTTP routes call."""
    account = backend.get_demo_account()
    account_id = account["account_id"]

    if name == "get_balance":
        return {
            "balance": account["balance"],
            "nickname": account["nickname"],
            "frozen": account["frozen"],
        }

    if name == "get_active_alert":
        try:
            return backend.compute_risk(account_id)
        except ValueError as e:
            return {"error": str(e)}

    if name == "freeze_card":
        freeze = bool(tool_input.get("freeze", True))
        frozen_store.set_frozen(account_id, freeze)
        return {"account_id": account_id, "frozen": freeze}

    if name == "get_spending_summary":
        spending = backend.compute_spending(account_id)
        leaks = backend.compute_leaks(account_id)
        return {**spending, "leaks": leaks["leaks"]}

    return {"error": f"Unknown tool: {name}"}


def run_agent_turn(user_message: str) -> str:
    """
    One full tool-use loop: send the message + tool definitions to Gemini,
    execute whatever tools it picks, feed results back, repeat until Gemini
    responds with plain text instead of a function call. Every interface
    that talks to the assistant just calls this one function.
    """
    client = get_client()
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[GEMINI_TOOL],
        max_output_tokens=400,
    )
    contents = [user_message]  # the SDK accepts a plain string as a turn

    for _ in range(5):  # hard cap so a confused loop can't run forever
        response = client.models.generate_content(
            model=MODEL, contents=contents, config=config
        )

        calls = response.function_calls
        if not calls:
            return (response.text or "").strip() or \
                "Lo siento, no pude procesar eso. / Sorry, I couldn't process that."

        # The model's own function-call turn has to go back into the
        # conversation as-is before the tool results, or Gemini rejects
        # the next call -- matches the SDK's own automatic-function-
        # calling loop internally (verified by reading its source).
        contents.append(response.candidates[0].content)

        response_parts = [
            types.Part.from_function_response(
                name=call.name, response=execute_tool(call.name, call.args or {})
            )
            for call in calls
        ]
        contents.append(types.Content(role="user", parts=response_parts))

    return "Estoy teniendo problemas para responder eso ahora mismo. Intenta de nuevo en un momento."
