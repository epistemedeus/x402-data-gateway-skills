import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { extractPinnedArchive, PIN, sha256 } from "../skills/ein-llc-activation-continuation/scripts/continuation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "skills/ein-llc-activation-continuation/scripts/continuation.mjs");
const MARKER = "context-marker-2111004-not-for-stdout";

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => {
      clearTimeout(timer);
      let body = null;
      try { body = JSON.parse(stdout); } catch { body = null; }
      resolve({ status, body, stdout, stderr });
    });
  });
}

function writeField(header, start, length, value) {
  const text = value.toString(8).padStart(length - 1, "0");
  header.write(text, start, length - 1, "ascii");
  header[start + length - 1] = 0;
}

function craftArchive(entries) {
  const chunks = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name);
    writeField(header, 100, 8, entry.mode ?? 0o644);
    writeField(header, 108, 8, 0);
    writeField(header, 116, 8, 0);
    writeField(header, 124, 12, entry.body.length);
    writeField(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = entry.type ?? 0x30;
    if (entry.link) header.write(entry.link, 157);
    header.write("ustar\0", 257, "binary");
    header.write("00", 263, "binary");
    let sum = 0;
    for (const byte of header) sum += byte;
    writeField(header, 148, 8, sum);
    const pad = (512 - (entry.body.length % 512)) % 512;
    chunks.push(header, entry.body, Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
}

function expectExtract(archive, name) {
  const dest = mkdtempSync(path.join(tmpdir(), "ein-tar-"));
  assert.throws(() => extractPinnedArchive(archive, dest), (error) => error.code === name);
}

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("pin keeps the frozen published field and the hosted archive identity", () => {
  assert.equal(PIN.version, "0.1.5");
  assert.equal(PIN.historicalDescriptor.published, false);
  assert.equal(PIN.files.archive.bytes, 50590);
  assert.equal(PIN.files.archive.sha256, "e490d78753e8bb8e18aa517b882107f667f088546ace4888e5f86b86b9afb6f0");
  assert.equal(PIN.files.archive.members, 39);
  assert.equal(PIN.members.length, 39);
  assert.equal(PIN.npmInstall, false);
  const source = readFileSync(script, "utf8");
  assert.equal(source.includes("examples/task-qualifying.json"), false);
  assert.equal(source.includes("child_process"), false);
});

test("missing command and missing work return the next action without an example", async () => {
  const absent = await run([]);
  assert.equal(absent.status, 0);
  assert.equal(absent.body.outcome, "missing_input");
  assert.match(absent.body.nextAction, /does not execute a bundled example/);
  const work = await run(["acquire"]);
  assert.equal(work.status, 0);
  assert.equal(work.body.outcome, "missing_input");
  assert.equal(work.stdout.includes("examples/"), false);
});

test("payment, claim, and live prepare stop before a request", async () => {
  for (const flag of ["--pay", "--settle", "--sign", "--wallet"]) {
    const refused = await run(["run", flag]);
    assert.equal(refused.status, 2, flag);
    assert.equal(refused.body.outcome, "payment_refused");
    assert.equal(refused.body.paymentCreated, false);
  }
  for (const flag of ["--claim", "--attest", "--register", "--file"]) {
    const refused = await run(["run", flag]);
    assert.equal(refused.status, 2, flag);
    assert.equal(refused.body.outcome, "action_refused");
    assert.equal(refused.body.claimPerformed, false);
  }
  const live = await run([
    "run", "--caller", "/tmp/not-used", "--command", "prepare", "--state", "/tmp/not-used.json",
    "--task-id", "task-live-2111004", "--customer-key-file", "/tmp/not-used-key",
    "--base-url", "https://ein.llc", "--lane", "disposable_owner_qa",
  ]);
  assert.equal(live.status, 2);
  assert.equal(live.body.outcome, "origin_refused");
  const autonomous = await run([
    "run", "--caller", "/tmp/not-used", "--command", "discover", "--state", "/tmp/not-used.json",
    "--task-id", "task-live-2111004", "--customer-key-file", "/tmp/not-used-key",
    "--base-url", "http://127.0.0.1:9", "--lane", "autonomous_machine_purchase",
  ]);
  assert.equal(autonomous.status, 2);
  assert.equal(autonomous.body.outcome, "lane_refused");
  const humanLane = await run([
    "run", "--caller", "/tmp/not-used", "--command", "assess", "--state", "/tmp/not-used.json",
    "--task-id", "task-live-2111004", "--customer-key-file", "/tmp/not-used-key",
    "--base-url", "http://127.0.0.1:9", "--lane", "agent_assisted_human",
  ]);
  assert.equal(humanLane.status, 2);
  assert.equal(humanLane.body.outcome, "lane_refused");
});

test("malformed private context and a fifo are refused without disclosure", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ein-input-"));
  const context = path.join(dir, "context.json");
  const key = path.join(dir, "key.txt");
  const state = path.join(dir, "state.json");
  writeFileSync(context, `{"schema":"ein.supplied-context.v1", "note":"${MARKER}"`);
  writeFileSync(key, "loopback-caller-key-2111004\n", { mode: 0o600 });
  const malformed = await run([
    "run", "--caller", path.join(dir, "missing-caller"), "--command", "assess",
    "--state", state, "--task-id", "task-input-2111004", "--customer-key-file", key,
    "--context", context, "--base-url", "http://127.0.0.1:9", "--lane", "disposable_owner_qa",
  ]);
  assert.equal(malformed.status, 2);
  assert.equal(malformed.body.outcome, "input_rejected");
  assert.equal(`${malformed.stdout}\n${malformed.stderr}`.includes(MARKER), false);
  assert.equal(malformed.stdout.includes("loopback-caller-key-2111004"), false);
  const fifo = path.join(dir, "context.fifo");
  const made = spawnSync("mkfifo", ["-m", "600", fifo], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr);
  const fifoResult = await run([
    "run", "--caller", path.join(dir, "missing-caller"), "--command", "assess",
    "--state", state, "--task-id", "task-input-2111004", "--customer-key-file", key,
    "--context", fifo, "--base-url", "http://127.0.0.1:9", "--lane", "disposable_owner_qa",
  ]);
  assert.equal(fifoResult.status, 2);
  assert.equal(fifoResult.body.outcome, "fifo_refused");
  await rm(dir, { recursive: true, force: true });
});

test("archive members refuse traversal, links, devices, fifos, and truncation", () => {
  const body = Buffer.from("nope");
  expectExtract(craftArchive([{ name: "ein-activation-continuation/../outside.txt", body }]), "traversal_refused");
  expectExtract(craftArchive([{ name: "/tmp/outside.txt", body }]), "traversal_refused");
  expectExtract(craftArchive([{ name: "ein-activation-continuation/link.txt", body, type: 0x32, link: "target" }]), "link_refused");
  expectExtract(craftArchive([{ name: "ein-activation-continuation/hard.txt", body, type: 0x31, link: "target" }]), "link_refused");
  expectExtract(craftArchive([{ name: "ein-activation-continuation/dev.txt", body, type: 0x33 }]), "device_refused");
  expectExtract(craftArchive([{ name: "ein-activation-continuation/pipe.txt", body, type: 0x36 }]), "fifo_refused");
  expectExtract(gzipSync(Buffer.from("not a tar")), "tampered_archive");
});

test("hosted acquire matches the pin, imports the client, and does not install or overwrite", async () => {
  const descriptor = await fetch(`${PIN.origin}${PIN.files.descriptor.path}`, { redirect: "manual" });
  assert.equal(descriptor.status, 200);
  const descriptorBytes = Buffer.from(await descriptor.arrayBuffer());
  assert.equal(descriptorBytes.length, PIN.files.descriptor.bytes);
  assert.equal(sha256(descriptorBytes), PIN.files.descriptor.sha256);
  assert.equal(JSON.parse(descriptorBytes.toString("utf8")).published, false);
  const workParent = await mkdtemp(path.join(tmpdir(), "ein-acquire-"));
  const work = path.join(workParent, "work");
  const acquired = await run(["acquire", "--work", work]);
  assert.equal(acquired.status, 0, acquired.stderr);
  assert.equal(acquired.body.outcome, "acquired");
  assert.equal(acquired.body.version, "0.1.5");
  assert.equal(acquired.body.descriptorPublishedField, false);
  assert.equal(acquired.body.members, 39);
  assert.equal(acquired.body.npmInstall, false);
  assert.equal(acquired.body.receiving, "hosted_descriptor");
  assert.match(acquired.body.runtime, /^v22\./);
  const caller = acquired.body.caller;
  assert.equal(statSync(path.join(caller, "bin/ein-continuation.mjs")).mode & 0o777, 0o755);
  assert.equal(JSON.parse(readFileSync(path.join(caller, "ACQUISITION.json"), "utf8")).published, false);
  const modules = statSync(path.join(caller, "node_modules"), { throwIfNoEntry: false });
  assert.equal(modules?.isDirectory() ?? false, false);
  const again = await run(["acquire", "--work", work]);
  assert.equal(again.status, 2);
  assert.equal(again.body.outcome, "overwrite_refused");
  assert.equal(readFileSync(path.join(caller, "package.json"), "utf8").includes('"version": "0.1.5"'), true);
  const vendor = JSON.parse(readFileSync(path.join(caller, "vendor/ein-formation-http-client/package.json"), "utf8"));
  assert.equal(vendor.name, "ein-public-http-client");
  assert.equal(vendor.version, "0.1.1");
  assert.equal(vendor.license, "MIT");
  await rm(workParent, { recursive: true, force: true });
});

test("local receiving follows only a same-origin pinned redirect and refuses the other archive faults", async () => {
  const descriptorResponse = await fetch(`${PIN.origin}${PIN.files.descriptor.path}`);
  const archiveResponse = await fetch(`${PIN.origin}${PIN.files.archive.path}`);
  const descriptorBytes = Buffer.from(await descriptorResponse.arrayBuffer());
  const archiveBytes = Buffer.from(await archiveResponse.arrayBuffer());
  assert.equal(createHash("sha256").update(archiveBytes).digest("hex"), PIN.files.archive.sha256);
  let descriptorHits = 0;
  const server = await listen((request, response) => {
    if (request.url === PIN.files.descriptor.path) {
      descriptorHits += 1;
      if (descriptorHits === 1) {
        response.writeHead(302, { location: PIN.files.descriptor.path });
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "application/json", "content-length": descriptorBytes.length });
      response.end(descriptorBytes);
      return;
    }
    if (request.url === PIN.files.archive.path) {
      response.writeHead(200, { "content-type": "application/gzip", "content-length": archiveBytes.length });
      response.end(archiveBytes);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const port = server.address().port;
  const workParent = await mkdtemp(path.join(tmpdir(), "ein-local-"));
  const ok = await run(["acquire", "--work", path.join(workParent, "ok"), "--public-root", `http://127.0.0.1:${port}/`]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.body.receiving, "local_receiving");
  assert.equal(ok.body.descriptorPublishedField, false);
  server.close();

  const cross = await listen((request, response) => {
    response.writeHead(302, { location: "https://example.invalid/downloads/ein-activation-continuation-v0.1.5.json" });
    response.end();
  });
  const crossResult = await run(["acquire", "--work", path.join(workParent, "cross"), "--public-root", `http://127.0.0.1:${cross.address().port}/`]);
  assert.equal(crossResult.status, 2);
  assert.equal(crossResult.body.outcome, "redirect_refused");
  cross.close();

  const truncated = await listen((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(descriptorBytes.subarray(0, 20));
  });
  const truncatedResult = await run(["acquire", "--work", path.join(workParent, "short"), "--public-root", `http://127.0.0.1:${truncated.address().port}/`]);
  assert.equal(truncatedResult.status, 2);
  assert.equal(truncatedResult.body.outcome, "truncated_descriptor");
  truncated.close();

  const flipped = Buffer.from(descriptorBytes);
  flipped[0] ^= 0xff;
  const tampered = await listen((request, response) => {
    response.writeHead(200, { "content-type": "application/json", "content-length": flipped.length });
    response.end(flipped);
  });
  const tamperedResult = await run(["acquire", "--work", path.join(workParent, "flip"), "--public-root", `http://127.0.0.1:${tampered.address().port}/`]);
  assert.equal(tamperedResult.status, 2);
  assert.equal(tamperedResult.body.outcome, "tampered_descriptor");
  tampered.close();
  await rm(workParent, { recursive: true, force: true });
});

test("public root rejects non-loopback aliases", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ein-root-"));
  const rejected = await run(["acquire", "--work", path.join(dir, "work"), "--public-root", "http://localhost:9/"]);
  assert.equal(rejected.status, 2);
  assert.equal(rejected.body.outcome, "public_root_rejected");
});
