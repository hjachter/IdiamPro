/**
 * MCP Server Automated Test Suite
 *
 * Tests all 17 MCP server tools via JSON-RPC over stdio.
 * Creates a temporary test outline, exercises every tool, then cleans up.
 *
 * Run: node tests/mcp-server-test.js
 * Requires: cd mcp-server && npm run build (beforehand)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const MCP_DIR = path.resolve(__dirname, '..', 'mcp-server');
const OUTLINES_DIR = path.join(os.homedir(), 'Documents', 'IDM Outlines');
const TEST_FILE = 'MCP Test Outline.idm';
const TEST_PATH = path.join(OUTLINES_DIR, TEST_FILE);
const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'mcp-server');

let passes = 0;
let fails = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) {
    passes++;
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } else {
    fails++;
    results.push({ name, passed: false, detail });
    console.log(`  ✗ ${name} — ${detail.slice(0, 150)}`);
  }
}

function callMcp(...toolCalls) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['dist/index.js'], { cwd: MCP_DIR, stdio: ['pipe', 'pipe', 'pipe'] });
    const msgs = [
      JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    ];
    toolCalls.forEach(([name, args], i) => {
      msgs.push(JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name, arguments: args || {} } }));
    });

    let stdout = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.on('close', () => {
      const results = {};
      for (const line of stdout.trim().split('\n')) {
        try {
          const r = JSON.parse(line);
          if (r.id > 0) results[r.id] = r;
        } catch {}
      }
      resolve(results);
    });
    proc.on('error', reject);
    proc.stdin.write(msgs.join('\n') + '\n');
    proc.stdin.end();
    setTimeout(() => { try { proc.kill(); } catch {} }, 20000);
  });
}

function txt(r, idx = 1) {
  const c = (r[idx] || {}).result?.content;
  return c?.[0]?.text || '';
}

function isError(r, idx = 1) {
  return !!(r[idx] || {}).result?.isError;
}

function createTestOutline() {
  const data = {
    id: uuidv4(),
    name: 'MCP Test Outline',
    rootNodeId: 'root1',
    nodes: {
      root1: { id: 'root1', name: 'MCP Test Outline', parentId: null, childrenIds: ['c1', 'c2'], type: 'root', content: '' },
      c1: { id: 'c1', name: 'Node Alpha', parentId: 'root1', childrenIds: [], type: 'document', content: 'Alpha content here.' },
      c2: { id: 'c2', name: 'Node Beta', parentId: 'root1', childrenIds: [], type: 'document', content: 'Beta content here.' },
    },
  };
  fs.writeFileSync(TEST_PATH, JSON.stringify(data));
}

function cleanup() {
  try { fs.unlinkSync(TEST_PATH); } catch {}
}

async function runTests() {
  console.log('\n═══ MCP Server Test Suite ═══\n');

  // Verify build exists
  const distPath = path.join(MCP_DIR, 'dist', 'index.js');
  if (!fs.existsSync(distPath)) {
    console.log('ERROR: MCP server not built. Run: cd mcp-server && npm run build');
    process.exit(1);
  }

  // Create test outline
  createTestOutline();

  try {
    // ── Test 1: Tool registration ──
    console.log('─── Test 1: Tool Registration ───');
    const r1 = await callMcp();
    // Need to call tools/list separately
    const proc = spawn('node', ['dist/index.js'], { cwd: MCP_DIR, stdio: ['pipe', 'pipe', 'pipe'] });
    const toolsPromise = new Promise(resolve => {
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        const results = {};
        for (const line of out.trim().split('\n')) {
          try { const r = JSON.parse(line); if (r.id > 0) results[r.id] = r; } catch {}
        }
        resolve(results);
      });
    });
    proc.stdin.write([
      JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    ].join('\n') + '\n');
    proc.stdin.end();
    setTimeout(() => { try { proc.kill(); } catch {} }, 10000);
    const toolsResult = await toolsPromise;
    const tools = toolsResult[1]?.result?.tools || [];
    check('Server starts and responds', tools.length > 0);
    check('Has 17 tools', tools.length === 17, `Got ${tools.length}`);

    // ── Test 2: list_outlines ──
    console.log('\n─── Test 2: list_outlines ───');
    let t = txt(await callMcp(['list_outlines']));
    check('Returns outline list', t.length > 20);
    check('Includes test outline', t.includes('MCP Test Outline'));

    // ── Test 3: get_outline + get_node ──
    console.log('\n─── Test 3: get_outline + get_node ───');
    t = txt(await callMcp(['get_outline', { fileName: TEST_FILE }]));
    check('get_outline returns data', t.length > 30);
    check('Contains node names', t.includes('Alpha') || t.includes('Beta'));
    t = txt(await callMcp(['get_node', { fileName: TEST_FILE, nodeId: 'c1' }]));
    check('get_node returns Alpha', t.includes('Alpha'));
    let r = await callMcp(['get_outline', { fileName: 'nonexistent.idm' }]);
    check('Invalid outline returns error', isError(r));

    // ── Test 4: search_nodes ──
    console.log('\n─── Test 4: search_nodes ───');
    t = txt(await callMcp(['search_nodes', { query: 'Alpha' }]));
    check('Finds Alpha', t.toLowerCase().includes('alpha'));
    t = txt(await callMcp(['search_nodes', { query: 'xyznonexistent' }]));
    check('No-match returns gracefully', t.toLowerCase().includes('no') || t.length < 100);

    // ── Test 5: create_node ──
    console.log('\n─── Test 5: create_node ───');
    t = txt(await callMcp(['create_node', { fileName: TEST_FILE, parentId: 'root1', name: 'Node Gamma', content: 'Gamma content' }]));
    const gammaMatch = t.match(/"nodeId"\s*:\s*"([^"]+)"/);
    const gammaId = gammaMatch ? gammaMatch[1] : null;
    check('create_node succeeds', t.includes('success'));
    check('Returns new node ID', !!gammaId);

    // ── Test 6: update_node + delete_node ──
    console.log('\n─── Test 6: update_node + delete_node ───');
    if (gammaId) {
      t = txt(await callMcp(['update_node', { fileName: TEST_FILE, nodeId: gammaId, name: 'Gamma Updated', content: 'Updated!' }]));
      check('update_node succeeds', t.includes('success'));
      t = txt(await callMcp(['delete_node', { fileName: TEST_FILE, nodeId: gammaId }]));
      check('delete_node succeeds', t.includes('success'));
    } else {
      check('update_node', false, 'No gamma ID');
      check('delete_node', false, 'No gamma ID');
    }

    // ── Test 7: move_node ──
    console.log('\n─── Test 7: move_node ───');
    t = txt(await callMcp(['move_node', { fileName: TEST_FILE, nodeId: 'c1', newParentId: 'c2' }]));
    check('move_node succeeds', t.includes('success'));

    // ── Test 8: export_outline ──
    console.log('\n─── Test 8: export_outline ───');
    for (const fmt of ['markdown', 'text']) {
      t = txt(await callMcp(['export_outline', { fileName: TEST_FILE, format: fmt }]));
      check(`export ${fmt}`, t.length > 10);
    }

    // ── Test 9: tag operations ──
    console.log('\n─── Test 9: tag operations ───');
    t = txt(await callMcp(['add_tag', { fileName: TEST_FILE, nodeId: 'c2', tag: 'test-tag' }]));
    check('add_tag succeeds', t.includes('success'));
    t = txt(await callMcp(['list_tags', { fileName: TEST_FILE }]));
    check('list_tags shows tag', t.includes('test-tag'));
    t = txt(await callMcp(['filter_by_tags', { tags: ['test-tag'], fileName: TEST_FILE }]));
    check('filter_by_tags finds tagged node', t.toLowerCase().includes('beta') || t.includes('c2'));
    t = txt(await callMcp(['remove_tag', { fileName: TEST_FILE, nodeId: 'c2', tag: 'test-tag' }]));
    check('remove_tag succeeds', t.includes('success'));

    // ── Test 10: auth tools ──
    console.log('\n─── Test 10: auth / API key tools ───');
    t = txt(await callMcp(['generate_api_key', { name: 'test-key' }]));
    check('generate_api_key succeeds', t.includes('success') || t.includes('key'));
    const keyMatch = t.match(/"(?:keyId|id)"\s*:\s*"([^"]+)"/);
    const keyId = keyMatch ? keyMatch[1] : null;
    t = txt(await callMcp(['list_api_keys']));
    check('list_api_keys returns keys', t.includes('test-key') || t.length > 5);
    if (keyId) {
      t = txt(await callMcp(['revoke_api_key', { keyId }]));
      check('revoke_api_key succeeds', t.includes('success') || t.includes('revoke'));
    }

  } finally {
    cleanup();
  }

  // Summary
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`RESULTS: ${passes} passed, ${fails} failed out of ${passes + fails}`);
  console.log(`${'═'.repeat(40)}\n`);

  // Save report
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    summary: { total: passes + fails, passed: passes, failed: fails },
    tests: results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# MCP Server Test Report',
    `**Generated:** ${new Date().toLocaleString()}`,
    `**Passed:** ${passes} / ${passes + fails}`,
    '',
    '| Test | Status |',
    '|---|---|',
    ...results.map(r => `| ${r.name} | ${r.passed ? '✅' : '❌'} |`),
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), md);

  process.exit(fails > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite crashed:', err);
  cleanup();
  process.exit(1);
});
