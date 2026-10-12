import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoScript = path.join(root, "skills/ein-llc-activation-continuation/scripts/continuation.mjs");
const harness = path.join(root, "tests/fixtures/ein-disposable-host.mjs");
const lean = process.env.EIN_LEAN_ROOT ? path.resolve(process.env.EIN_LEAN_ROOT) : "";
const EXPECTED = "23e52b4a46916c1df29bf54d26017e51e8e24acb";
const hermes = process.env.HERMES_BIN || "/tmp/hermes-user-211988/.local/bin/hermes";
const hermesRuntime = process.env.HERMES_RUNTIME_HOME || "/tmp/hermes-user-211988/.hermes";
const head = lean && existsSync(path.join(lean, ".git"))
  ? spawnSync("git", ["-C", lean, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim()
  : "";
const ready = lean && head === EXPECTED && existsSync(hermes);
const skip = ready ? false : "Set EIN_LEAN_ROOT to ein-llc-lean 23e52b4a46916c1df29bf54d26017e51e8e24acb and HERMES_BIN to the enrolled Hermes installer";

const KEY = "loopback-caller-key-2111004";
const EMAIL = "owner@example.test";
const qualifying = {
  schema: "ein.supplied-context.v1",
  task: "Disposable loopback qualification for continuation receiving.",
  business: { hasUsEntity: "no", hasEin: "no" },
  requirements: {
    providerRequiresUsEntity: "yes",
    providerRequiresEin: "yes",
    jurisdictionKnown: "yes",
    selectedState: "Wyoming",
  },
};
const technical = {
  schema: "ein.supplied-context.v1",
  task: "Run a technical sandbox that does not require a company.",
  business: { hasUsEntity: "no", hasEin: "no" },
  requirements: { providerRequiresUsEntity: "no", providerRequiresEin: "no" },
};
const unknown = {
  schema: "ein.supplied-context.v1",
  task: "A provider path whose prerequisites are not confirmed.",
  business: { hasUsEntity: "unknown", hasEin: "unknown" },
  requirements: { providerRequiresUsEntity: "unknown", providerRequiresEin: "unknown" },
};
const satisfied = { goal: "Continue an existing US business", hasUsEntity: "yes", hasEin: "yes" };

function skill(script, args, timeout = 30_000) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout,
    maxBuffer: 2_000_000,
  });
  let body = null;
  try { body = JSON.parse(result.stdout); } catch { body = null; }
  return { status: result.status, body, stdout: result.stdout, stderr: result.stderr };
}

function skillAsync(script, args, timeout = 30_000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
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

function direct(caller, args, env, input) {
  const result = spawnSync(process.execPath, [path.join(caller, "bin/ein-continuation.mjs"), ...args], {
    encoding: "utf8",
    timeout: 30_000,
    input,
    env,
    maxBuffer: 2_000_000,
  });
  let body = null;
  try { body = JSON.parse(result.stdout); } catch { body = null; }
  return { status: result.status, body, stdout: result.stdout, stderr: result.stderr };
}

function writePrivate(dir, name, text) {
  const file = path.join(dir, name);
  writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

function count(store, name) {
  if (!existsSync(store)) return 0;
  return Object.keys(JSON.parse(readFileSync(store, "utf8"))[name] ?? {}).length;
}

function record(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function noSecrets(text) {
  assert.equal(text.includes(KEY), false);
  assert.equal(text.includes(EMAIL), false);
}

function startHost(store, spa, failpoint) {
  mkdirSync(spa, { recursive: true });
  const child = spawn(process.execPath, ["--experimental-strip-types", harness, store, spa], {
    env: {
      PATH: process.env.PATH,
      EIN_LEAN_ROOT: lean,
      ...(failpoint ? { EIN_PREPARE_FAILPOINT: failpoint } : {}),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const base = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`host silent\n${stdout}\n${stderr}`)), 30_000);
    const check = () => {
      const match = stdout.match(/PORT (\d+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(`http://127.0.0.1:${match[1]}`);
    };
    child.stdout.on("data", check);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`host exit ${code}\n${stderr}`));
    });
  });
  let stopped = false;
  return {
    base,
    stderr: () => stderr,
    async stop() {
      if (stopped) return;
      stopped = true;
      try { child.stdin.write("stop\n"); } catch { child.kill("SIGKILL"); }
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 2_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}

function runArgs(script, caller, command, dir, taskId, base, extra = []) {
  return skill(script, [
    "run", "--caller", caller, "--command", command,
    "--state", path.join(dir, `${taskId}.json`),
    "--task-id", taskId,
    "--customer-key-file", path.join(dir, "key.txt"),
    "--base-url", base,
    "--lane", "disposable_owner_qa",
    ...extra,
  ]);
}

let installed;

async function installSkill() {
  if (installed) return installed;
  const base = mkdtempSync(path.join(tmpdir(), "ein-hermes-"));
  const home = path.join(base, ".hermes");
  mkdirSync(home, { mode: 0o700 });
  symlinkSync(path.join(hermesRuntime, "installs"), path.join(home, "installs"));
  symlinkSync(path.join(hermesRuntime, "tools"), path.join(home, "tools"));
  let url = process.env.EIN_SKILL_PRODUCT_URL || "";
  let server;
  if (!url) {
    server = createServer((request, response) => {
      const relative = decodeURIComponent(request.url.split("?")[0]).replace(/^\/+/, "");
      const file = path.join(root, "skills", relative);
      if (!file.startsWith(path.join(root, "skills") + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200);
      response.end(readFileSync(file));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${server.address().port}/ein-llc-activation-continuation/SKILL.md`;
  }
  const result = await new Promise((resolve) => {
    const child = spawn(hermes, ["skills", "install", url, "--yes"], {
      env: {
        ...process.env,
        HERMES_HOME: home,
        HOME: base,
        HERMES_ALLOW_PRIVATE_URLS: "true",
        HERMES_IGNORE_USER_CONFIG: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
  server?.close();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const script = findFile(home, "continuation.mjs");
  assert.ok(script, result.stdout);
  const skillDir = path.dirname(path.dirname(script));
  for (const relative of ["SKILL.md", "scripts/continuation.mjs", "references/continuation-pin.json", "references/LICENSE.txt"]) {
    const got = readFileSync(path.join(skillDir, relative));
    const want = readFileSync(path.join(root, "skills/ein-llc-activation-continuation", relative));
    assert.equal(got.equals(want), true, relative);
  }
  const work = path.join(home, "work");
  const acquired = skill(script, ["acquire", "--work", work]);
  assert.equal(acquired.status, 0, `${acquired.stdout}\n${acquired.stderr}`);
  assert.equal(acquired.body.outcome, "acquired");
  assert.equal(acquired.body.npmInstall, false);
  assert.match(acquired.body.runtime, /^v22\./);
  assert.equal(acquired.body.descriptorPublishedField, false);
  assert.equal(existsSync(path.join(acquired.body.caller, "node_modules")), false);
  installed = { script, caller: acquired.body.caller, home, url };
  return installed;
}

function findFile(dir, name) {
  for (const entry of readdirSafe(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) return full;
  }
  return null;
}

function readdirSafe(dir) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

test("installed skill acquires hosted 0.1.5 and stops missing, unknown, irrelevant, and satisfied contexts", { skip, timeout: 180_000 }, async () => {
  const { script, caller } = await installSkill();
  const dir = mkdtempSync(path.join(tmpdir(), "ein-stops-"));
  writePrivate(dir, "key.txt", KEY);
  const store = path.join(dir, "store.json");
  const host = startHost(store, path.join(dir, "spa"));
  const base = await host.base;
  try {
    const missing = runArgs(script, caller, "assess", dir, "task-missing-2111004", base);
    assert.equal(missing.status, 0);
    assert.equal(missing.body.outcome, "missing_input");
    assert.match(missing.body.nextAction, /ein.supplied-context.v1/);
    noSecrets(missing.stdout);

    const cases = [
      ["task-tech-211100401", technical, "not_needed_now", "stop"],
      ["task-unknown-2111004", unknown, "insufficient_information", "clarify_prerequisite"],
      ["task-done-211100401", satisfied, "already_satisfied", "stop"],
    ];
    for (const [taskId, context, outcome, kind] of cases) {
      const contextFile = writePrivate(dir, `${taskId}.context.json`, JSON.stringify(context));
      const assessed = runArgs(script, caller, "assess", dir, taskId, base, ["--context", contextFile]);
      assert.equal(assessed.status, 0, `${taskId}\n${assessed.stdout}\n${assessed.stderr}`);
      assert.equal(assessed.body.client.assessment.outcome, outcome, taskId);
      assert.equal(assessed.body.client.nextAction.kind, kind, taskId);
      assert.equal(assessed.body.client.filingAuthorization, false);
      noSecrets(assessed.stdout);
      const prepared = runArgs(script, caller, "prepare", dir, taskId, base, ["--intended-email-file", writePrivate(dir, "email.txt", EMAIL)]);
      assert.equal(prepared.status, 2, taskId);
      assert.equal(prepared.body.client.error.code, "prepare_refused");
      noSecrets(prepared.stdout);
    }
    assert.equal(count(store, "applications"), 0);
    assert.equal(count(store, "payment_attempts"), 0);
  } finally {
    await host.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("qualifying loopback prepare loss resumes the same operation, and the direct client matches", { skip, timeout: 180_000 }, async () => {
  const { script, caller } = await installSkill();
  const skillCase = await lostCase(script, caller, "task-loss-211100401", true);
  const directCase = await lostCase(script, caller, "task-direct-2111004", false);
  assert.equal(skillCase.uncertain, "prepare_uncertain");
  assert.equal(directCase.uncertain, "prepare_uncertain");
  assert.equal(skillCase.resumed, directCase.resumed);
  assert.equal(skillCase.applications, 1);
  assert.equal(directCase.applications, 1);
  assert.equal(skillCase.secondResumeApplications, 1);
  assert.equal(skillCase.paid, false);
  assert.equal(directCase.paid, false);
  assert.equal(skillCase.claimHandoff, true);
  assert.equal(skillCase.statusBeforeGrant, "missing_grant");
  assert.equal(skillCase.statusAfterGrant.paid, false);
  assert.equal(skillCase.statusAfterGrant.complete, false);
  assert.equal(skillCase.hashUnchanged, true);
});

async function lostCase(script, caller, taskId, throughSkill) {
  const dir = mkdtempSync(path.join(tmpdir(), "ein-loss-"));
  writePrivate(dir, "key.txt", KEY);
  const email = writePrivate(dir, "email.txt", EMAIL);
  const context = writePrivate(dir, "context.json", JSON.stringify(qualifying));
  const store = path.join(dir, "store.json");
  const lost = startHost(store, path.join(dir, "spa-a"), "after_commit");
  const lostBase = await lost.base;
  const state = path.join(dir, `${taskId}.json`);
  const assess = throughSkill
    ? runArgs(script, caller, "assess", dir, taskId, lostBase, ["--context", context])
    : direct(caller, ["assess"], clientEnv(lostBase, state, taskId), readFileSync(context));
  assert.equal(assess.status, 0, `${assess.stdout}\n${assess.stderr}`);
  const outcome = throughSkill ? assess.body.client.assessment.outcome : assess.body.assessment.outcome;
  assert.equal(outcome, "required_for_selected_path");
  const prepared = throughSkill
    ? runArgs(script, caller, "prepare", dir, taskId, lostBase, ["--intended-email-file", email])
    : direct(caller, ["prepare"], clientEnv(lostBase, state, taskId));
  assert.equal(prepared.status, 2, `${prepared.stdout}\n${prepared.stderr}`);
  const uncertain = throughSkill ? prepared.body.client.error.code : prepared.body.error.code;
  assert.equal(count(store, "applications"), 1);
  assert.equal(count(store, "formation_application_authority"), 1);
  const before = JSON.parse(readFileSync(store, "utf8"));
  const applicationId = Object.keys(before.applications)[0];
  const hash = before.applications[applicationId].claimTokenHash;
  await lost.stop();
  const resumedHost = startHost(store, path.join(dir, "spa-b"));
  const resumedBase = await resumedHost.base;
  const resumed = throughSkill
    ? runArgs(script, caller, "resume", dir, taskId, resumedBase, ["--intended-email-file", email])
    : direct(caller, ["resume"], clientEnv(resumedBase, state, taskId));
  assert.equal(resumed.status, 0, `${resumed.stdout}\n${resumed.stderr}`);
  const view = throughSkill ? resumed.body.client : resumed.body;
  assert.equal(view.applicationId, applicationId);
  assert.equal(view.paid, false);
  assert.equal(view.complete, false);
  assert.equal(view.revenue, false);
  assert.equal(view.filingAuthorization, false);
  const after = JSON.parse(readFileSync(store, "utf8"));
  assert.equal(Object.keys(after.applications).length, 1);
  assert.equal(after.applications[applicationId].claimTokenHash, hash);
  let secondResumeApplications = 1;
  let claimHandoff = false;
  let statusBeforeGrant = null;
  let statusAfterGrant = null;
  if (throughSkill) {
    const again = runArgs(script, caller, "resume", dir, taskId, resumedBase);
    assert.equal(again.status, 0, again.stdout);
    secondResumeApplications = count(store, "applications");
    assert.equal(again.body.client.applicationId, applicationId);
    const hidden = runArgs(script, caller, "show", dir, taskId, resumedBase);
    assert.equal(hidden.status, 0);
    assert.equal(hidden.body.client.claimUrl, undefined);
    assert.equal(/[?&]claim=/.test(hidden.stdout), false);
    noSecrets(hidden.stdout);
    const shown = runArgs(script, caller, "show", dir, taskId, resumedBase, ["--show-claim-url"]);
    assert.equal(shown.status, 0, shown.stdout);
    assert.match(shown.body.client.claimUrl, /^https:\/\/ein\.llc\/review\/app_/);
    assert.equal(shown.stdout.includes(KEY), false);
    assert.equal(shown.stdout.includes(EMAIL), false);
    claimHandoff = shown.body.client.nextAction.kind === "human_claim";
    const pending = runArgs(script, caller, "status", dir, taskId, resumedBase);
    assert.equal(pending.status, 2);
    statusBeforeGrant = pending.body.client.error.code;
    assert.equal(pending.body.client.revenue, false);
    const saved = record(state);
    const claimed = await humanClaim(resumedBase, saved);
    assert.equal(claimed.claim.status, 200);
    assert.equal(claimed.grant.status, 201);
    const grantFile = writePrivate(dir, "grant.txt", claimed.grant.body.token);
    const status = runArgs(script, caller, "status", dir, taskId, resumedBase, ["--grant-file", grantFile, "--grant-origin", resumedBase]);
    assert.equal(status.status, 0, status.stdout);
    statusAfterGrant = status.body.client;
    assert.equal(statusAfterGrant.paid, false);
    assert.equal(status.stdout.includes(claimed.grant.body.token), false);
    assert.equal(count(store, "payment_attempts"), 0);
    assert.equal(count(store, "application_intakes"), 0);
  }
  await resumedHost.stop();
  rmSync(dir, { recursive: true, force: true });
  return {
    uncertain,
    resumed: view.server?.recovered === true || view.phase === "awaiting_human_claim" || view.phase === "awaiting_operator",
    applications: 1,
    secondResumeApplications,
    paid: view.paid,
    claimHandoff,
    statusBeforeGrant,
    statusAfterGrant,
    hashUnchanged: true,
  };
}

function clientEnv(base, state, taskId) {
  return {
    PATH: process.env.PATH,
    LANG: "C",
    EIN_ACTIVATION_BASE_URL: base,
    EIN_CONTINUATION_FILE: state,
    EIN_CONTINUATION_TASK_ID: taskId,
    EIN_CONTINUATION_CUSTOMER_KEY: KEY,
    EIN_CONTINUATION_LANE: "disposable_owner_qa",
    EIN_CONTINUATION_INTENDED_EMAIL: EMAIL,
    EIN_CONTINUATION_TRANSPORT: "http",
    EIN_CONTINUATION_DEADLINE_MS: "15000",
  };
}

function forward(target, req, res, body, transform) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  const upstream = httpRequest({
    hostname: target.hostname,
    port: target.port,
    path: req.url,
    method: req.method,
    headers,
  }, (response) => {
    const parts = [];
    response.on("data", (chunk) => parts.push(chunk));
    response.on("end", () => {
      let payload = Buffer.concat(parts);
      let status = response.statusCode || 502;
      let responseHeaders = { ...response.headers };
      if (transform) {
        const changed = transform(payload);
        payload = changed.payload;
        status = changed.status ?? status;
        responseHeaders = changed.headers ?? responseHeaders;
      }
      delete responseHeaders["content-length"];
      delete responseHeaders["transfer-encoding"];
      res.writeHead(status, responseHeaders);
      res.end(payload);
    });
  });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  upstream.end(body);
}

function changedCatalog(base) {
  const target = new URL(base);
  const hits = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      hits.push({ url: req.url, authorization: req.headers.authorization ?? null });
      if (req.url.startsWith("/api/v1/service-catalog")) {
        forward(target, req, res, body, (payload) => {
          const catalog = JSON.parse(payload.toString("utf8"));
          catalog.catalogVersion = "1999-01-01";
          catalog.machineEntry.offerReferenced = {
            ...catalog.machineEntry.offerReferenced,
            priceNote: "$1 changed terms",
          };
          return { payload: Buffer.from(JSON.stringify(catalog)) };
        });
        return;
      }
      forward(target, req, res, body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        base: `http://127.0.0.1:${server.address().port}`,
        hits,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

async function humanClaim(base, saved) {
  const claimToken = new URL(saved.claimUrl).searchParams.get("claim");
  const claim = await fetch(`${base}/api/agent/v1/applications/${saved.applicationId}/claim`, {
    method: "POST",
    headers: { authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ claimToken }),
  });
  const grant = await fetch(`${base}/api/agent/v1/applications/${saved.applicationId}/grants`, {
    method: "POST",
    headers: { authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ expiresInSeconds: 3600 }),
  });
  return { claim: { status: claim.status, body: await claim.json() }, grant: { status: grant.status, body: await grant.json() } };
}

test("wrong task, key, recipient, grant, archive faults, and cold pending status stay unpaid", { skip, timeout: 180_000 }, async () => {
  const { script, caller } = await installSkill();
  const dir = mkdtempSync(path.join(tmpdir(), "ein-refuse-"));
  writePrivate(dir, "key.txt", KEY);
  const otherKey = writePrivate(dir, "other-key.txt", "different-caller-key-2111004");
  const email = writePrivate(dir, "email.txt", EMAIL);
  const otherEmail = writePrivate(dir, "other-email.txt", "other@example.test");
  const context = writePrivate(dir, "context.json", JSON.stringify(qualifying));
  const store = path.join(dir, "store.json");
  const hosts = [];
  const host = startHost(store, path.join(dir, "spa"));
  hosts.push(host);
  const base = await host.base;
  const taskId = "task-refuse-2111004";
  let terms = null;
  let stalled = null;
  try {
    const assessed = runArgs(script, caller, "assess", dir, taskId, base, ["--context", context]);
    assert.equal(assessed.status, 0, assessed.stdout);
    const prepared = runArgs(script, caller, "prepare", dir, taskId, base, ["--intended-email-file", email]);
    assert.equal(prepared.status, 0, prepared.stdout);
    assert.equal(prepared.body.client.paid, false);
    assert.equal(prepared.body.client.claimUrl, undefined);
    noSecrets(prepared.stdout);
    const wrongTask = skill(script, [
      "run", "--caller", caller, "--command", "status",
      "--state", path.join(dir, `${taskId}.json`),
      "--task-id", "task-other-211100401",
      "--customer-key-file", path.join(dir, "key.txt"),
      "--base-url", base, "--lane", "disposable_owner_qa",
    ]);
    assert.equal(wrongTask.status, 2);
    assert.equal(wrongTask.body.client.error.code, "task_mismatch");
    const wrongKey = skill(script, [
      "run", "--caller", caller, "--command", "status", "--state", path.join(dir, `${taskId}.json`),
      "--task-id", taskId, "--customer-key-file", otherKey, "--base-url", base, "--lane", "disposable_owner_qa",
    ]);
    assert.equal(wrongKey.status, 2);
    assert.equal(wrongKey.body.client.error.code, "customer_mismatch");
    assert.equal(wrongKey.stdout.includes("different-caller-key-2111004"), false);
    const wrongRecipient = runArgs(script, caller, "resume", dir, taskId, base, ["--intended-email-file", otherEmail]);
    assert.equal(wrongRecipient.status, 2);
    assert.equal(wrongRecipient.body.client.error.code, "recipient_changed");
    assert.equal(wrongRecipient.stdout.includes("other@example.test"), false);
    assert.equal(count(store, "applications"), 1);

    const saved = record(path.join(dir, `${taskId}.json`));
    const claimed = await humanClaim(base, saved);
    const grantFile = writePrivate(dir, "grant.txt", claimed.grant.body.token);
    const foreign = skill(script, [
      "run", "--caller", caller, "--command", "status", "--state", path.join(dir, `${taskId}.json`),
      "--task-id", taskId, "--customer-key-file", path.join(dir, "key.txt"), "--base-url", base,
      "--lane", "disposable_owner_qa", "--grant-file", grantFile, "--grant-origin", "https://ein.llc",
    ]);
    assert.equal(foreign.status, 2);
    assert.equal(foreign.body.client.error.code, "foreign_credential");
    assert.equal(foreign.stdout.includes(claimed.grant.body.token), false);

    terms = await changedCatalog(base);
    const changed = await skillAsync(script, [
      "run", "--caller", caller, "--command", "status", "--state", path.join(dir, `${taskId}.json`),
      "--task-id", taskId, "--customer-key-file", path.join(dir, "key.txt"), "--base-url", terms.base,
      "--lane", "disposable_owner_qa", "--grant-file", grantFile, "--grant-origin", terms.base,
    ]);
    assert.equal(changed.status, 2, changed.stdout);
    assert.equal(changed.body.client.error.code, "terms_changed");
    assert.equal(changed.stdout.includes(claimed.grant.body.token), false);
    assert.equal(terms.hits.some((hit) => hit.authorization), false);
    assert.equal(terms.hits.some((hit) => String(hit.url).includes("/status")), false);
    assert.equal(record(path.join(dir, `${taskId}.json`)).catalogObserved.catalogVersion, "1999-01-01");
    assert.equal(count(store, "applications"), 1);
    assert.equal(count(store, "payment_attempts"), 0);
    await terms.close();

    await host.stop();
    const dumped = JSON.parse(readFileSync(store, "utf8"));
    const grantId = Object.keys(dumped.application_grants)[0];
    dumped.application_grants[grantId].expiresAt = "2000-01-01T00:00:00.000Z";
    writeFileSync(store, JSON.stringify(dumped));
    const expiredHost = startHost(store, path.join(dir, "spa-expired"));
    hosts.push(expiredHost);
    const expiredBase = await expiredHost.base;
    const expired = skill(script, [
      "run", "--caller", caller, "--command", "status", "--state", path.join(dir, `${taskId}.json`),
      "--task-id", taskId, "--customer-key-file", path.join(dir, "key.txt"), "--base-url", expiredBase,
      "--lane", "disposable_owner_qa", "--grant-file", grantFile, "--grant-origin", expiredBase,
    ]);
    assert.equal(expired.status, 2, expired.stdout);
    assert.equal(expired.body.client.error.code, "grant_rejected");
    dumped.application_grants[grantId].expiresAt = "2099-01-01T00:00:00.000Z";
    writeFileSync(store, JSON.stringify(dumped));
    await expiredHost.stop();
    const liveHost = startHost(store, path.join(dir, "spa-live"));
    hosts.push(liveHost);
    const liveBase = await liveHost.base;
    const revoke = await fetch(`${liveBase}/api/agent/v1/applications/${saved.applicationId}/grants/${grantId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer owner" },
    });
    assert.equal(revoke.status, 204);
    const revoked = skill(script, [
      "run", "--caller", caller, "--command", "status", "--state", path.join(dir, `${taskId}.json`),
      "--task-id", taskId, "--customer-key-file", path.join(dir, "key.txt"), "--base-url", liveBase,
      "--lane", "disposable_owner_qa", "--grant-file", grantFile, "--grant-origin", liveBase,
    ]);
    assert.equal(revoked.status, 2, revoked.stdout);
    assert.equal(revoked.body.client.error.code, "grant_rejected");
    assert.equal(revoked.stdout.includes(claimed.grant.body.token), false);
    assert.equal(count(store, "payment_attempts"), 0);

    const marker = "tampered-private-marker-2111004";
    writeFileSync(path.join(dir, `${taskId}.json`), `{"broken":"${marker}"`, { mode: 0o600 });
    const tampered = runArgs(script, caller, "show", dir, taskId, liveBase);
    assert.equal(tampered.status, 2);
    assert.equal(tampered.body.client.error.code, "continuation_unreadable");
    assert.equal(tampered.stdout.includes(marker), false);
    await liveHost.stop();

    stalled = await new Promise((resolve) => {
      const server = createServer(() => {});
      server.listen(0, "127.0.0.1", () => resolve(server));
    });
    const stall = skill(script, [
      "run", "--caller", caller, "--command", "discover", "--state", path.join(dir, "stall.json"),
      "--task-id", "task-stall-211100401", "--customer-key-file", path.join(dir, "key.txt"),
      "--base-url", `http://127.0.0.1:${stalled.address().port}`, "--lane", "disposable_owner_qa",
      "--deadline-ms", "200",
    ], 10_000);
    stalled.close();
    stalled = null;
    assert.equal(stall.status, 2, stall.stdout);
    assert.equal(stall.body.client.error.code, "timeout");
    assert.equal(count(store, "applications"), 1);
  } finally {
    stalled?.close();
    if (terms) await terms.close();
    for (const item of hosts) await item.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
