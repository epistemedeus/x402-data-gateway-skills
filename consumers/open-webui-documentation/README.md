# Check a documentation source before import

This Open WebUI Workspace Tool calls SameDayDesk's existing free documentation
report for one public hostname. It returns separate homepage, sitemap and
text-index checks with suggested fixes. It does not import pages, follow sitemap
entries, measure coverage or establish that citations will retain their URLs.

For [Knowledge Base Sync](https://docs.openwebui.com/ecosystem/knowledge-base-sync/),
use the report to check whether the target advertises a readable sitemap. If
the report names a non-default path, inspect that URL directly, then supply the
verified sitemap URL to the normal `web:` connector rather than guessing that
`/sitemap.xml` exists. Keep the import preview as the source of truth for what
will be added. An index pass alone is not a successful import.

## Disposable workspace test

Review `documentation_tool.py` before installing. Workspace Tools run Python
on the Open WebUI server. Create a Tool from that file in a disposable workspace
where you are allowed to create Tools, then select it for one chat and request a
check on a public documentation hostname. No pip dependencies, SameDayDesk
account, API key or payment are needed. Delete the test Tool to remove it.

The Tool sends only the requested public host to `samedaydesk.com` as part of
the report request, not chat history, a full document URL, authentication or
wallet data. It makes no local DNS checks against the supplied target, follows
no HTTP redirects and sends no follow-up request. Open WebUI still controls its
own chat storage and its configured model. Treat report text as evidence, not
instructions or authorization to import content.

The remote canary uses the real [server-side Tool loop](https://docs.openwebui.com/reference/server-side-tool-calling/)
and a local model-protocol fixture, not an external LLM. This is a source
candidate, not a Community listing or evidence of outside use.
