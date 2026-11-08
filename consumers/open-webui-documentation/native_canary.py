#!/usr/bin/env python3
"""Disposable Open WebUI v0.13.0 native Workspace Tool acceptance canary.

The fixture is a synthetic Chat Completions model, not a tool substitute. It
selects the tool Open WebUI actually offers, then verifies the real result on
the native second request. Never expose these two listeners beyond task scope.
"""

import argparse
import hashlib
import json
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


VERSION = "0.13.0"
MODEL = "owui-documentation-fixture"
TOOL_ID = "samedaydesk_docs"  # Native tool IDs must be Python identifiers.
TOOL_METHOD = "check_documentation_import"
SCENARIOS = {"public": "docs.openma.ai", "private": "localhost"}
CHECKS = {"homepage", "sitemap-discovery", "llms-index"}
MAX_BODY = 1024 * 1024


class ContractError(ValueError):
    """Only fixed, non-sensitive messages may be exposed from this error."""


def require(condition, message):
    if not condition:
        raise ContractError(message)


def encoded(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True).encode()


def marker(case):
    return "[owui-documentation-canary:" + case + "]"


def decode_result(content):
    # Tool output can be a string or a list of text parts on the native route.
    for _ in range(4):
        if isinstance(content, dict) and {"host", "error"}.intersection(content):
            return content
        if isinstance(content, list):
            require(len(content) == 1, "unexpected tool content parts")
            content = content[0]
        elif isinstance(content, dict) and isinstance(content.get("text"), str):
            content = content["text"]
        elif isinstance(content, str):
            content = json.loads(content)
        else:
            break
    raise ValueError("missing structured Tool result")


def verify_result(case, content):
    result = decode_result(content)
    if case == "private":
        require(result.get("error", {}).get("code") == "invalid_public_host",
                "expected native invalid_public_host refusal")
        require("checks" not in result, "private input produced a report")
        evidence = {"host": SCENARIOS[case], "errorCode": "invalid_public_host"}
    else:
        require(result.get("host") == SCENARIOS[case] and "error" not in result,
                "public Tool host/result mismatch")
        checks = result.get("checks")
        require(isinstance(checks, list) and len(checks) == len(CHECKS)
                and all(isinstance(check, dict) for check in checks),
                "missing public Tool checks")
        require({check.get("id") for check in checks} == CHECKS,
                "unexpected public Tool check IDs")
        require(all(isinstance(check.get("status"), str) and check["status"]
                    and isinstance(check.get("reason"), str) and check["reason"]
                    for check in checks), "missing public Tool status/reason")
        require(isinstance(result.get("topFixes"), list), "missing public Tool topFixes")
        sitemap = next(check for check in checks if check["id"] == "sitemap-discovery")
        require(sitemap["status"] == "pass" and "/sitemap-index.xml" in sitemap["reason"],
                "the expected robots-advertised sitemap index was not identified")
        evidence = {"host": result["host"],
                    "checks": {check["id"]: check["status"] for check in checks},
                    "sitemapIndex": "/sitemap-index.xml",
                    "topFixesCount": len(result["topFixes"])}
    return {**evidence, "resultSha256": hashlib.sha256(encoded(result)).hexdigest()}


class Fixture(BaseHTTPRequestHandler):
    receipts = {}
    sent = set()
    lock = threading.Lock()

    def log_message(self, _format, *_args):
        pass  # Never log request bodies, transport headers, or fixture credentials.

    def reply(self, status, payload):
        body = encoded(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/healthz":
            return self.reply(200, {"ok": True, "model": MODEL})
        if path == "/receipt":
            with self.lock:
                return self.reply(200, {"model": MODEL, "nativeResults": self.receipts.copy()})
        if path == "/v1/models":
            return self.reply(200, {"object": "list", "data": [
                {"id": MODEL, "object": "model", "created": 0, "owned_by": "fixture"}]})
        return self.reply(404, {"error": "unknown fixture route"})

    def stream_completion(self, case, delta, reason):
        def frame(item, finish=None):
            return b"data: " + encoded({"id": "chatcmpl-owui-canary-" + case,
                "object": "chat.completion.chunk", "created": int(time.time()), "model": MODEL,
                "choices": [{"index": 0, "delta": item, "finish_reason": finish}]}) + b"\n\n"

        body = (frame({"role": "assistant"}) + frame(delta) + frame({}, reason)
                + b"data: [DONE]\n\n")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        self.wfile.flush()

    def do_POST(self):
        if urlsplit(self.path).path != "/v1/chat/completions":
            return self.reply(404, {"error": "unknown fixture route"})
        try:
            self.connection.settimeout(10)
            length = int(self.headers.get("Content-Length", "0"))
            require(0 < length <= MAX_BODY, "unbounded fixture request")
            payload = json.loads(self.rfile.read(length))
            require(payload.get("model") == MODEL and payload.get("stream") is True,
                    "expected streaming native fixture model")
            messages = payload["messages"]
            user_messages = [json.dumps(m.get("content")) for m in messages if m.get("role") == "user"]
            cases = [case for case in SCENARIOS if any(marker(case) in msg for msg in user_messages)]
            require(len(cases) == 1, "unrecognized fixture conversation")
            case = cases[0]
            call_id = "call_owui_documentation_" + case
            tool_results = [m for m in messages if m.get("role") == "tool"]
            if tool_results:
                require(len(tool_results) == 1 and tool_results[0].get("tool_call_id") == call_id,
                        "native Tool result not correlated to first request")
                evidence = verify_result(case, tool_results[0].get("content"))
                with self.lock:
                    require(case in self.sent and case not in self.receipts,
                            "missing or duplicated native Tool effect")
                    self.receipts[case] = evidence
                return self.stream_completion(case, {"content": "native-canary-verified:" + case}, "stop")

            functions = [tool.get("function", {}) for tool in payload.get("tools", [])
                         if tool.get("type") == "function"]
            require(len(functions) == 1 and functions[0].get("name", "").endswith(TOOL_METHOD),
                    "Open WebUI did not offer exactly the workspace Tool")
            function = functions[0]
            require("host" in function.get("parameters", {}).get("properties", {}),
                    "native Tool schema missing host")
            with self.lock:
                require(case not in self.sent, "duplicate native Tool selection")
                self.sent.add(case)
            call = {"index": 0, "id": call_id, "type": "function", "function": {
                "name": function["name"], "arguments": encoded({"host": SCENARIOS[case]}).decode()}}
            return self.stream_completion(case, {"tool_calls": [call]}, "tool_calls")
        except (KeyError, TypeError, ValueError, OSError) as error:
            # Only our fixed contract checks may reveal a message. Parser
            # errors and transport failures can include request content.
            reason = str(error) if isinstance(error, ContractError) else type(error).__name__
            return self.reply(422, {"error": {"message": "fixture contract: " + reason}})


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def request_json(base, path, *, method="GET", body=None, token=None, timeout=15):
    url = urlsplit(base)
    require(url.scheme == "http" and url.hostname == "127.0.0.1"
            and not (url.username or url.password or url.path or url.query or url.fragment),
            "canary clients require an exact loopback base URL")
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request(base + path, data=encoded(body) if body is not None else None,
                      headers=headers, method=method)
    try:
        with build_opener(ProxyHandler({}), NoRedirect()).open(request, timeout=timeout) as response:
            raw = response.read(MAX_BODY + 1)
            require(len(raw) <= MAX_BODY, "oversized canary response")
            return json.loads(raw) if raw else None
    except HTTPError as error:
        raise RuntimeError(f"{method} {path}: HTTP {error.code}") from None


def run_case(base, token, case):
    user, assistant = str(uuid.uuid4()), str(uuid.uuid4())
    now = int(time.time())
    prompt = f"{marker(case)} Check documentation import for {SCENARIOS[case]}."
    messages = {
        user: {"id": user, "role": "user", "content": prompt, "timestamp": now,
               "models": [MODEL], "childrenIds": [assistant]},
        assistant: {"id": assistant, "role": "assistant", "content": "", "parentId": user,
                    "childrenIds": [], "model": MODEL, "modelName": MODEL, "modelIdx": 0,
                    "done": False, "timestamp": now + 1},
    }
    chat = request_json(base, "/api/v1/chats/new", method="POST", token=token, body={"chat": {
        "title": "Disposable native documentation canary", "models": [MODEL],
        "history": {"currentId": assistant, "messages": messages}}})
    chat_id = str(uuid.UUID(chat["id"]))
    request_json(base, "/api/chat/completions", method="POST", token=token, timeout=55, body={
        "model": MODEL, "messages": [{"role": "user", "content": prompt}],
        "stream": True, "chat_id": chat_id, "id": assistant, "tool_ids": [TOOL_ID],
        "params": {"function_calling": "native"}, "background_tasks": {
            "title_generation": False, "tags_generation": False, "follow_up_generation": False}})
    received = request_json(base, "/api/v1/chats/" + chat_id, token=token)
    reply = received["chat"]["history"]["messages"][assistant]
    require(reply.get("done") is True and ("native-canary-verified:" + case) in reply.get("content", ""),
            "native model completion not received in Open WebUI chat")
    outputs = [item for item in reply.get("output", [])
               if item.get("type") == "function_call_output"
               and item.get("call_id") == "call_owui_documentation_" + case]
    require(len(outputs) == 1, "Open WebUI chat lacks its correlated native Tool output")
    return verify_result(case, outputs[0].get("output"))


def receive(base, fixture):
    version = request_json(base, "/api/version")
    require(version.get("version") == VERSION, "unexpected Open WebUI release")
    require(request_json(fixture, "/receipt").get("nativeResults") == {}, "fixture already used")
    # This is the upstream built-in disposable system principal, not a real
    # account/password; the temporary JWT never leaves the receiver process.
    local = request_json(base, "/api/v1/auths/signin", method="POST", body={
        "email": "admin@localhost", "password": "admin"})
    token = local.get("token")
    require(isinstance(token, str) and token.count(".") == 2 and local.get("role") == "admin",
            "disposable system admin JWT not received")
    models = request_json(base, "/api/models", token=token)
    require([item["id"] for item in models.get("data", [])] == [MODEL],
            "model list must contain only the disposable fixture")
    source = Path(__file__).with_name("documentation_tool.py").read_text(encoding="utf-8")
    created = request_json(base, "/api/v1/tools/create", method="POST", token=token, body={
        "id": TOOL_ID, "name": "SameDayDesk Documentation Import Check", "content": source,
        "meta": {"description": "Check the public documentation discovery contract before import."}})
    require(created.get("id") == TOOL_ID, "native Tool creation identity mismatch")
    stored = request_json(base, "/api/v1/tools/id/" + TOOL_ID, token=token)
    require(stored.get("content") == source, "native Tool source readback mismatch")
    outcomes = {case: run_case(base, token, case) for case in SCENARIOS}
    external = request_json(fixture, "/receipt")
    require(external.get("nativeResults") == outcomes, "Tool output differs across fixture and chat")
    print(json.dumps({"ok": True, "openWebui": VERSION, "model": MODEL, "toolId": TOOL_ID,
                      "nativeResults": outcomes, "paidProviderUsed": False,
                      "externalAccountCreated": False}, sort_keys=True))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest="mode", required=True)
    fixture = modes.add_parser("fixture")
    fixture.add_argument("--port", type=int, default=9001)
    receiver = modes.add_parser("receive")
    receiver.add_argument("--base", default="http://127.0.0.1:8765")
    receiver.add_argument("--fixture", default="http://127.0.0.1:9001")
    args = parser.parse_args()
    if args.mode == "fixture":
        ThreadingHTTPServer(("0.0.0.0", args.port), Fixture).serve_forever()
    else:
        receive(args.base, args.fixture)


if __name__ == "__main__":
    main()
