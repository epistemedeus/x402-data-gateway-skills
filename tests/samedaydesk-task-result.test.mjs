import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractPinnedArchive, PIN, sha256 } from "../skills/samedaydesk-task-result/scripts/task-result.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "skills/samedaydesk-task-result/scripts/task-result.mjs");
const accepted = { scheme: "exact", network: "eip155:8453", amount: "50000", asset: `0x${"a".repeat(40)}`, payTo: `0x${"b".repeat(40)}` };
const signature = `0x${"4".repeat(130)}`;
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 2_000_000,
    env: { ...process.env, SAMEDAYDESK_SENTINEL_SECRET: "supersecret-211988", ...env },
  });
  let body = null;
  try { body = JSON.parse(result.stdout); } catch { body = null; }
  return { status: result.status, body, stdout: result.stdout, stderr: result.stderr };
}

const fixture = path.join(root, "tests/fixtures/task-result-servers.mjs");

function writeTree(dir, files) {
  for (const [urlPath, body] of files) {
    const relative = String(urlPath).replace(/^\/+/, "");
    if (!relative || relative.split("/").some((part) => part === "" || part === "." || part === "..")) {
      throw new Error("fixture path");
    }
    const target = path.join(dir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
}

function startProc(args) {
  const child = spawn(process.execPath, [fixture, ...args], { stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.on("error", () => {});
  const hits = [];
  const calls = [];
  const notes = [];
  let stderr = "";
  let buf = "";
  let port = null;
  let input = null;
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => reject(new Error(`fixture silent ${stderr}`)), 20_000);
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        notes.push(line);
        if (line.startsWith("HIT ")) hits.push(line.slice(4));
        if (line.startsWith("CALL ")) calls.push(line.slice(5).split(" ")[0]);
        if (line.startsWith("PORT ")) port = line.slice(5).trim();
        if (line.startsWith("INPUT ")) input = JSON.parse(Buffer.from(line.slice(6).trim(), "base64").toString("utf8"));
      }
      if (port && (args[0] !== "mcp" || input)) {
        finish({
          child, hits, calls, notes, origin: `http://127.0.0.1:${port}`, endpoint: `http://127.0.0.1:${port}/mcp`, input,
          stderr: () => stderr,
          stop() { child.kill("SIGTERM"); },
        });
      }
    });
    child.on("exit", (code) => {
      if (!settled) reject(new Error(`fixture exit ${code} ${stderr}`));
    });
  });
}

async function readCalls(proc, minimum) {
  const deadline = Date.now() + 2_000;
  while (proc.calls.length < minimum && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  return proc.calls;
}

function waitNote(proc, text) {
  if (proc.notes.includes(text)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`missing ${text} ${proc.stderr()}`)), 5_000);
    const onData = () => {
      if (!proc.notes.includes(text)) return;
      clearTimeout(timer);
      proc.child.stdout.off("data", onData);
      resolve();
    };
    proc.child.stdout.on("data", onData);
  });
}

function runDirect(caller, operationFile, grantFile) {
  const child = spawn(process.execPath, [fixture, "direct", "--caller", caller, "--operation", operationFile, "--grant", grantFile], { stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`direct timeout ${stderr}`));
    }, 30_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => {
      clearTimeout(timer);
      const line = stdout.split("\n").find((item) => item.startsWith("DIRECT "));
      if (code !== 0 || !line) reject(new Error(`direct ${code} ${stderr} ${stdout}`));
      else resolve(JSON.parse(Buffer.from(line.slice(7), "base64").toString("utf8")));
    });
  });
}

async function serveMap(files, redirectTo) {
  const dir = mkdtempSync(path.join(tmpdir(), "task-result-files-"));
  writeTree(dir, files);
  const args = ["files", "--root", dir];
  if (redirectTo) args.push("--redirect", redirectTo);
  const proc = await startProc(args);
  const stop = proc.stop.bind(proc);
  proc.stop = () => { stop(); rmSync(dir, { recursive: true, force: true }); };
  return proc;
}

async function getPublic(url, max) {
  const response = await fetch(url, { redirect: "manual", headers: { "accept-encoding": "identity" } });
  if (response.status !== 200) throw new Error(`GET ${response.status} ${url}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > max) throw new Error(`body ${body.length} exceeds ${max}`);
  return body;
}

let hostedPromise;
function hostedFiles() {
  hostedPromise ??= (async () => {
    const files = new Map();
    for (const spec of Object.values(PIN.files)) {
      const body = await getPublic(`${PIN.origin}${spec.path}`, spec.bytes + 1);
      assert.equal(body.length, spec.bytes, spec.path);
      assert.equal(sha256(body), spec.sha256, spec.path);
      files.set(spec.path, body);
    }
    const oldUrl = `${PIN.origin}/downloads/samedaydesk-caller-result/0.1.0/samedaydesk-caller-result-0.1.0.tar.gz`;
    const old = await getPublic(oldUrl, PIN.rejectedArchive.bytes + 1);
    assert.equal(old.length, PIN.rejectedArchive.bytes);
    assert.equal(sha256(old), PIN.rejectedArchive.sha256);
    return { files, old };
  })();
  return hostedPromise;
}

function tempWork() {
  return mkdtempSync(path.join(tmpdir(), "task-result-211988-"));
}

let installedPromise;
function installedCaller() {
  installedPromise ??= (async () => {
    const { files } = await hostedFiles();
    const served = await serveMap(files);
    const work = path.join(tempWork(), "install");
    try {
      const local = run(["acquire", "--work", work, "--public-root", served.origin, "--install", "yes"]);
      if (local.status !== 0) throw new Error(local.stderr || local.stdout);
      return { work, caller: local.body.callerDir, body: local.body };
    } finally {
      served.stop();
    }
  })();
  return installedPromise;
}

function header({ name, size, typeflag = "0", linkname = "" }) {
  const bytes = Buffer.alloc(512);
  bytes.write(name);
  bytes.write("0000644\0", 100);
  bytes.write("0000000\0", 108);
  bytes.write("0000000\0", 116);
  bytes.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
  bytes.write("00000000000\0", 136);
  bytes.write("        ", 148);
  bytes[156] = typeflag.charCodeAt(0);
  if (linkname) bytes.write(linkname, 157);
  bytes.write("ustar  \0", 257);
  let sum = 0;
  for (const byte of bytes) sum += byte;
  bytes.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return bytes;
}

function operation(endpoint) {
  return {
    endpointUrl: endpoint, tenantId: "tenant-a", name: "opportunity_preflight", principalId: "principal-a",
    grantId: "grant-a", operationId: "operation-a", reservationId: "reservation-a", maxAtomic: "50000",
    arguments: { rewardUsd: 10, hours: 1, hourlyCostUsd: 1 },
    payment: {
      x402Version: 2, resource: { url: "mcp://tool/opportunity_preflight" }, accepted,
      payload: { signature, authorization: { from: `0x${"2".repeat(40)}`, to: accepted.payTo, value: accepted.amount, validBefore: String(Math.floor(Date.now() / 1000) + 300) } },
    },
  };
}

function grantFor(input, patch = {}) {
  return {
    ...Object.fromEntries(["endpointUrl", "tenantId", "principalId", "grantId", "operationId", "reservationId", "name", "maxAtomic"].map((key) => [key, input[key]])),
    inputDigest: digest(input.arguments), termsDigest: digest(accepted), paymentDigest: digest(input.payment),
    expiresAt: new Date(Date.now() + 300_000).toISOString(), execute: true, readResult: true, revoked: false, ...patch,
  };
}

test("missing command and missing retain input return the next action", () => {
  const absent = run([]);
  assert.equal(absent.status, 0);
  assert.equal(absent.body.outcome, "missing_input");
  assert.match(absent.body.nextAction, /acquire, retain, recover, or feedback/);
  assert.equal(absent.stdout.includes("supersecret-211988"), false);
  const missing = run(["retain", "--result", path.join(tmpdir(), "missing-211988.json"), "--out", path.join(tmpdir(), "out-211988.json")]);
  assert.equal(missing.status, 0);
  assert.equal(missing.body.outcome, "missing_input");
  assert.match(missing.body.nextAction, /does not load a bundled example/);
  const absentCaller = path.join(tempWork(), "no-caller");
  const missingCaller = run(["recover", "--caller", absentCaller, "--action", "start", "--operation", path.join(tempWork(), "op.json"), "--checkpoint", path.join(tempWork(), "checkpoint.json"), "--grant", path.join(tempWork(), "grant.json")]);
  assert.equal(missingCaller.status, 0);
  assert.equal(missingCaller.body.outcome, "missing_input");
  assert.match(missingCaller.body.nextAction, /does not create a caller/);
});

test("payment flags stop before a request", async () => {
  const { files } = await hostedFiles();
  const served = await serveMap(files);
  try {
    const work = path.join(tempWork(), "pay");
    const result = run(["acquire", "--pay", "--work", work, "--public-root", served.origin]);
    assert.equal(result.status, 2);
    assert.equal(result.body.outcome, "payment_refused");
    assert.equal(result.body.paymentCreated, false);
    assert.deepEqual(served.hits, []);
  } finally { served.stop(); }
});

test("redirect, cross-origin, truncation, tamper, and 0.1.0 disagreement are refused", async () => {
  const { files, old } = await hostedFiles();
  const evil = await serveMap(new Map());
  const redirected = await serveMap(files, `${evil.origin}/stolen`);
  try {
    const redirect = run(["acquire", "--work", path.join(tempWork(), "redir"), "--public-root", redirected.origin]);
    assert.equal(redirect.status, 2);
    assert.equal(redirect.body.outcome, "redirect_refused");
    assert.deepEqual(evil.hits, []);
  } finally {
    redirected.stop();
    evil.stop();
  }
  const foreign = structuredClone(JSON.parse(files.get(PIN.files.descriptor.path).toString("utf8")));
  foreign.archive = `${evil.origin}/stolen.tar.gz`;
  const foreignFiles = new Map(files);
  foreignFiles.set(PIN.files.descriptor.path, Buffer.from(JSON.stringify(foreign)));
  const evil2 = await serveMap(new Map([["/stolen.tar.gz", Buffer.from("nope")]]));
  foreign.archive = `${evil2.origin}/stolen.tar.gz`;
  foreignFiles.set(PIN.files.descriptor.path, Buffer.from(JSON.stringify(foreign)));
  const cross = await serveMap(foreignFiles);
  try {
    const result = run(["acquire", "--work", path.join(tempWork(), "cross"), "--public-root", cross.origin]);
    assert.equal(result.status, 2);
    assert.equal(result.body.outcome, "cross_origin_refused");
    assert.deepEqual(evil2.hits, []);
    assert.equal(cross.hits.includes(PIN.files.archive.path), false);
  } finally {
    cross.stop();
    evil2.stop();
  }
  const truncated = new Map(files);
  truncated.set(PIN.files.archive.path, files.get(PIN.files.archive.path).subarray(0, 100));
  const short = await serveMap(truncated);
  try {
    const result = run(["acquire", "--work", path.join(tempWork(), "short"), "--public-root", short.origin]);
    assert.equal(result.status, 2);
    assert.equal(result.body.outcome, "truncated_archive");
  } finally { short.stop(); }
  const flipped = Buffer.from(files.get(PIN.files.archive.path));
  flipped[flipped.length - 1] ^= 0xff;
  const tampered = new Map(files);
  tampered.set(PIN.files.archive.path, flipped);
  const bad = await serveMap(tampered);
  try {
    const work = path.join(tempWork(), "bad");
    const result = run(["acquire", "--work", work, "--public-root", bad.origin]);
    assert.equal(result.status, 2);
    assert.equal(result.body.outcome, "tampered_archive");
    assert.throws(() => statSync(path.join(work, "caller")));
  } finally { bad.stop(); }
  const oldArchive = new Map(files);
  oldArchive.set(PIN.files.archive.path, old);
  const disagree = await serveMap(oldArchive);
  try {
    const result = run(["acquire", "--work", path.join(tempWork(), "old"), "--public-root", disagree.origin]);
    assert.equal(result.status, 2);
    assert.equal(result.body.outcome, "source_disagreement");
  } finally { disagree.stop(); }
});

test("archive members reject links and traversal before a file is written", () => {
  const dest = mkdtempSync(path.join(tmpdir(), "ustar-211988-"));
  const link = Buffer.concat([header({ name: "LICENSE", size: 0, typeflag: "2", linkname: "PIN.json" }), Buffer.alloc(512), Buffer.alloc(512)]);
  assert.throws(() => extractPinnedArchive(gzipSync(link), dest), /link_refused/);
  const escape = Buffer.concat([header({ name: "../outside.txt", size: 1 }), Buffer.from("z"), Buffer.alloc(511), Buffer.alloc(1024)]);
  assert.throws(() => extractPinnedArchive(gzipSync(escape), dest), /traversal_refused|tampered_archive/);
});

test("retain keeps exact bytes, including null, zero, absence, and isError", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "retain-211988-"));
  const source = path.join(dir, "result.json");
  const out = path.join(dir, "copy.json");
  const raw = Buffer.from('{"structuredContent":{"count":0,"note":null},"isError":false,"content":[]}\n');
  await writeFile(source, raw);
  const kept = run(["retain", "--result", source, "--out", out]);
  assert.equal(kept.status, 0);
  assert.equal(kept.body.outcome, "retained");
  assert.equal(kept.body.retainedBytesMatch, true);
  const written = await readFile(out);
  assert.deepEqual(written, raw);
  const parsed = JSON.parse(written.toString("utf8"));
  assert.equal(parsed.structuredContent.count, 0);
  assert.equal(parsed.structuredContent.note, null);
  assert.equal(Object.hasOwn(parsed.structuredContent, "missing"), false);
  const refusal = path.join(dir, "refusal.json");
  const refusalOut = path.join(dir, "refusal-copy.json");
  const refusalRaw = Buffer.from('{"isError":true,"structuredContent":{"count":0,"note":null},"content":[{"type":"text","text":"refused"}]}');
  await writeFile(refusal, refusalRaw);
  const refused = run(["retain", "--result", refusal, "--out", refusalOut]);
  assert.equal(refused.status, 0);
  assert.equal(refused.body.outcome, "tool_refusal");
  assert.equal(refused.body.isError, true);
  assert.deepEqual(await readFile(refusalOut), refusalRaw);
  const again = run(["retain", "--result", source, "--out", out]);
  assert.equal(again.status, 2);
  assert.equal(again.body.outcome, "overwrite_refused");
  assert.deepEqual(await readFile(out), raw);
});

test("loopback acquire installs the exact caller and the hosted bytes match the pin", async () => {
  const installed = await installedCaller();
  assert.equal(installed.body.outcome, "acquired");
  assert.equal(installed.body.version, "0.1.1");
  assert.equal(installed.body.archiveSha256, PIN.files.archive.sha256);
  assert.equal(installed.body.bytes, 32421);
  assert.equal(installed.body.hostedAcceptance, false);
  assert.equal(installed.body.npmPublished, false);
  assert.equal(installed.body.registryPackageClaim, false);
  assert.equal(installed.body.packageNameInstalledFromRegistry, false);
  assert.equal(installed.body.npmInstall, "completed");
  assert.equal(installed.body.projectionIsArchive, false);
  assert.equal(installed.body.descriptorSourceFetched, false);
  assert.equal(installed.body.dataRoute, "@modelcontextprotocol/sdk@1.30.0");
  const sdk = JSON.parse(readFileSync(path.join(installed.caller, "node_modules/@modelcontextprotocol/sdk/package.json"), "utf8"));
  const projection = JSON.parse(readFileSync(path.join(installed.caller, "node_modules/@x402/mcp/package.json"), "utf8"));
  assert.equal(sdk.version, "1.30.0");
  assert.equal(projection.version, "2.16.0");
  const source = readFileSync(script, "utf8");
  assert.equal(source.includes("x402MCPClient"), false);
  assert.equal(source.includes("callToolWithPayment"), false);
  assert.equal(source.includes("cold-consumer"), false);
  assert.equal(source.includes("shell: true"), false);
  const again = run(["acquire", "--work", installed.work, "--public-root", "http://127.0.0.1:9/"]);
  assert.equal(again.status, 2);
  assert.equal(again.body.outcome, "overwrite_refused");
  const live = run(["acquire", "--work", path.join(tempWork(), "live")]);
  assert.equal(live.status, 0, live.stderr);
  assert.equal(live.body.outcome, "acquired");
  assert.equal(live.body.receiving, "hosted_descriptor");
  assert.equal(live.body.hostedAcceptance, false);
  assert.equal(live.body.archiveSha256, PIN.files.archive.sha256);
  assert.equal(sha256(readFileSync(path.join(path.dirname(live.body.callerDir), "received/samedaydesk-caller-result-0.1.1.tar.gz"))), PIN.files.archive.sha256);
});

test("installed caller recovery retains the full result and matches direct client use", async () => {
  const { caller, work } = await installedCaller();
  const mcp = await startProc(["mcp", "--caller", caller, "--mode", "good"]);
  try {
    const dir = path.join(work, "case");
    mkdirSync(dir);
    const op = path.join(dir, "operation.json");
    const checkpoint = path.join(dir, "checkpoint.json");
    const grant = path.join(dir, "grant.json");
    writeFileSync(op, JSON.stringify(mcp.input));
    writeFileSync(grant, JSON.stringify(grantFor(mcp.input)));
    const restored = run(["recover", "--caller", caller, "--action", "start", "--operation", op, "--checkpoint", checkpoint, "--grant", grant]);
    assert.equal(restored.status, 0, restored.stderr + restored.stdout);
    assert.equal(restored.body.outcome, "restored_result");
    assert.equal(restored.body.usefulness, "unknown");
    assert.equal(restored.body.paymentCreated, false);
    assert.equal(restored.body.newPaymentPermitted, false);
    assert.equal(restored.body.budgetUsefulness, "unknown");
    assert.deepEqual(restored.body.toolCalls, ["opportunity_preflight"]);
    assert.equal(restored.body.retainedResult.structuredContent.count, 0);
    assert.equal(restored.body.retainedResult.structuredContent.note, null);
    assert.equal(Object.hasOwn(restored.body.retainedResult.structuredContent, "missing"), false);
    assert.equal(restored.body.retainedResult.isError, false);
    assert.equal(restored.body.retainedResult._meta["samedaydesk/recovery"].version, 1);
    assert.equal(restored.stdout.includes(signature), false);
    const directCli = path.join(dir, "cli-checkpoint.json");
    const cli = spawnSync(process.execPath, [path.join(caller, "bin/recover-mcp.mjs"), "start", op, directCli, grant], { encoding: "utf8", timeout: 30_000 });
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stdout.includes(signature), false);
    const projected = JSON.parse(cli.stdout);
    assert.equal(projected.output.count, 0);
    assert.equal(projected.output.note, null);
    assert.equal(projected._meta, undefined);
    assert.equal(projected.resultDigest, restored.body.retainedResult._meta["samedaydesk/recovery"].resultDigest);
    const directGrant = path.join(dir, "direct-grant.json");
    writeFileSync(directGrant, JSON.stringify(grantFor(mcp.input)));
    const direct = await runDirect(caller, op, directGrant);
    assert.deepEqual(direct.structuredContent, restored.body.retainedResult.structuredContent);
    assert.equal(direct.isError, restored.body.retainedResult.isError);
    assert.equal(direct.resultDigest, restored.body.retainedResult._meta["samedaydesk/recovery"].resultDigest);
    assert.equal(mcp.calls.filter((name) => name === "opportunity_preflight").length >= 1, true);
  } finally { mcp.stop(); }
});

test("expired and mismatched handles do not replay, and unknown or pending recovery stays unpaid", async () => {
  const { caller, work } = await installedCaller();
  const dir = path.join(work, "expired");
  mkdirSync(dir);
  const input = operation("http://127.0.0.1:1/mcp");
  const op = path.join(dir, "operation.json");
  writeFileSync(op, JSON.stringify(input));
  const expiredGrant = path.join(dir, "expired-grant.json");
  writeFileSync(expiredGrant, JSON.stringify(grantFor(input, { expiresAt: "2000-01-01T00:00:00.000Z" })));
  const expired = run(["recover", "--caller", caller, "--action", "start", "--operation", op, "--checkpoint", path.join(dir, "expired.json"), "--grant", expiredGrant]);
  assert.equal(expired.status, 3, expired.stdout);
  assert.equal(expired.body.outcome, "handle_rejected");
  assert.equal(expired.body.failure, "grant_expired");
  assert.deepEqual(expired.body.toolCalls, []);
  const mismatchGrant = path.join(dir, "mismatch-grant.json");
  writeFileSync(mismatchGrant, JSON.stringify(grantFor(input, { grantId: "grant-b" })));
  const mismatched = run(["recover", "--caller", caller, "--action", "start", "--operation", op, "--checkpoint", path.join(dir, "mismatch.json"), "--grant", mismatchGrant]);
  assert.equal(mismatched.status, 3, mismatched.stdout);
  assert.equal(mismatched.body.outcome, "handle_rejected");
  assert.equal(mismatched.body.failure, "grant_grantId_changed");
  assert.deepEqual(mismatched.body.toolCalls, []);

  const bad = await startProc(["mcp", "--caller", caller, "--mode", "bad"]);
  const pending = await startProc(["mcp", "--caller", caller, "--mode", "pending"]);
  try {
    const badDir = path.join(work, "bad");
    mkdirSync(badDir);
    writeFileSync(path.join(badDir, "operation.json"), JSON.stringify(bad.input));
    writeFileSync(path.join(badDir, "grant.json"), JSON.stringify(grantFor(bad.input)));
    const unresolved = run(["recover", "--caller", caller, "--action", "start", "--operation", path.join(badDir, "operation.json"), "--checkpoint", path.join(badDir, "checkpoint.json"), "--grant", path.join(badDir, "grant.json")]);
    assert.equal(unresolved.status, 0, unresolved.stdout);
    assert.equal(unresolved.body.outcome, "unresolved");
    assert.equal(unresolved.body.newPaymentPermitted, false);
    assert.deepEqual(unresolved.body.toolCalls, ["opportunity_preflight"]);
    const resumed = run(["recover", "--caller", caller, "--action", "resume", "--checkpoint", path.join(badDir, "checkpoint.json"), "--grant", path.join(badDir, "grant.json")]);
    assert.equal(resumed.status, 0, resumed.stdout);
    assert.equal(resumed.body.outcome, "restored_result");
    assert.deepEqual(resumed.body.toolCalls, ["recover_paid_result"]);
    assert.deepEqual(await readCalls(bad, 2), ["opportunity_preflight", "recover_paid_result"]);

    const pendingDir = path.join(work, "pending");
    mkdirSync(pendingDir);
    writeFileSync(path.join(pendingDir, "operation.json"), JSON.stringify(pending.input));
    writeFileSync(path.join(pendingDir, "grant.json"), JSON.stringify(grantFor(pending.input)));
    const waiting = run(["recover", "--caller", caller, "--action", "start", "--operation", path.join(pendingDir, "operation.json"), "--checkpoint", path.join(pendingDir, "checkpoint.json"), "--grant", path.join(pendingDir, "grant.json")]);
    assert.equal(waiting.status, 0, waiting.stdout);
    assert.equal(waiting.body.outcome, "recovery_pending");
    assert.deepEqual(waiting.body.toolCalls, ["opportunity_preflight"]);
    const still = run(["recover", "--caller", caller, "--action", "resume", "--checkpoint", path.join(pendingDir, "checkpoint.json"), "--grant", path.join(pendingDir, "grant.json")]);
    assert.equal(still.status, 0, still.stdout);
    assert.equal(still.body.outcome, "recovery_pending");
    assert.deepEqual(still.body.toolCalls, ["recover_paid_result"]);
    assert.equal((await readCalls(pending, 2)).filter((name) => name === "opportunity_preflight").length, 1);
  } finally {
    bad.stop();
    pending.stop();
  }
});

test("feedback separates acceptance, refusal, transport loss, and unsent HTTP", async () => {
  const { caller, work } = await installedCaller();
  const contract = await import(pathToFileURL(path.join(caller, "src/contract.mjs")).href);
  const token = `${"a".repeat(20)}.${"b".repeat(43)}`;
  const result = { content: [{ type: "text", text: "{}" }], _meta: { "samedaydesk/mcp-caller-result": { ...contract.mcpCallerResultFeedbackPublicContract(), token } } };
  const resultFile = path.join(work, "result.json");
  writeFileSync(resultFile, JSON.stringify(result));
  const fb = await startProc(["feedback", "--caller", caller]);
  const quiet = await serveMap(new Map());
  try {
    await waitNote(fb, "READY accept");
    const acceptedRun = run(["feedback", "--caller", caller, "--channel", "mcp", "--endpoint", fb.endpoint, "--result", resultFile, "--disposition", "useful", "--reason", "matched_task"]);
    assert.equal(acceptedRun.status, 0, acceptedRun.stdout + acceptedRun.stderr);
    assert.equal(acceptedRun.body.outcome, "caller_asserted_acceptance");
    assert.equal(acceptedRun.body.accepted, true);
    assert.equal(acceptedRun.body.usefulness, "unknown");
    assert.equal(acceptedRun.body.isError, false);
    assert.equal(acceptedRun.body.posted, false);
    assert.equal(acceptedRun.body.tokenEcho, false);
    assert.equal(acceptedRun.stdout.includes(token), false);
    fb.child.stdin.write("BEHAVIOR refuse\n");
    await waitNote(fb, "READY refuse");
    const refused = run(["feedback", "--caller", caller, "--channel", "mcp", "--endpoint", fb.endpoint, "--result", resultFile, "--disposition", "useful"]);
    assert.equal(refused.status, 0, refused.stdout);
    assert.equal(refused.body.outcome, "tool_refusal");
    assert.equal(refused.body.accepted, false);
    assert.equal(refused.body.isError, true);
    assert.equal(refused.body.statement.accepted, true);
    fb.child.stdin.write("BEHAVIOR lose\n");
    await waitNote(fb, "READY lose");
    const lost = run(["feedback", "--caller", caller, "--channel", "mcp", "--endpoint", fb.endpoint, "--result", resultFile, "--disposition", "useful"]);
    assert.equal(lost.status, 0, lost.stdout);
    assert.equal(lost.body.outcome, "transport_failure");
    assert.equal(lost.body.accepted, false);
    const absent = run(["feedback", "--caller", caller, "--channel", "mcp", "--endpoint", fb.endpoint, "--result", path.join(work, "empty.json"), "--disposition", "useful"]);
    assert.equal(absent.status, 0);
    assert.equal(absent.body.outcome, "missing_input");
    writeFileSync(path.join(work, "empty.json"), "{}");
    const missing = run(["feedback", "--caller", caller, "--channel", "mcp", "--endpoint", fb.endpoint, "--result", path.join(work, "empty.json"), "--disposition", "useful"]);
    assert.equal(missing.status, 0);
    assert.equal(missing.body.outcome, "missing_input");
    assert.equal(missing.body.connected, false);
    const header = path.join(work, "header.json");
    const purchase = path.join(work, "purchase.json");
    writeFileSync(header, JSON.stringify({ "x-samedaydesk-caller-result-feedback": token }));
    writeFileSync(purchase, "{}");
    const unsent = run(["feedback", "--caller", caller, "--channel", "http", "--disposition", "useful", "--purchase", purchase, "--resource", `${quiet.origin}/paid`, "--header-file", header]);
    assert.equal(unsent.body.outcome, "feedback_not_sent");
    assert.equal(unsent.body.posted, false);
    assert.deepEqual(quiet.hits, []);
    const untrusted = run(["feedback", "--caller", caller, "--channel", "http", "--send", "yes", "--disposition", "useful", "--purchase", purchase, "--resource", `${quiet.origin}/paid`, "--header-file", header]);
    assert.equal(untrusted.status, 0, untrusted.stdout);
    assert.equal(untrusted.body.outcome, "untrusted_origin");
    assert.equal(untrusted.body.posted, false);
    assert.deepEqual(quiet.hits, []);
    assert.equal(untrusted.stdout.includes(token), false);
    assert.equal(fb.calls.includes("report_caller_result"), true);
    assert.equal(fb.notes.filter((line) => line.startsWith("CALL ")).every((line) => line.endsWith("META none")), true);
  } finally {
    fb.stop();
    quiet.stop();
  }
});

test("current catalog skills stay byte-identical beside the additive task-result skill", () => {
  for (const dir of ["skills/samedaydesk-machine-commerce", "skills/received-useful-work", "skills/public-careers-board"]) {
    const status = spawnSync("git", ["status", "--short", "--", dir], { cwd: root, encoding: "utf8" });
    assert.equal(status.stdout, "", dir);
  }
  const source = readFileSync(path.join(root, "skills/samedaydesk-machine-commerce/SKILL.md"), "utf8");
  assert.match(source, /A purchase intent is not permission to spend/);
  assert.equal(source.includes("samedaydesk-task-result"), false);
});

test("FIFO result inputs fail promptly rather than waiting for a writer", { skip: process.platform === "win32" }, () => {
  const dir = tempWork();
  const fifo = path.join(dir, "result.fifo");
  const output = path.join(dir, "result.json");
  try {
    const made = spawnSync("mkfifo", [fifo], { encoding: "utf8", timeout: 2000 });
    assert.equal(made.status, 0, made.stderr);
    const result = spawnSync(process.execPath, [script, "retain", "--result", fifo, "--out", output], {
      encoding: "utf8", timeout: 1500, maxBuffer: 10000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).outcome, "input_rejected");
    assert.throws(() => statSync(output), { code: "ENOENT" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("malformed caller purchase and header JSON are redacted before networking", async () => {
  const { caller } = await installedCaller();
  const dir = tempWork();
  const purchase = path.join(dir, "purchase.json");
  const headers = path.join(dir, "headers.json");
  const sentinel = "R993_PRIVATE";
  const args = ["feedback", "--caller", caller, "--channel", "http", "--send", "yes",
    "--disposition", "useful", "--purchase", purchase, "--resource", "https://samedaydesk.com/unused",
    "--header-file", headers];
  try {
    writeFileSync(purchase, sentinel);
    writeFileSync(headers, "{}");
    const badPurchase = run(args);
    assert.equal(badPurchase.status, 2);
    assert.equal(badPurchase.body.outcome, "input_rejected");
    assert.equal((badPurchase.stdout + badPurchase.stderr).includes(sentinel), false);
    writeFileSync(purchase, "{}");
    writeFileSync(headers, sentinel);
    const badHeaders = run(args);
    assert.equal(badHeaders.status, 2);
    assert.equal(badHeaders.body.outcome, "input_rejected");
    assert.equal((badHeaders.stdout + badHeaders.stderr).includes(sentinel), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
