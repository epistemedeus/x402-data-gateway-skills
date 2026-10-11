import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PIN } from "../skills/samedaydesk-task-result/scripts/task-result.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoScript = path.join(root, "skills/samedaydesk-task-result/scripts/task-result.mjs");
const script = process.env.SAMEDAYDESK_TASK_RESULT_SCRIPT
  ? path.resolve(process.env.SAMEDAYDESK_TASK_RESULT_SCRIPT)
  : repoScript;
const merchant = process.env.SAMEDAYDESK_CURRENT_MERCHANT
  ? path.resolve(process.env.SAMEDAYDESK_CURRENT_MERCHANT)
  : "";
const MERCHANT_COMMIT = "838abb50ec9ddac9e93d39d9f8c91f1f3ca44a35";
const merchantReady = merchant !== "" && existsSync(path.join(merchant, "fixtures/mcp-task-recovery-loopback.mjs"));
const skipMerchant = merchantReady ? false : "Set SAMEDAYDESK_CURRENT_MERCHANT to merchant checkout 838abb50ec9ddac9e93d39d9f8c91f1f3ca44a35";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const payer = `0x${"2".repeat(40)}`;
const taskArgs = {
  rewardUsd: 10, hours: 1, hourlyCostUsd: 1, selectionProbabilityPct: 80,
  agentAccess: "agent_allowed", acceptance: "deterministic", settlement: "direct",
};

const DIRECT_CLIENT = `
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [caller, action, operationPath, checkpoint, grantPath] = process.argv.slice(2);
const { Client } = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js")).href);
const { StreamableHTTPClientTransport } = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js")).href);
const recovery = await import(pathToFileURL(path.join(caller, "src/mcp-recovery.mjs")).href);
const names = [];
let sdk;
let connected;
async function endpoint() {
  if (action === "start") return JSON.parse(await readFile(operationPath, "utf8")).endpointUrl;
  return JSON.parse(await readFile(checkpoint, "utf8")).input.endpointUrl;
}
const client = {
  async listTools(...args) {
    sdk ??= new Client({ name: "direct-installed-caller", version: "0.1.1" });
    connected ??= sdk.connect(new StreamableHTTPClientTransport(new URL(await endpoint())));
    await connected;
    return sdk.listTools(...args);
  },
  async callTool(...args) {
    names.push(args[0]?.name ?? null);
    return sdk.callTool(...args);
  },
  getToolOutputValidator: (...args) => sdk.getToolOutputValidator(...args),
  close: () => sdk?.close?.() ?? Promise.resolve(),
};
const loadGrant = async () => JSON.parse(await readFile(grantPath, "utf8"));
const store = recovery.mcpRecoveryFileStore(path.resolve(checkpoint));
try {
  const handle = action === "start"
    ? await recovery.startPaidMcpResult({ client, store, input: JSON.parse(await readFile(operationPath, "utf8")), loadGrant })
    : await recovery.resumePaidMcpResult({ client, store, loadGrant });
  const saved = await handle.handoff();
  const budget = saved?.state ? recovery.mcpRecoveryBudget(saved) : null;
  const result = saved?.result ?? null;
  process.stdout.write(JSON.stringify({
    state: saved?.state ?? null,
    failure: saved?.failure ?? null,
    toolCalls: names,
    structuredContent: result?.structuredContent ?? null,
    isError: result?.isError === true,
    recoveryVersion: result?._meta?.["samedaydesk/recovery"]?.version ?? null,
    hasMeta: Boolean(result?._meta),
    budget: budget && {
      reportedSettledAtomic: budget.reportedSettledAtomic,
      possibleAtomic: budget.possibleAtomic,
      newPaymentPermitted: budget.newPaymentPermitted,
      usefulness: budget.usefulness,
    },
  }) + "\\n");
} catch (error) {
  process.stdout.write(JSON.stringify({
    state: null,
    failure: typeof error?.code === "string" ? error.code : "failed",
    toolCalls: names,
  }) + "\\n");
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
`;

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

function runScript(args, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C", LC_ALL: "C" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      let body = null;
      try { body = JSON.parse(stdout); } catch { body = null; }
      resolve({ code, body, stdout, stderr, pid: child.pid });
    });
  });
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
}

let acquired;
function acquireCaller() {
  acquired ??= (async () => {
    const work = path.join(await mkdtemp(path.join(tmpdir(), "task-result-journey-")), "work");
    const result = await runScript(["acquire", "--work", work, "--install", "yes"], 180_000);
    if (result.code !== 0 || result.body?.outcome !== "acquired") {
      throw new Error(`acquire failed ${result.code} ${result.stdout} ${result.stderr}`);
    }
    return { work: path.dirname(work), caller: result.body.callerDir, body: result.body };
  })();
  return acquired;
}

async function openSdk() {
  const clientHref = pathToFileURL(path.join(merchant, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js")).href;
  const transportHref = pathToFileURL(path.join(merchant, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js")).href;
  const [clientMod, transportMod] = await Promise.all([import(clientHref), import(transportHref)]);
  return { Client: clientMod.Client, Transport: transportMod.StreamableHTTPClientTransport };
}

async function fixture(t, { unknown = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "merchant-journey-"));
  const dataDir = path.join(directory, "merchant");
  await mkdir(dataDir);
  const counts = { verify: 0, settle: 0, markerBeforeSettlement: false };
  const facilitator = createServer(async (req, res) => {
    let output;
    if (req.url === "/supported") {
      output = { kinds: [{ network: "eip155:8453", scheme: "exact", x402Version: 2 }], extensions: [], signers: {} };
    } else if (req.url === "/verify") {
      counts.verify += 1;
      output = { isValid: true, payer };
    } else if (req.url === "/settle") {
      counts.settle += 1;
      const journal = JSON.parse(await readFile(path.join(dataDir, "idempotency-replay.json"), "utf8"));
      counts.markerBeforeSettlement = journal.records.some((record) => record.pending && record.settlementAttempted);
      output = unknown
        ? { success: false, errorReason: "unknown_settlement", network: "eip155:8453", transaction: "" }
        : { success: true, network: "eip155:8453", payer, transaction: `0x${counts.settle.toString(16).padStart(64, "0")}` };
    } else {
      res.writeHead(404);
      res.end();
      return;
    }
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(output));
  });
  const facilitatorPort = await listen(facilitator);
  let target;
  let child;
  const proxyState = { loseNextPaidResponse: false, lost: 0, calls: [], requests: 0 };
  const proxy = createServer(async (req, res) => {
    try {
      proxyState.requests += 1;
      const chunks = [];
      for await (const part of req) chunks.push(part);
      const raw = Buffer.concat(chunks);
      const message = raw.length ? JSON.parse(raw.toString()) : null;
      if (message?.method === "tools/call") proxyState.calls.push(message.params.name);
      const response = await fetch(`${target}${req.url}`, {
        method: req.method,
        headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
        ...(raw.length ? { body: raw } : {}),
        redirect: "error",
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (proxyState.loseNextPaidResponse && message?.method === "tools/call"
        && message.params.name !== "recover_paid_result" && message.params._meta?.["x402/payment"]) {
        proxyState.loseNextPaidResponse = false;
        proxyState.lost += 1;
        res.destroy();
        return;
      }
      res.writeHead(response.status, { "content-type": response.headers.get("content-type") || "application/json" });
      res.end(bytes);
    } catch {
      res.destroy();
    }
  });
  const proxyPort = await listen(proxy);
  const endpointUrl = `http://127.0.0.1:${proxyPort}/mcp`;
  async function start(extra = {}) {
    await stop(child);
    const probe = createServer();
    const port = await listen(probe);
    await new Promise((resolve) => probe.close(resolve));
    target = `http://127.0.0.1:${port}`;
    const configFile = path.join(directory, "receiver.json");
    await writeFile(configFile, JSON.stringify({
      dataDir, port, endpointUrl, tenantId: "tenant-a",
      facilitatorUrl: `http://127.0.0.1:${facilitatorPort}`, ...extra,
    }));
    child = spawn(process.execPath, ["fixtures/mcp-task-recovery-loopback.mjs", configFile], {
      cwd: merchant, env: { PATH: process.env.PATH }, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`receiver_timeout ${output.slice(-2000)}`)), 20000);
      const onData = (part) => {
        output += part;
        if (output.includes('"ready":true')) { clearTimeout(timer); resolve(); }
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.once("exit", () => { clearTimeout(timer); reject(new Error(`receiver_exited ${output.slice(-2000)}`)); });
    });
    return child.pid;
  }
  async function operation(name = "opportunity_preflight", inputArgs = taskArgs) {
    const { Client, Transport } = await openSdk();
    const client = new Client({ name: "merchant-journey-catalog", version: "1" });
    await client.connect(new Transport(new URL(endpointUrl)));
    const catalog = await client.listTools();
    assert.equal(client.getServerCapabilities().tasks, undefined);
    const accepted = catalog.tools.find((tool) => tool.name === name)._meta.x402.accepts[0];
    await client.close();
    const suffix = randomBytes(8).toString("hex");
    const payment = {
      x402Version: 2,
      resource: { url: `mcp://tool/${name}` },
      accepted,
      payload: {
        signature: `0x${"4".repeat(130)}`,
        authorization: {
          from: payer, to: accepted.payTo, value: accepted.amount, validAfter: "0",
          validBefore: String(Math.floor(Date.now() / 1000) + 300),
          nonce: `0x${randomBytes(32).toString("hex")}`,
        },
      },
      extensions: { "payment-identifier": { info: { required: false, id: `recovery_${suffix}` } } },
    };
    const input = {
      endpointUrl, tenantId: "tenant-a", principalId: "principal-a", name, arguments: inputArgs, payment,
      maxAtomic: accepted.amount, operationId: `operation-${suffix}`, reservationId: `reservation-${suffix}`, grantId: `grant-${suffix}`,
    };
    const grant = {
      ...Object.fromEntries(["endpointUrl", "tenantId", "principalId", "name", "maxAtomic", "operationId", "reservationId", "grantId"].map((key) => [key, input[key]])),
      inputDigest: hash(inputArgs), termsDigest: hash(accepted), paymentDigest: hash(payment),
      expiresAt: new Date(Date.now() + 300_000).toISOString(), execute: true, readResult: true, revoked: false,
    };
    const inputFile = path.join(directory, `input-${suffix}.json`);
    const checkpoint = path.join(directory, `checkpoint-${suffix}.json`);
    const grantFile = path.join(directory, `grant-${suffix}.json`);
    await writeFile(inputFile, JSON.stringify(input), { mode: 0o600 });
    await writeFile(grantFile, JSON.stringify(grant), { mode: 0o600 });
    return { input, grant, inputFile, checkpoint, grantFile, accepted };
  }
  function skillArgs(action, op) {
    return action === "start"
      ? ["recover", "--caller", "", "--action", "start", "--operation", op.inputFile, "--checkpoint", op.checkpoint, "--grant", op.grantFile]
      : ["recover", "--caller", "", "--action", "resume", "--checkpoint", op.checkpoint, "--grant", op.grantFile];
  }
  async function skill(caller, action, op) {
    const args = skillArgs(action, op);
    args[args.indexOf("--caller") + 1] = caller;
    const result = await runScript(args);
    const secret = op.input.payment.payload.signature;
    const nonce = op.input.payment.payload.authorization.nonce;
    assert.equal(result.stdout.includes(secret), false);
    assert.equal(result.stdout.includes(nonce), false);
    return result;
  }
  async function direct(caller, action, op) {
    const entry = path.join(directory, "direct-sdk.mjs");
    await writeFile(entry, DIRECT_CLIENT);
    const childProc = spawn(process.execPath, [entry, caller, action, op.inputFile, op.checkpoint, op.grantFile], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    childProc.stdout.on("data", (chunk) => { stdout += chunk; });
    childProc.stderr.on("data", (chunk) => { stderr += chunk; });
    const code = await new Promise((resolve) => {
      const timer = setTimeout(() => childProc.kill("SIGKILL"), 60_000);
      childProc.once("exit", (status) => { clearTimeout(timer); resolve(status); });
    });
    assert.equal(stdout.includes(op.input.payment.payload.signature), false);
    assert.equal(stdout.includes(op.input.payment.payload.authorization.nonce), false);
    let body = null;
    try { body = JSON.parse(stdout); } catch { body = null; }
    return { code, body, stdout, stderr, pid: childProc.pid };
  }
  t.after(async () => {
    await stop(child);
    proxy.closeAllConnections();
    facilitator.closeAllConnections();
    await Promise.all([
      new Promise((resolve) => proxy.close(resolve)),
      new Promise((resolve) => facilitator.close(resolve)),
    ]);
    await rm(directory, { recursive: true, force: true });
  });
  await start();
  return {
    counts, proxyState, endpointUrl, directory, dataDir, start, operation, skill, direct,
    journal: async () => JSON.parse(await readFile(path.join(dataDir, "idempotency-replay.json"), "utf8")),
    handlerCounts: async () => (await fetch(`${target}/fixture-counts`)).json(),
  };
}

test("installed caller acquires the hosted archive and recovers the current merchant result", { skip: skipMerchant, timeout: 240_000 }, async (t) => {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: merchant, encoding: "utf8" });
  assert.equal(head.stdout.trim(), MERCHANT_COMMIT);
  if (process.env.SAMEDAYDESK_INSTALLED_SKILL_ROOT) {
    const installedRoot = path.resolve(process.env.SAMEDAYDESK_INSTALLED_SKILL_ROOT);
    for (const relative of ["SKILL.md", "scripts/task-result.mjs", "references/caller-pin.json", "references/LICENSE.txt"]) {
      const installed = await readFile(path.join(installedRoot, relative));
      const exported = await readFile(path.join(root, "skills/samedaydesk-task-result", relative));
      assert.deepEqual(installed, exported, relative);
    }
  }
  const { caller, body: acquiredBody } = await acquireCaller();
  assert.equal(acquiredBody.outcome, "acquired");
  assert.equal(acquiredBody.version, "0.1.1");
  assert.equal(acquiredBody.memberCount, 15);
  assert.equal(acquiredBody.bytes, PIN.files.archive.bytes);
  assert.equal(acquiredBody.archiveSha256, PIN.files.archive.sha256);
  assert.equal(acquiredBody.hostedAcceptance, false);
  assert.equal(acquiredBody.npmInstall, "completed");
  assert.equal(acquiredBody.descriptorSourceFetched, false);
  assert.equal(acquiredBody.receiving, "hosted_descriptor");
  const archive = await readFile(path.join(path.dirname(caller), "received/samedaydesk-caller-result-0.1.1.tar.gz"));
  assert.equal(archive.length, PIN.files.archive.bytes);
  assert.equal(createHash("sha256").update(archive).digest("hex"), PIN.files.archive.sha256);

  const sentinel = "R993_PRIVATE";
  const redactDir = await mkdtemp(path.join(tmpdir(), "redact-journey-"));
  const bad = path.join(redactDir, "bad.json");
  await writeFile(bad, sentinel);
  await writeFile(path.join(redactDir, "headers.json"), "{}");
  for (const args of [
    ["retain", "--result", bad, "--out", path.join(redactDir, "out.json")],
    ["recover", "--caller", caller, "--action", "start", "--operation", bad, "--checkpoint", path.join(redactDir, "checkpoint.json"), "--grant", path.join(redactDir, "grant.json")],
    ["feedback", "--caller", caller, "--channel", "http", "--send", "yes", "--disposition", "useful", "--purchase", bad, "--resource", "https://samedaydesk.com/unused", "--header-file", path.join(redactDir, "headers.json")],
  ]) {
    const started = Date.now();
    const result = await runScript(args, 2000);
    assert.equal(result.code, 2, `${args[0]} ${result.stdout} ${result.stderr}`);
    assert.ok(Date.now() - started < 2000, args[0]);
    assert.equal((result.stdout + result.stderr).includes(sentinel), false, args[0]);
    assert.ok(result.body.outcome === "input_rejected" || result.body.outcome === "result_rejected", args[0]);
  }
  await rm(redactDir, { recursive: true, force: true });

  const supplied = path.join(path.dirname(caller), "supplied-result.json");
  const suppliedOut = path.join(path.dirname(caller), "supplied-copy.json");
  const suppliedRaw = Buffer.from('{"structuredContent":{"count":0,"note":null},"isError":false,"content":[]}\n');
  await writeFile(supplied, suppliedRaw);
  const retained = await runScript(["retain", "--result", supplied, "--out", suppliedOut]);
  assert.equal(retained.code, 0, retained.stdout);
  assert.equal(retained.body.outcome, "retained");
  assert.equal(retained.body.isError, false);
  assert.deepEqual(await readFile(suppliedOut), suppliedRaw);

  const f = await fixture(t);
  for (const flag of ["pay", "settle", "sign", "wallet"]) {
    const refused = await runScript(["recover", `--${flag}`, "--caller", caller, "--action", "resume", "--checkpoint", path.join(f.directory, "unused.json"), "--grant", path.join(f.directory, "unused-grant.json")]);
    assert.equal(refused.code, 2, flag);
    assert.equal(refused.body.outcome, "payment_refused");
  }
  assert.equal(f.proxyState.requests, 0);
  assert.equal(f.counts.verify, 0);
  assert.equal(f.counts.settle, 0);

  const op = await f.operation();
  assert.equal(op.accepted.amount, "50000");
  const beforeGrant = f.proxyState.requests;
  await writeFile(op.grantFile, JSON.stringify({ ...op.grant, grantId: "grant-changed" }));
  const changed = await f.skill(caller, "start", op);
  assert.equal(changed.code, 3, changed.stdout + changed.stderr);
  assert.equal(changed.body.outcome, "handle_rejected");
  assert.equal(changed.body.failure, "grant_grantId_changed");
  assert.deepEqual(changed.body.toolCalls, []);
  assert.equal(f.proxyState.requests, beforeGrant);
  assert.equal(f.counts.settle, 0);
  await writeFile(op.grantFile, JSON.stringify(op.grant), { mode: 0o600 });

  f.proxyState.loseNextPaidResponse = true;
  const first = await f.skill(caller, "start", op);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  assert.ok(first.body.outcome === "unresolved" || first.body.outcome === "transport_failure", first.body.outcome);
  assert.equal(first.body.usefulness, "unknown");
  assert.equal(first.body.paymentCreated, false);
  assert.equal(first.body.newPaymentPermitted, false);
  assert.deepEqual(first.body.toolCalls, ["opportunity_preflight"]);
  assert.equal(f.counts.settle, 1);
  assert.equal(f.counts.verify, 1);
  assert.equal(f.counts.markerBeforeSettlement, true);
  assert.equal((await f.handlerCounts()).opportunity, 1);
  const stored = (await f.journal()).records[0];
  assert.equal(stored.kind, "mcp");
  assert.equal(stored.pending, undefined);
  const callsAfterEffect = f.proxyState.calls.slice();
  const requestsAfterEffect = f.proxyState.requests;
  for (const patch of [{ revoked: true }, { maxAtomic: "999999" }]) {
    await writeFile(op.grantFile, JSON.stringify({ ...op.grant, ...patch }));
    const rejected = await f.skill(caller, "resume", op);
    assert.equal(rejected.code, 3, rejected.stdout + rejected.stderr);
    assert.equal(rejected.body.outcome, "handle_rejected");
    assert.equal(typeof rejected.body.failure === "string" && rejected.body.failure.startsWith("grant_"), true);
    assert.deepEqual(rejected.body.toolCalls, []);
  }
  assert.deepEqual(f.proxyState.calls, callsAfterEffect);
  assert.equal(f.proxyState.requests, requestsAfterEffect);
  assert.equal(f.counts.settle, 1);
  await writeFile(op.grantFile, JSON.stringify(op.grant), { mode: 0o600 });
  const restarted = await f.start();
  assert.notEqual(restarted, first.pid);
  const cold = await f.skill(caller, "resume", op);
  assert.equal(cold.code, 0, cold.stdout + cold.stderr);
  assert.equal(cold.body.outcome, "restored_result");
  assert.equal(cold.body.usefulness, "unknown");
  assert.equal(cold.body.paymentCreated, false);
  assert.equal(cold.body.newPaymentPermitted, false);
  assert.equal(cold.body.budgetUsefulness, "unknown");
  assert.notEqual(cold.pid, first.pid);
  assert.deepEqual(cold.body.toolCalls, ["recover_paid_result"]);
  const { opportunityPreflight } = await import(pathToFileURL(path.join(merchant, "opportunity-preflight.mjs")).href);
  const expected = opportunityPreflight(taskArgs);
  assert.deepEqual(cold.body.retainedResult.structuredContent, expected);
  assert.equal(expected.decision, "attempt");
  assert.equal(expected.economics.expectedSurplusUsd, 7);
  assert.equal(cold.body.retainedResult.isError === true, false);
  assert.equal(cold.body.retainedResult._meta["samedaydesk/recovery"].version, 1);
  assert.equal(Array.isArray(cold.body.retainedResult.content), true);
  const recovery = await import(pathToFileURL(path.join(caller, "src/mcp-recovery.mjs")).href);
  const checkpoint = JSON.parse(await readFile(op.checkpoint, "utf8"));
  const budget = recovery.mcpRecoveryBudget(checkpoint);
  assert.equal(budget.reportedSettledAtomic, "50000");
  assert.equal(budget.newPaymentPermitted, false);
  assert.equal(budget.usefulness, "unknown");
  assert.deepEqual(f.proxyState.calls, ["opportunity_preflight", "recover_paid_result"]);
  assert.equal(f.counts.settle, 1);
  assert.equal(f.counts.verify, 1);
  assert.deepEqual(await f.handlerCounts(), { opportunity: 0, receipt: 0 });

  const feedbackFile = path.join(f.directory, "feedback-result.json");
  await writeFile(feedbackFile, JSON.stringify(cold.body.retainedResult));
  const requestsBeforeFeedback = f.proxyState.requests;
  const mcpFeedback = await runScript(["feedback", "--caller", caller, "--channel", "mcp", "--endpoint", f.endpointUrl, "--result", feedbackFile, "--disposition", "useful"]);
  assert.equal(mcpFeedback.code, 0, mcpFeedback.stdout);
  assert.equal(mcpFeedback.body.outcome, "missing_input");
  assert.equal(mcpFeedback.body.connected, false);
  assert.equal(mcpFeedback.body.posted, false);
  assert.equal(f.proxyState.requests, requestsBeforeFeedback);
  const quiet = createServer((req, res) => { quiet.hits.push(req.url); res.end("no"); });
  quiet.hits = [];
  const quietPort = await listen(quiet);
  t.after(() => new Promise((resolve) => quiet.close(resolve)));
  const purchaseFile = path.join(f.directory, "purchase.json");
  const headerFile = path.join(f.directory, "header.json");
  await writeFile(purchaseFile, "{}");
  await writeFile(headerFile, "{}");
  const absentFeedback = await runScript(["feedback", "--caller", caller, "--channel", "http", "--send", "yes", "--disposition", "useful", "--purchase", purchaseFile, "--resource", `http://127.0.0.1:${quietPort}/paid`, "--header-file", headerFile]);
  assert.equal(absentFeedback.code, 0, absentFeedback.stdout + absentFeedback.stderr);
  assert.equal(absentFeedback.body.outcome, "capability_absent");
  assert.equal(absentFeedback.body.posted, false);
  assert.deepEqual(quiet.hits, []);
  const syntheticToken = `${"a".repeat(20)}.${"b".repeat(43)}`;
  await writeFile(headerFile, JSON.stringify({ "x-samedaydesk-caller-result-feedback": syntheticToken }));
  const httpFeedback = await runScript(["feedback", "--caller", caller, "--channel", "http", "--send", "yes", "--disposition", "useful", "--purchase", purchaseFile, "--resource", `http://127.0.0.1:${quietPort}/paid`, "--header-file", headerFile]);
  assert.equal(httpFeedback.code, 0, httpFeedback.stdout + httpFeedback.stderr);
  assert.equal(httpFeedback.body.outcome, "untrusted_origin");
  assert.equal(httpFeedback.body.posted, false);
  assert.equal(httpFeedback.stdout.includes(syntheticToken), false);
  assert.deepEqual(quiet.hits, []);

  const directOp = await f.operation();
  f.proxyState.loseNextPaidResponse = true;
  const directLost = await f.direct(caller, "start", directOp);
  assert.equal(directLost.code, 0, directLost.stderr + directLost.stdout);
  assert.ok(directLost.body.state === "unresolved", directLost.body.state);
  assert.equal(f.counts.settle, 2);
  assert.equal(f.counts.verify, 2);
  assert.equal((await f.handlerCounts()).opportunity, 1);
  await f.start();
  const directCold = await f.direct(caller, "resume", directOp);
  assert.equal(directCold.code, 0, directCold.stderr + directCold.stdout);
  assert.equal(directCold.body.state, "completed");
  assert.notEqual(directCold.pid, directLost.pid);
  assert.deepEqual(directCold.body.structuredContent, cold.body.retainedResult.structuredContent);
  assert.equal(directCold.body.isError, false);
  assert.equal(directCold.body.recoveryVersion, 1);
  assert.equal(directCold.body.hasMeta, true);
  assert.equal(directCold.body.budget.reportedSettledAtomic, "50000");
  assert.equal(directCold.body.budget.newPaymentPermitted, false);
  assert.equal(directCold.body.budget.usefulness, "unknown");
  assert.deepEqual(directCold.body.toolCalls, ["recover_paid_result"]);
  assert.equal(f.counts.settle, 2);
  assert.equal(f.counts.verify, 2);
  assert.deepEqual(await f.handlerCounts(), { opportunity: 0, receipt: 0 });
  assert.deepEqual(f.proxyState.calls, ["opportunity_preflight", "recover_paid_result", "opportunity_preflight", "recover_paid_result"]);
  t.diagnostic(JSON.stringify({
    merchant: MERCHANT_COMMIT,
    script,
    archiveSha256: acquiredBody.archiveSha256,
    lostOutcome: first.body.outcome,
    restored: cold.body.outcome,
    verify: f.counts.verify,
    settle: f.counts.settle,
    lostResponses: f.proxyState.lost,
    feedback: mcpFeedback.body.outcome,
    httpAbsent: absentFeedback.body.outcome,
    httpFeedback: httpFeedback.body.outcome,
    directState: directCold.body.state,
  }));
});

test("unknown merchant settlement stays unresolved for the skill and the direct caller", { skip: skipMerchant, timeout: 180_000 }, async (t) => {
  const { caller } = await acquireCaller();
  const f = await fixture(t, { unknown: true });
  const op = await f.operation();
  const first = await f.skill(caller, "start", op);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  assert.equal(first.body.outcome, "unresolved");
  assert.equal(first.body.usefulness, "unknown");
  assert.equal(first.body.newPaymentPermitted, false);
  assert.equal(first.body.paymentCreated, false);
  assert.equal((await f.journal()).records[0].settlementAttempted, true);
  assert.equal(f.counts.settle, 1);
  assert.equal(f.counts.verify, 1);
  await f.start();
  const cold = await f.skill(caller, "resume", op);
  assert.equal(cold.code, 0, cold.stdout + cold.stderr);
  assert.equal(cold.body.outcome, "recovery_pending");
  assert.equal(cold.body.usefulness, "unknown");
  assert.equal(cold.body.newPaymentPermitted, false);
  assert.equal(JSON.parse(await readFile(op.checkpoint, "utf8")).state, "unresolved");
  const recovery = await import(pathToFileURL(path.join(caller, "src/mcp-recovery.mjs")).href);
  const budget = recovery.mcpRecoveryBudget(JSON.parse(await readFile(op.checkpoint, "utf8")));
  assert.equal(budget.possibleAtomic, "50000");
  assert.equal(budget.reportedSettledAtomic, null);
  assert.equal(budget.newPaymentPermitted, false);
  assert.equal(budget.usefulness, "unknown");
  assert.equal(f.counts.settle, 1);
  assert.equal(f.counts.verify, 1);
  assert.deepEqual(f.proxyState.calls, ["opportunity_preflight", "recover_paid_result"]);
  assert.deepEqual(await f.handlerCounts(), { opportunity: 0, receipt: 0 });

  const directOp = await f.operation();
  const directLost = await f.direct(caller, "start", directOp);
  assert.equal(directLost.code, 0, directLost.stderr + directLost.stdout);
  assert.equal(directLost.body.state, "unresolved");
  assert.equal(directLost.body.budget.possibleAtomic, "50000");
  assert.equal(directLost.body.budget.newPaymentPermitted, false);
  assert.equal(f.counts.settle, 2);
  await f.start();
  const directCold = await f.direct(caller, "resume", directOp);
  assert.equal(directCold.code, 0, directCold.stderr + directCold.stdout);
  assert.equal(directCold.body.state, "unresolved");
  assert.equal(directCold.body.budget.possibleAtomic, "50000");
  assert.equal(directCold.body.budget.newPaymentPermitted, false);
  assert.equal(directCold.body.budget.usefulness, "unknown");
  assert.equal(f.counts.settle, 2);
  assert.equal(f.counts.verify, 2);
  assert.deepEqual(f.proxyState.calls, ["opportunity_preflight", "recover_paid_result", "opportunity_preflight", "recover_paid_result"]);
  t.diagnostic(JSON.stringify({
    skillLost: first.body.outcome,
    skillCold: cold.body.outcome,
    directState: directCold.body.state,
    verify: f.counts.verify,
    settle: f.counts.settle,
  }));
});
