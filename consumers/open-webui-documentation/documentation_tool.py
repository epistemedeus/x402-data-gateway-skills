"""
title: SameDayDesk documentation import check
author: SameDayDesk
version: 0.1.0
description: Inspect public documentation discovery before adding a website to a knowledge base.
"""

import ipaddress
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


_ENDPOINT = "https://samedaydesk.com/agent-readiness"
_SCHEMA = "agent-readiness.documentation.v1"
_CHECK_IDS = ("homepage", "sitemap-discovery", "llms-index")
_STATUSES = {"pass", "warn", "fail", "unknown"}
_HOST_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", re.ASCII)
_LOCAL_SUFFIXES = {"local", "localhost", "internal", "lan", "onion", "test", "invalid", "example", "home", "arpa"}
_MAX_BYTES = 32768


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_OPENER = build_opener(ProxyHandler({}), _NoRedirect())


def _host(value):
    if not isinstance(value, str):
        return None
    host = value.strip().lower().removesuffix(".")
    if not (1 <= len(host) <= 253):
        return None
    labels = host.split(".")
    if (len(labels) < 2 or labels[-1] in _LOCAL_SUFFIXES or labels[-1].isdigit()
            or not all(_HOST_LABEL.fullmatch(label) for label in labels)):
        return None
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return host
    return None


def _error(code, next_step):
    return json.dumps({"error": {"code": code, "nextStep": next_step}})


def _short(value):
    return isinstance(value, str) and 0 < len(value) <= 800 and bool(value.strip())


def _project(report, host):
    if (not isinstance(report, dict) or report.get("schema") != _SCHEMA
            or report.get("free") is not True or report.get("host") != host
            or report.get("origin") != f"https://{host}" or "score" in report):
        raise ValueError("report identity")
    raw_checks, raw_fixes = report.get("checks"), report.get("topFixes")
    if not isinstance(raw_checks, list) or len(raw_checks) != len(_CHECK_IDS):
        raise ValueError("report checks")
    checks = {}
    for check in raw_checks:
        if not isinstance(check, dict):
            raise ValueError("check shape")
        key, status, reason = check.get("id"), check.get("status"), check.get("reason")
        if (not isinstance(key, str) or key not in _CHECK_IDS or key in checks
                or not isinstance(status, str) or status not in _STATUSES or not _short(reason)):
            raise ValueError("check fields")
        checks[key] = {"id": key, "status": status, "reason": reason}
    if not isinstance(raw_fixes, list) or len(raw_fixes) > len(_CHECK_IDS):
        raise ValueError("report fixes")
    fixes = {}
    for item in raw_fixes:
        if not isinstance(item, dict):
            raise ValueError("fix shape")
        key, fix = item.get("id"), item.get("fix")
        if (not isinstance(key, str) or key not in checks or key in fixes
                or checks[key]["status"] == "pass" or not _short(fix)):
            raise ValueError("fix fields")
        fixes[key] = {"id": key, "fix": fix}
    return {"host": host, "checks": [checks[key] for key in _CHECK_IDS], "topFixes": list(fixes.values())}


class Tools:
    def check_documentation_import(self, host: str) -> str:
        """Check one public hostname before importing its docs. A pass is not ingestion or citation proof.

        :param host: A bare public DNS hostname, for example docs.openwebui.com. Do not pass a URL, IP, or private hostname.
        :return: A JSON string containing the three discovery checks and their suggested fixes, or a bounded error.
        """
        public_host = _host(host)
        if public_host is None:
            return _error("invalid_public_host", "Provide one bare public documentation hostname, without a URL or IP address.")

        query = urlencode({"host": public_host, "format": "documentation"})
        request = Request(f"{_ENDPOINT}?{query}", headers={"Accept": "application/json"}, method="GET")
        try:
            with _OPENER.open(request, timeout=12) as response:
                if response.status != 200 or response.headers.get_content_type() != "application/json":
                    raise ValueError("response type")
                body = response.read(_MAX_BYTES + 1)
                if len(body) > _MAX_BYTES:
                    raise ValueError("response size")
                return json.dumps(_project(json.loads(body.decode("utf-8")), public_host), ensure_ascii=True)
        except HTTPError as error:
            error.close()
            if error.code == 400:
                return _error("upstream_refused", "Check that the host is publicly reachable over HTTPS.")
            if 300 <= error.code < 400:
                return _error("redirect_refused", "The report endpoint changed location. Check the published tool instructions.")
            return _error("report_unavailable", "No report was received. Use a direct source check or try again later.")
        except (URLError, TimeoutError, OSError):
            return _error("report_unavailable", "No report was received. Use a direct source check or try again later.")
        except (ValueError, UnicodeError, RecursionError):
            return _error("invalid_report", "No report was trusted. Use a direct source check instead.")
