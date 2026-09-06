#!/usr/bin/env node
/**
 * Proposal-model safety test for the IdiamPro MCP server (v0.2.0).
 *
 * Spins up the BUILT server (dist/index.js) over stdio as a real MCP client
 * and proves the proposal-based trust model:
 *   (a) write tools create proposals in the sidecar and do NOT modify the
 *       target .idm (byte-compare before/after)
 *   (b) list/get/withdraw proposal tools work
 *   (c) read tools still work
 *   (d) a new-outline proposal lands in _proposed-outlines/, not the live folder
 *   (e) dangerous proposals (delete root) are refused
 *
 * Uses a TEMP outline directory under mcp-server/test-output/ — never the
 * real ~/Documents/IDM Outlines.
 *
 * Foreground only. A watchdog timer force-fails after 90s so the script
 * can never hang.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash, randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(__dirname, "..");
const SERVER_ENTRY = join(MCP_ROOT, "dist", "index.js");
const OUT_DIR = join(MCP_ROOT, "test-output", "proposal-model");
const TMP_OUTLINES = join(OUT_DIR, "tmp-outlines");

// ---- watchdog: never hang ----
const watchdog = setTimeout(() => {
  console.error("WATCHDOG: test exceeded 90s — failing hard.");
  process.exit(2);
}, 90_000);
watchdog.unref?.();

const results = [];
let failures = 0;
function check(name, cond, detail = "") {
  const pass = !!cond;
  if (!pass) failures++;
  results.push({ name, pass, detail: String(detail).slice(0, 400) });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "  — " + detail}`);
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function parseToolResult(res) {
  try {
    return JSON.parse(res.content[0].text);
  } catch {
    return { _raw: res.content?.[0]?.text };
  }
}

// ---- build the temp outline fixture ----
rmSync(TMP_OUTLINES, { recursive: true, force: true });
mkdirSync(TMP_OUTLINES, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const rootId = randomUUID();
const nodeA = randomUUID();
const nodeB = randomUUID();
const nodeC = randomUUID();
const OUTLINE_FILE = "Test Outline.idm";
const outline = {
  id: randomUUID(),
  name: "Test Outline",
  rootNodeId: rootId,
  nodes: {
    [rootId]: { id: rootId, name: "Test Outline", content: "", type: "root", parentId: null, childrenIds: [nodeA, nodeB], prefix: "" },
    [nodeA]: { id: nodeA, name: "Alpha", content: "<p>alpha body</p>", type: "document", parentId: rootId, childrenIds: [nodeC], prefix: "" },
    [nodeB]: { id: nodeB, name: "Beta", content: "<p>beta body</p>", type: "document", parentId: rootId, childrenIds: [], prefix: "", metadata: { tags: ["existing"] } },
    [nodeC]: { id: nodeC, name: "Gamma", content: "", type: "document", parentId: nodeA, childrenIds: [], prefix: "" },
  },
  createdAt: new Date().toISOString(),
  lastModified: Date.now(),
};
const outlinePath = join(TMP_OUTLINES, OUTLINE_FILE);
writeFileSync(outlinePath, JSON.stringify(outline, null, 2), "utf-8");
const bytesBefore = readFileSync(outlinePath);
const hashBefore = sha256(bytesBefore);

async function main() {
  // ---- connect a real MCP client over stdio ----
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY, "--outlines-dir", TMP_OUTLINES, "--agent-label", "test-agent"],
  });
  const client = new Client({ name: "proposal-model-test", version: "1.0.0" });
  await client.connect(transport);

  const call = (name, args = {}) => client.callTool({ name, arguments: args });

  // ---- tool inventory ----
  const tools = (await client.listTools()).tools.map((t) => t.name);
  for (const t of ["list_proposals", "get_proposal", "withdraw_proposal"]) {
    check(`tool registered: ${t}`, tools.includes(t));
  }
  for (const t of ["create_node", "update_node", "delete_node", "move_node", "create_outline", "add_tag", "remove_tag"]) {
    check(`tool still present (back-compat name): ${t}`, tools.includes(t));
  }

  // ---- (c) reads still work ----
  const listRes = parseToolResult(await call("list_outlines"));
  check("read: list_outlines finds the fixture", Array.isArray(listRes) && listRes.length === 1 && listRes[0].fileName === OUTLINE_FILE, JSON.stringify(listRes));
  const getRes = parseToolResult(await call("get_outline", { fileName: OUTLINE_FILE }));
  check("read: get_outline returns full structure", getRes.rootNodeId === rootId && Object.keys(getRes.nodes).length === 4);
  const searchRes = parseToolResult(await call("search_nodes", { query: "beta" }));
  check("read: search_nodes matches content", Array.isArray(searchRes) && searchRes.some((r) => r.nodeId === nodeB));
  const exportRes = await call("export_outline", { fileName: OUTLINE_FILE });
  check("read: export_outline produces markdown", exportRes.content[0].text.includes("# Test Outline"));

  // ---- (a) write tools → proposals, no mutation ----
  const writeCalls = [
    ["create_node", { fileName: OUTLINE_FILE, parentId: rootId, name: "Proposed child", content: "<p>new</p>", position: 1 }, "add_node"],
    ["update_node", { fileName: OUTLINE_FILE, nodeId: nodeA, name: "Alpha Renamed" }, "rewrite_node"],
    ["delete_node", { fileName: OUTLINE_FILE, nodeId: nodeC }, "delete_node"],
    ["move_node", { fileName: OUTLINE_FILE, nodeId: nodeC, newParentId: rootId }, "move_node"],
    ["add_tag", { fileName: OUTLINE_FILE, nodeId: nodeA, tag: "urgent" }, "rewrite_node"],
    ["remove_tag", { fileName: OUTLINE_FILE, nodeId: nodeB, tag: "existing" }, "rewrite_node"],
  ];
  const proposalIds = [];
  for (const [tool, args, expectedKind] of writeCalls) {
    const res = parseToolResult(await call(tool, args));
    const ok = res.status === "proposed" && res.proposalId && res.kind === expectedKind && /nothing has been changed/i.test(res.message || "");
    check(`write→proposal: ${tool} returns status=proposed kind=${expectedKind}`, ok, JSON.stringify(res));
    if (res.proposalId) proposalIds.push(res.proposalId);
  }

  // dangerous request refused
  const rootDel = await call("delete_node", { fileName: OUTLINE_FILE, nodeId: rootId });
  check("safety: proposing root deletion is refused", rootDel.isError === true, JSON.stringify(parseToolResult(rootDel)));

  // BYTE-COMPARE: the .idm must be untouched
  const bytesAfterWrites = readFileSync(outlinePath);
  check(
    "NO-MUTATION PROOF: .idm bytes identical after all write tools",
    bytesAfterWrites.equals(bytesBefore) && sha256(bytesAfterWrites) === hashBefore,
    `before=${hashBefore.slice(0, 12)} after=${sha256(bytesAfterWrites).slice(0, 12)}`
  );

  // sidecar exists with the six pending proposals
  const sidecarPath = join(TMP_OUTLINES, `${OUTLINE_FILE}.proposals.json`);
  check("sidecar file created next to outline", existsSync(sidecarPath));
  const sidecar = JSON.parse(readFileSync(sidecarPath, "utf-8"));
  check("sidecar holds 6 proposals, all pending", Array.isArray(sidecar) && sidecar.length === 6 && sidecar.every((p) => p.status === "pending"), `count=${sidecar.length}`);
  check("sidecar proposals carry agent label", sidecar.every((p) => p.agent === "test-agent"));
  check("rewrite proposal includes previous snapshot for diffing", sidecar.some((p) => p.kind === "rewrite_node" && p.payload.previous));
  check("delete proposal reports descendant count", sidecar.some((p) => p.kind === "delete_node" && typeof p.payload.descendantCount === "number"));

  // ---- (b) proposal management tools ----
  const listAll = parseToolResult(await call("list_proposals", {}));
  check("list_proposals (all) returns 6", listAll.count === 6, JSON.stringify(listAll.count));
  const listOne = parseToolResult(await call("list_proposals", { fileName: OUTLINE_FILE }));
  check("list_proposals (per outline) returns 6", listOne.count === 6);
  const got = parseToolResult(await call("get_proposal", { proposalId: proposalIds[0] }));
  check("get_proposal returns the full record", got.id === proposalIds[0] && got.kind === "add_node" && got.status === "pending");
  const withdrawn = parseToolResult(await call("withdraw_proposal", { proposalId: proposalIds[0] }));
  check("withdraw_proposal marks it withdrawn", withdrawn.status === "withdrawn");
  const afterWithdraw = parseToolResult(await call("list_proposals", { fileName: OUTLINE_FILE, status: "pending" }));
  check("after withdrawal, 5 pending remain (record kept)", afterWithdraw.count === 5);
  const doubleWithdraw = await call("withdraw_proposal", { proposalId: proposalIds[0] });
  check("withdrawing twice is refused", doubleWithdraw.isError === true);
  const missing = await call("get_proposal", { proposalId: "no-such-id" });
  check("get_proposal for unknown id errors cleanly", missing.isError === true);

  // ---- (d) new-outline proposal → _proposed-outlines/, not live folder ----
  const created = parseToolResult(await call("create_outline", { name: "Draft Ideas" }));
  check("create_outline returns status=proposed kind=new_outline", created.status === "proposed" && created.kind === "new_outline", JSON.stringify(created));
  const proposedDir = join(TMP_OUTLINES, "_proposed-outlines");
  check("draft .idm exists in _proposed-outlines/", existsSync(join(proposedDir, "Draft Ideas.idm")));
  check("new-outline proposal index exists in _proposed-outlines/", existsSync(join(proposedDir, "_proposals.json")));
  const liveIdmFiles = readdirSync(TMP_OUTLINES).filter((f) => f.endsWith(".idm"));
  check("live folder root still contains ONLY the original .idm", liveIdmFiles.length === 1 && liveIdmFiles[0] === OUTLINE_FILE, JSON.stringify(liveIdmFiles));
  const listWithNew = parseToolResult(await call("list_proposals", {}));
  check("list_proposals (all) now includes the new-outline proposal (7)", listWithNew.count === 7);

  // final byte-compare after everything
  const bytesFinal = readFileSync(outlinePath);
  check("NO-MUTATION PROOF (final): .idm bytes still identical", bytesFinal.equals(bytesBefore));

  await client.close();
}

main()
  .catch((err) => {
    failures++;
    results.push({ name: "unhandled error", pass: false, detail: String(err?.stack || err).slice(0, 800) });
    console.error("UNHANDLED:", err);
  })
  .finally(() => {
    const summary = {
      suite: "proposal-model-test",
      when: new Date().toISOString(),
      total: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: failures,
      results,
    };
    writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(summary, null, 2));
    writeFileSync(
      join(OUT_DIR, "report.md"),
      `# Proposal Model Test\n\n${summary.when} — ${summary.passed}/${summary.total} passed\n\n` +
        results.map((r) => `- ${r.pass ? "✅" : "❌"} ${r.name}${r.pass ? "" : ` — ${r.detail}`}`).join("\n") + "\n"
    );
    console.log(`\n${summary.passed}/${summary.total} checks passed${failures ? ` — ${failures} FAILED` : ""}`);
    clearTimeout(watchdog);
    process.exit(failures ? 1 : 0);
  });
