"""
Nessie's sandbox has no concept of "freezing" a card -- there's no real
issuer/network behind it to actually block a transaction. For the demo, we
simulate the freeze as local state: a small JSON file recording which
account IDs are "frozen". Both the API (main.py) and the chat assistant
(assistant.py) read/write through here so they agree on the state.

In a real product this would call your card processor's actual freeze API
instead of writing a file -- this is a hackathon stand-in, not a security
boundary.
"""

import json
import os
from threading import Lock

_FILE = "frozen_accounts.json"
_lock = Lock()


def _read() -> dict:
    if not os.path.exists(_FILE):
        return {}
    with open(_FILE) as f:
        return json.load(f)


def _write(data: dict):
    with open(_FILE, "w") as f:
        json.dump(data, f, indent=2)


def is_frozen(account_id: str) -> bool:
    with _lock:
        return bool(_read().get(account_id, False))


def set_frozen(account_id: str, frozen: bool) -> None:
    with _lock:
        data = _read()
        data[account_id] = frozen
        _write(data)
