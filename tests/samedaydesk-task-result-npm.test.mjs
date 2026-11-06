import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PIN, sha256 } from "../skills/samedaydesk-task-result/scripts/task-result.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "skills/samedaydesk-task-result/scripts/task-result.mjs");
const fixture = path.join(root, "tests/fixtures/task-result-servers.mjs");
const realNpm = spawnSync("/usr/bin/env", ["bash", "-lc", "command -v npm"], { encoding: "utf8" }).stdout.trim();

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function writeExecutable(file, body) {
  writeFileSync(file, body, { mode: 0o755 });
  chmodSync(file, 0o755);
}

function writePins(dir, files) {
  for (const [urlPath, body] of files) {
    const relative = String(urlPath).replace(/^\/+/, "");
    const target = path.join(dir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
}

function servePins(dir) {
  const child = spawn(process.execPath, [fixture, "files", "--root", dir], { stdio: ["ignore", "pipe", "pipe"] });
  let buf = "";
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      fail(new Error(`fixture silent ${stderr}`));
    }, 20_000);
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      const match = buf.match(/PORT (\d+)/);
      if (!match || settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        origin: `http://127.0.0.1:${match[1]}`,
        close() {
          child.kill("SIGTERM");
          return new Promise((done) => child.once("exit", () => done()));
        },
      });
    });
    child.on("exit", (code) => fail(new Error(`fixture exit ${code} ${stderr}`)));
  });
}

async function loadPublishedPins() {
  const files = new Map();
  for (const spec of Object.values(PIN.files)) {
    const response = await fetch(`${PIN.origin}${spec.path}`, {
      redirect: "manual",
      headers: { accept: "*/*", "accept-encoding": "identity" },
    });
    assert.equal(response.status, 200, spec.path);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.length, spec.bytes, spec.path);
    assert.equal(sha256(body), spec.sha256, spec.path);
    files.set(spec.path, body);
  }
  return files;
}

function runAcquire(nodeBin, work, origin, pathValue) {
  const result = spawnSync(nodeBin, [
    script, "acquire", "--work", work, "--public-root", `${origin}/`, "--install", "yes",
  ], {
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 2_000_000,
    env: {
      PATH: pathValue,
      HOME: path.dirname(work),
      LANG: "C",
      LC_ALL: "C",
      NODE_OPTIONS: "--max-old-space-size=512",
    },
  });
  let body = null;
  try { body = JSON.parse(result.stdout); } catch { body = null; }
  return { status: result.status, body, stdout: result.stdout, stderr: result.stderr };
}

function assertNotAcquired(result) {
  assert.equal(result.body?.outcome === "acquired", false, result.stdout || result.stderr);
  assert.notEqual(result.status, 0, result.stdout || result.stderr);
  assert.equal(result.body?.npmInstall, "failed");
  assert.equal(result.body?.npmPublished, false);
  assert.equal(result.body?.registryPackageClaim, false);
  assert.equal(result.body?.packageNameInstalledFromRegistry, false);
  assert.equal(result.body?.paymentCreated, false);
}

function assertAcquired(result, work) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.body.outcome, "acquired");
  assert.equal(result.body.npmInstall, "completed");
  assert.equal(result.body.version, PIN.version);
  assert.equal(result.body.archiveSha256, PIN.files.archive.sha256);
  assert.equal(result.body.bytes, PIN.files.archive.bytes);
  assert.equal(result.body.hostedAcceptance, false);
  assert.equal(result.body.npmPublished, false);
  assert.equal(result.body.registryPackageClaim, false);
  assert.equal(result.body.packageNameInstalledFromRegistry, false);
  assert.equal(result.body.receiving, "local_receiving");
  assert.equal(result.body.descriptorSourceFetched, false);
  assert.equal(result.body.paymentCreated, false);
  const archive = readFileSync(path.join(work, "received", "samedaydesk-caller-result-0.1.1.tar.gz"));
  assert.equal(archive.length, PIN.files.archive.bytes);
  assert.equal(createHash("sha256").update(archive).digest("hex"), PIN.files.archive.sha256);
  const sdk = JSON.parse(readFileSync(path.join(result.body.callerDir, "node_modules/@modelcontextprotocol/sdk/package.json"), "utf8"));
  assert.equal(sdk.version, PIN.dependencies["@modelcontextprotocol/sdk"]);
  const projection = JSON.parse(readFileSync(path.join(result.body.callerDir, "node_modules/@x402/mcp/package.json"), "utf8"));
  assert.equal(projection.version, PIN.dependencies["@x402/mcp"]);
}

test("npm resolution receives sibling, ambient, missing, and failed install", { timeout: 600_000 }, async (t) => {
  assert.ok(realNpm, "ambient npm is required to receive the usable install paths");
  const npmBinDir = path.dirname(realNpm);
  const base = mkdtempSync(path.join(tmpdir(), "task-result-npm-"));
  const nodeBlob = path.join(base, "node-blob");
  copyFileSync(process.execPath, nodeBlob);
  chmodSync(nodeBlob, 0o755);
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const files = await loadPublishedPins();
  const pinDir = path.join(base, "pins");
  writePins(pinDir, files);
  const served = await servePins(pinDir);
  t.after(() => served.close());

  function place(name) {
    const dir = path.join(base, name);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const nodePath = path.join(dir, "node");
    linkSync(nodeBlob, nodePath);
    const printed = spawnSync(nodePath, ["-p", "process.execPath"], { encoding: "utf8" }).stdout.trim();
    assert.equal(printed, nodePath);
    const work = path.join(dir, "work");
    return { dir, nodePath, work };
  }

  await t.test("sibling npm is preferred and a real install completes", async () => {
    const { dir, nodePath, work } = place("sibling");
    const marker = path.join(dir, "sibling-marker");
    const ambientMarker = path.join(dir, "ambient-marker");
    writeExecutable(path.join(dir, "npm"), `#!/bin/sh\nprintf 'sibling\\n' > ${shellQuote(marker)}\nexec ${shellQuote(realNpm)} "$@"\n`);
    const ambientBin = path.join(dir, "ambient-bin");
    mkdirSync(ambientBin, { mode: 0o700 });
    writeExecutable(path.join(ambientBin, "npm"), `#!/bin/sh\nprintf 'ambient\\n' > ${shellQuote(ambientMarker)}\nexit 0\n`);
    const result = runAcquire(nodePath, work, served.origin, `${ambientBin}:/usr/bin:/bin`);
    assertAcquired(result, work);
    assert.equal(readFileSync(marker, "utf8"), "sibling\n");
    assert.equal(existsSync(ambientMarker), false);
  });

  await t.test("exec-daemon-style node with no sibling uses ambient npm", async () => {
    const { dir, nodePath, work } = place("ambient");
    assert.equal(existsSync(path.join(dir, "npm")), false);
    const result = runAcquire(nodePath, work, served.origin, `${npmBinDir}:/usr/bin:/bin`);
    assertAcquired(result, work);
    assert.equal(existsSync(path.join(dir, "npm")), false);
  });

  await t.test("genuinely missing npm does not become success", async () => {
    const { nodePath, work } = place("missing");
    const result = runAcquire(nodePath, work, served.origin, "/usr/bin:/bin");
    assertNotAcquired(result);
    assert.equal(result.body.outcome, "install_failed");
    assert.equal(result.body.reason, "child_spawn_failed");
    assert.equal(existsSync(path.join(work, "caller", "node_modules")), false);
  });

  await t.test("failed install does not become success", async () => {
    const { dir, nodePath, work } = place("failed");
    const marker = path.join(dir, "failed-marker");
    const fakeBin = path.join(dir, "fake-bin");
    mkdirSync(fakeBin, { mode: 0o700 });
    writeExecutable(path.join(fakeBin, "npm"), `#!/bin/sh\nprintf 'failed\\n' > ${shellQuote(marker)}\nexit 1\n`);
    const result = runAcquire(nodePath, work, served.origin, `${fakeBin}:/usr/bin:/bin`);
    assertNotAcquired(result);
    assert.equal(result.body.outcome, "install_failed");
    assert.equal(result.body.reason, null);
    assert.equal(readFileSync(marker, "utf8"), "failed\n");
    assert.equal(existsSync(path.join(work, "caller", "node_modules/@modelcontextprotocol/sdk/package.json")), false);
  });
});
