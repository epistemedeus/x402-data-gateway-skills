#!/usr/bin/env node
// Sibling fixture servers. A server hosted in the test process is not reachable
// from the skill process on this VM, so the tests spawn this file instead.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [kind, ...args] = process.argv.slice(2);
const flags = {};
for (let index = 0; index < args.length; index += 2) flags[args[index].slice(2)] = args[index + 1];

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

if (kind === "files") {
  const root = path.resolve(flags.root);
  const redirect = flags.redirect || "";
  const server = createServer((req, res) => {
    process.stdout.write(`HIT ${req.url}\n`);
    if (redirect) {
      res.writeHead(302, { location: redirect });
      res.end();
      return;
    }
    const relative = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    const target = path.resolve(root, relative);
    if (relative.includes("\0") || (target !== root && !target.startsWith(`${root}${path.sep}`))) {
      res.writeHead(400);
      res.end();
      return;
    }
    try {
      const body = readFileSync(target);
      res.writeHead(200, { "content-type": "application/octet-stream", "content-length": String(body.length) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  const port = await listen(server);
  process.stdout.write(`PORT ${port}\n`);
} else if (kind === "mcp") {
  const caller = path.resolve(flags.caller);
  const mode = flags.mode || "good";
  const { createHash } = await import("node:crypto");
  const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const mcpResultDigest = (result) => hash({ content: result?.content, structuredContent: result?.structuredContent ?? null, isError: result?.isError === true });
  const accepted = { scheme: "exact", network: "eip155:8453", amount: "50000", asset: `0x${"a".repeat(40)}`, payTo: `0x${"b".repeat(40)}` };
  const serverMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js")).href);
  const transportMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js")).href);
  const typesMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/types.js")).href);
  let endpoint = "";
  const body = { decision: "attempt", requiredChecks: [], count: 0, note: null };
  const calls = [];
  const sessions = new Map();
  function attach(target) {
    target.setRequestHandler(typesMod.ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "opportunity_preflight",
          inputSchema: { type: "object" },
          _meta: { x402: { accepts: [accepted] }, samedaydesk: { recovery: { version: 1, tool: "recover_paid_result", endpointUrl: endpoint, tenantId: "tenant-a" } } },
        },
        { name: "recover_paid_result", inputSchema: { type: "object" }, _meta: { samedaydesk: { paymentRequired: false } } },
      ],
    }));
    target.setRequestHandler(typesMod.CallToolRequestSchema, async (request) => {
      calls.push(request.params.name);
      process.stdout.write(`CALL ${request.params.name}\n`);
      if (mode === "lose" && request.params.name === "opportunity_preflight") throw new Error("lost_response");
      if (mode === "pending") return { isError: true, content: [{ type: "text", text: "{\"error\":\"payment_execution_in_flight_or_unknown\"}" }] };
      const result = { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body, isError: false, _meta: { "x402/payment-response": { success: false } } };
      const bad = mode === "bad" && request.params.name === "opportunity_preflight";
      result._meta["samedaydesk/recovery"] = {
        version: 1, endpointUrl: endpoint, tenantId: "tenant-a", name: "opportunity_preflight",
        inputDigest: hash(input.arguments), termsDigest: hash(accepted), paymentDigest: hash(input.payment),
        contextDigest: hash(Object.fromEntries(["operationId", "reservationId", "principalId", "grantId"].map((key) => [key, input[key]]))),
        resultDigest: bad ? "f".repeat(64) : mcpResultDigest(result),
      };
      return result;
    });
  }
  let input;
  const http = createServer(async (req, res) => {
    const sid = req.headers["mcp-session-id"];
    let session = typeof sid === "string" ? sessions.get(sid) : undefined;
    if (!session) {
      session = {};
      session.transport = new transportMod.StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => sessions.set(id, session),
      });
      session.mcp = new serverMod.Server({ name: "loopback", version: "0" }, { capabilities: { tools: {} } });
      attach(session.mcp);
      await session.mcp.connect(session.transport);
    }
    await session.transport.handleRequest(req, res);
  });
  const port = await listen(http);
  endpoint = `http://127.0.0.1:${port}/mcp`;
  input = {
    endpointUrl: endpoint, tenantId: "tenant-a", name: "opportunity_preflight", principalId: "principal-a",
    grantId: "grant-a", operationId: "operation-a", reservationId: "reservation-a", maxAtomic: "50000",
    arguments: { rewardUsd: 10, hours: 1, hourlyCostUsd: 1 },
    payment: {
      x402Version: 2, resource: { url: "mcp://tool/opportunity_preflight" }, accepted,
      payload: { signature: `0x${"4".repeat(130)}`, authorization: { from: `0x${"2".repeat(40)}`, to: accepted.payTo, value: accepted.amount, validBefore: String(Math.floor(Date.now() / 1000) + 300) } },
    },
  };
  process.stdout.write(`INPUT ${Buffer.from(JSON.stringify(input)).toString("base64")}\n`);
  process.stdout.write(`PORT ${port}\n`);
  process.stdin.resume();
} else if (kind === "direct") {
  const caller = path.resolve(flags.caller);
  const operation = JSON.parse(readFileSync(flags.operation, "utf8"));
  const grant = JSON.parse(readFileSync(flags.grant, "utf8"));
  const recovery = await import(pathToFileURL(path.join(caller, "src/mcp-recovery.mjs")).href);
  const clientMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js")).href);
  const transportMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js")).href);
  const sdk = new clientMod.Client({ name: "direct", version: "0" });
  await sdk.connect(new transportMod.StreamableHTTPClientTransport(new URL(operation.endpointUrl)));
  let saved;
  const store = {
    create: async (value) => { saved = structuredClone(value); },
    save: async (value) => { saved = structuredClone(value); return structuredClone(value); },
    load: async () => structuredClone(saved),
  };
  const direct = await (await recovery.startPaidMcpResult({
    client: {
      listTools: (...args) => sdk.listTools(...args),
      callTool: (...args) => sdk.callTool(...args),
      getToolOutputValidator: (...args) => sdk.getToolOutputValidator(...args),
      close: () => sdk.close(),
    },
    store,
    input: operation,
    loadGrant: async () => grant,
  })).handoff();
  const out = {
    structuredContent: direct.result.structuredContent,
    isError: direct.result.isError,
    resultDigest: direct.result._meta["samedaydesk/recovery"].resultDigest,
  };
  process.stdout.write(`DIRECT ${Buffer.from(JSON.stringify(out)).toString("base64")}\n`);
  await sdk.close();
} else if (kind === "feedback") {
  const caller = path.resolve(flags.caller);
  const serverMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js")).href);
  const transportMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js")).href);
  const typesMod = await import(pathToFileURL(path.join(caller, "node_modules/@modelcontextprotocol/sdk/dist/esm/types.js")).href);
  let behavior = "accept";
  const sessions = new Map();
  process.stdin.setEncoding("utf8");
  let pending = "";
  process.stdin.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("BEHAVIOR ")) {
        behavior = line.slice(9).trim();
        process.stdout.write(`READY ${behavior}\n`);
      }
    }
  });
  const http = createServer(async (req, res) => {
    const sid = req.headers["mcp-session-id"];
    let session = typeof sid === "string" ? sessions.get(sid) : undefined;
    if (!session) {
      session = {};
      session.transport = new transportMod.StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => sessions.set(id, session),
      });
      session.mcp = new serverMod.Server({ name: "feedback", version: "0" }, { capabilities: { tools: {} } });
      session.mcp.setRequestHandler(typesMod.CallToolRequestSchema, async (request) => {
        process.stdout.write(`CALL ${request.params.name} META ${request.params._meta?.["x402/payment"] ? "payment" : "none"}\n`);
        if (behavior === "lose") throw new Error("lost");
        const statement = { ok: true, accepted: true, bound: true, charged: false, payerIdentity: false, usefulness: "unknown", disposition: "useful", reasonCategory: "matched_task", idempotentReplay: false, parent: "bound", retainedDisposition: "useful", retainedReasonCategory: "matched_task", coverage: "this_retained_result_only" };
        return { content: [{ type: "text", text: JSON.stringify(statement) }], structuredContent: statement, isError: behavior === "refuse" };
      });
      await session.mcp.connect(session.transport);
    }
    await session.transport.handleRequest(req, res);
  });
  const port = await listen(http);
  process.stdout.write(`PORT ${port}\n`);
  process.stdout.write(`READY ${behavior}\n`);
  process.stdin.resume();
} else {
  process.stderr.write("usage rejected\n");
  process.exit(2);
}
