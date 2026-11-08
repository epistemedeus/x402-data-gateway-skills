import copy
import io
import json
import unittest
from email.message import Message
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit

import documentation_tool as tool


class Response(io.BytesIO):
    status = 200

    def __init__(self, body, content_type="application/json; charset=utf-8"):
        super().__init__(body)
        self.headers = Message()
        self.headers["Content-Type"] = content_type


REPORT = {
    "schema": "agent-readiness.documentation.v1", "free": True,
    "host": "docs.example.com", "origin": "https://docs.example.com",
    "checks": [
        {"id": "llms-index", "status": "pass", "reason": "Readable text index."},
        {"id": "homepage", "status": "pass", "reason": "Readable HTML."},
        {"id": "sitemap-discovery", "status": "warn", "reason": "Readable sitemap not advertised."},
    ],
    "topFixes": [{"id": "sitemap-discovery", "fix": "Advertise the sitemap in robots.txt."}],
    "evidence": [{"target": "not projected"}],
}


class DocumentationToolTest(unittest.TestCase):
    def call(self, host="docs.example.com"):
        return json.loads(tool.Tools().check_documentation_import(host))

    @patch.object(tool._OPENER, "open")
    def test_real_shape_is_projected_and_input_bound_to_fixed_https_origin(self, request):
        request.return_value = Response(json.dumps(REPORT).encode())
        result = self.call(" Docs.Example.COM. ")
        req = request.call_args.args[0]
        self.assertEqual(request.call_args.kwargs, {"timeout": 12})
        self.assertEqual(request.call_count, 1)
        self.assertEqual(req.get_method(), "GET")
        self.assertEqual(req.header_items(), [("Accept", "application/json")])
        url = urlsplit(req.full_url)
        self.assertEqual((url.scheme, url.netloc, url.path), ("https", "samedaydesk.com", "/agent-readiness"))
        self.assertEqual(parse_qs(url.query), {"host": ["docs.example.com"], "format": ["documentation"]})
        self.assertEqual(set(result), {"host", "checks", "topFixes"})
        self.assertEqual([x["id"] for x in result["checks"]], list(tool._CHECK_IDS))
        self.assertEqual(result["topFixes"], REPORT["topFixes"])

    @patch.object(tool._OPENER, "open")
    def test_ambiguous_and_nonpublic_host_input_makes_no_request(self, request):
        for name in (None, 5, "", "localhost", "router.local", "dev.corp.internal", "10.1.2.3",
                     "2130706433", "0177.0.0.1", "[::1]", "https://docs.example.com/a",
                     "docs.example.com:443", "docs.example.com@other.net", "a..net", "a.com\nHost: b", "x.com?x=1"):
            with self.subTest(name=name):
                self.assertEqual(self.call(name)["error"]["code"], "invalid_public_host")
        request.assert_not_called()

    @patch.object(tool._OPENER, "open")
    def test_malformed_scored_or_wrong_bound_data_is_not_an_observation(self, request):
        variants = [b"{broken", b"\xff", b"x" * (tool._MAX_BYTES + 1)]
        for key, value in (("host", "other.example.com"), ("origin", "https://other.example.com"),
                           ("score", 10), ("free", False), ("checks", [REPORT["checks"][0]] * 3),
                           ("topFixes", [{"id": "homepage", "fix": "Unfounded recommendation"}])):
            report = copy.deepcopy(REPORT)
            report[key] = value
            variants.append(json.dumps(report).encode())
        for body in variants:
            request.return_value = Response(body)
            self.assertEqual(self.call()["error"]["code"], "invalid_report")
        request.return_value = Response(json.dumps(REPORT).encode(), "text/html")
        self.assertEqual(self.call()["error"]["code"], "invalid_report")

    @patch.object(tool._OPENER, "open")
    def test_no_redirect_retry_or_upstream_error_body_exposure(self, request):
        self.assertIsNone(tool._NoRedirect().redirect_request(None, None, 302, "", None, "https://other.example.com"))
        for status, outcome in ((302, "redirect_refused"), (400, "upstream_refused"), (429, "report_unavailable")):
            request.reset_mock()
            request.side_effect = HTTPError("https://irrelevant.test", status, "x", {}, io.BytesIO(b"do not emit"))
            self.assertEqual(self.call()["error"]["code"], outcome)
            self.assertEqual(request.call_count, 1)
        request.side_effect = URLError("raw cause")
        self.assertEqual(self.call()["error"]["code"], "report_unavailable")


if __name__ == "__main__":
    unittest.main()
