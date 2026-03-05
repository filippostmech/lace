#!/usr/bin/env python3
"""
LACE Headless Launcher

Starts all three components needed for headless agent-driven Python execution:
1. Express server (serves the LACE React app)
2. LACE Host (FastAPI server with REST API + WebSocket relay)
3. Headless Chromium (loads LACE app, acts as compute node)

Usage:
    python headless.py
    python headless.py --app-port 5000 --host-port 8080
    python headless.py --no-app  # if Express is already running
"""

import argparse
import atexit
import os
import signal
import subprocess
import sys
import threading
import time

import requests
from playwright.sync_api import sync_playwright


def drain_pipe(pipe, prefix):
    for line in iter(pipe.readline, b""):
        text = line.decode("utf-8", errors="replace").rstrip()
        if text:
            print(f"[{prefix}] {text}")
    pipe.close()


def start_drain_thread(proc, prefix):
    t = threading.Thread(target=drain_pipe, args=(proc.stdout, prefix), daemon=True)
    t.start()
    return t


def wait_for_http(url: str, timeout: int = 30, label: str = "service"):
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(url, timeout=2)
            if resp.status_code == 200:
                return True
        except requests.ConnectionError:
            pass
        except requests.Timeout:
            pass
        time.sleep(1)
    return False


def main():
    parser = argparse.ArgumentParser(description="LACE Headless Launcher")
    parser.add_argument("--app-port", type=int, default=5000, help="Express server port (default: 5000)")
    parser.add_argument("--host-port", type=int, default=8080, help="LACE Host FastAPI port (default: 8080)")
    parser.add_argument("--app-dir", type=str, default=None, help="Path to LACE project root (default: parent of host/)")
    parser.add_argument("--no-app", action="store_true", help="Skip starting Express (if already running)")
    parser.add_argument("--no-host", action="store_true", help="Skip starting LACE Host (if already running)")
    parser.add_argument("--connect-timeout", type=int, default=90, help="Timeout waiting for browser to connect (default: 90s)")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = args.app_dir or os.path.dirname(script_dir)

    processes = []
    browser = None
    playwright_instance = None

    def cleanup():
        nonlocal browser, playwright_instance
        print("\n[headless] Shutting down...")
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        if playwright_instance:
            try:
                playwright_instance.stop()
            except Exception:
                pass
        for proc in processes:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        print("[headless] Stopped.")

    atexit.register(cleanup)
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))

    if not args.no_app:
        print(f"[headless] Starting Express server on port {args.app_port}...")
        app_env = os.environ.copy()
        app_env["PORT"] = str(args.app_port)
        app_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=app_dir,
            env=app_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        processes.append(app_proc)
        start_drain_thread(app_proc, "express")

        app_url = f"http://127.0.0.1:{args.app_port}"
        print(f"[headless] Waiting for Express at {app_url}...")
        if not wait_for_http(app_url, timeout=30, label="Express"):
            print("[headless] ERROR: Express server did not start in time.")
            sys.exit(1)
        print(f"[headless] Express is ready at {app_url}")
    else:
        app_url = f"http://127.0.0.1:{args.app_port}"
        print(f"[headless] Skipping Express start (expecting it at {app_url})")

    if not args.no_host:
        print(f"[headless] Starting LACE Host on port {args.host_port}...")
        host_proc = subprocess.Popen(
            [
                sys.executable, "-m", "uvicorn",
                "server:app",
                "--host", "127.0.0.1",
                "--port", str(args.host_port),
            ],
            cwd=script_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        processes.append(host_proc)
        start_drain_thread(host_proc, "host")

        host_status_url = f"http://127.0.0.1:{args.host_port}/v1/status"
        print(f"[headless] Waiting for LACE Host at {host_status_url}...")
        if not wait_for_http(host_status_url, timeout=15, label="LACE Host"):
            print("[headless] ERROR: LACE Host did not start in time.")
            sys.exit(1)
        print(f"[headless] LACE Host is ready on port {args.host_port}")
    else:
        host_status_url = f"http://127.0.0.1:{args.host_port}/v1/status"
        print(f"[headless] Skipping LACE Host start (expecting it at port {args.host_port})")

    ws_url = f"ws://127.0.0.1:{args.host_port}/ws"

    print("[headless] Launching headless Chromium...")
    playwright_instance = sync_playwright().start()
    chromium = playwright_instance.chromium
    browser = chromium.launch(headless=True)
    context = browser.new_context()

    context.add_init_script(f"""
        window.localStorage.setItem('lace-host-url', '{ws_url}');
    """)

    page = context.new_page()

    page.on("console", lambda msg: None)
    page.on("pageerror", lambda err: print(f"[browser] Page error: {err}"))

    print(f"[headless] Navigating to {app_url}...")
    page.goto(app_url, wait_until="networkidle")
    print("[headless] Page loaded. Waiting for WebSocket connection to Host...")

    start = time.time()
    connected = False
    while time.time() - start < args.connect_timeout:
        try:
            resp = requests.get(host_status_url, timeout=2)
            data = resp.json()
            if data.get("connected"):
                connected = True
                break
        except Exception:
            pass
        time.sleep(2)

    if not connected:
        print("[headless] ERROR: Browser did not connect to LACE Host within timeout.")
        print("[headless] The LACE app may need the host URL configured in its UI.")
        sys.exit(1)

    api_url = f"http://127.0.0.1:{args.host_port}"
    print()
    print("=" * 60)
    print("  LACE is running headless")
    print("=" * 60)
    print()
    print(f"  Submit jobs:   POST {api_url}/v1/jobs/python")
    print(f"  Get results:   GET  {api_url}/v1/jobs/{{id}}")
    print(f"  Stream logs:   GET  {api_url}/v1/jobs/{{id}}/stream")
    print(f"  Check status:  GET  {api_url}/v1/status")
    print(f"  API docs:      {api_url}/docs")
    print()
    print("  Press Ctrl+C to stop")
    print()

    try:
        while True:
            for proc in processes:
                if proc.poll() is not None:
                    print(f"[headless] A subprocess exited unexpectedly (code {proc.returncode}). Shutting down.")
                    sys.exit(1)
            time.sleep(5)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
