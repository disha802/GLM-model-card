"""
Local dev entrypoint.  `python run_local.py`

Equivalent to `uvicorn app.main:app --reload`, but keeps the command short
and forces CPU-friendly defaults if there's no GPU.
"""
from __future__ import annotations

import os

os.environ.setdefault("EMOJIMUSE_WARMUP", "false")  # don't block dev startup

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
    )
