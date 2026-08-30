"""
Colab entrypoint — start the EmojiMuse API and expose it through a public
tunnel so the browser frontend can reach it.

Usage in a Colab cell (after installing requirements):

    %cd /content/EmojiMuse/backend
    !python colab_server.py

Two tunnels are supported (set EMOJIMUSE_TUNNEL):

    cloudflared  (default) — no signup, no browser warning page
    ngrok                  — needs a free authtoken in NGROK_AUTHTOKEN

Copy the printed https URL into the frontend's "Rig" dialog. It changes
every session — that's expected; the frontend stores it per device.
"""
from __future__ import annotations

import os
import threading

import nest_asyncio
import uvicorn


def _open_ngrok(port: int) -> str:
    from pyngrok import conf, ngrok

    token = os.environ.get("NGROK_AUTHTOKEN")
    if token:
        conf.get_default().auth_token = token
    for t in ngrok.get_tunnels():          # clear stale tunnels from a prior run
        ngrok.disconnect(t.public_url)
    return ngrok.connect(port, "http").public_url


def _open_cloudflared(port: int) -> str:
    # pip install pycloudflared  — downloads the cloudflared binary on first use
    from pycloudflared import try_cloudflare

    return try_cloudflare(port=port).tunnel


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    tunnel = os.environ.get("EMOJIMUSE_TUNNEL", "cloudflared").lower()

    opener = _open_ngrok if tunnel == "ngrok" else _open_cloudflared
    public_url = opener(port)

    print("\n" + "=" * 64)
    print(f"  EmojiMuse API is live at:  {public_url}")
    print(f"  Health check:              {public_url}/health")
    print(f"  Tunnel:                    {tunnel}")
    print("  Paste the URL above into the frontend 'Rig' dialog.")
    print("=" * 64 + "\n")

    nest_asyncio.apply()  # Colab already runs an event loop
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
