/**
 * Test harness for the maintained EIN disposable host.
 * EIN_LEAN_ROOT must be epistemedeus/ein-llc-lean at the continuation source.
 * This process does not author formation, claim, or payment responses.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.EIN_LEAN_ROOT;
const store = process.argv[2];
const spa = process.argv[3];
if (!root || !store || !spa) {
  process.stderr.write("usage: EIN_LEAN_ROOT=... node --experimental-strip-types ein-disposable-host.mjs STORE SPA\n");
  process.exit(2);
}

const { agentCatalog } = await import(pathToFileURL(path.join(root, "artifacts/ein-llc/src/site/lib/agent-capabilities.ts")).href);
mkdirSync(path.join(spa, "api/v1"), { recursive: true });
writeFileSync(path.join(spa, "index.html"), "<!doctype html><title>disposable-catalog</title>\n");
writeFileSync(path.join(spa, "404.html"), "<!doctype html><title>404</title>\n");
const catalog = JSON.stringify(agentCatalog);
writeFileSync(path.join(spa, "api/v1/service-catalog"), catalog);
writeFileSync(path.join(spa, "api/v1/service-catalog.json"), catalog);

const { startDisposableHost } = await import(pathToFileURL(path.join(root, "artifacts/api-server/scripts/disposable-receiving-control.ts")).href);
const extra = { SPA_DIST_DIR: spa };
if (process.env.EIN_PREPARE_FAILPOINT) extra.EIN_PREPARE_FAILPOINT = process.env.EIN_PREPARE_FAILPOINT;
const host = await startDisposableHost({ after() {} }, store, extra);
process.stdout.write(`PORT ${new URL(host.base).port}\n`);

await new Promise((resolve) => {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    if (String(chunk).includes("stop")) resolve();
  });
  process.stdin.on("end", resolve);
});
await host.stop();
