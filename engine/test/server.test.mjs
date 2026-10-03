// The engine as Claude Code sees it: an MCP server on stdio.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { PLUGIN, makeRepo, removeRepo } from './helpers.mjs';

function startServer(dir) {
  const srv = spawn(process.execPath, [path.join(PLUGIN, 'engine', 'server.mjs')], {
    env: { ...process.env, ONESTOP_PROJECT_DIR: dir },
  });
  let buf = '';
  let id = 0;
  const waiting = new Map();
  srv.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      waiting.get(msg.id)?.(msg);
      waiting.delete(msg.id);
    }
  });
  const rpc = (method, params = {}) => new Promise((resolve) => {
    const n = ++id;
    waiting.set(n, resolve);
    srv.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: n, method, params })}\n`);
  });
  const callTool = async (name, args = {}) => JSON.parse((await rpc('tools/call', { name, arguments: args })).result.content[0].text);
  return { srv, rpc, callTool, stop: () => srv.kill() };
}

test('the engine speaks MCP over stdio', async () => {
  const dir = makeRepo({ 'package.json': '{"name":"x"}' }, { git: true });
  const s = startServer(dir);
  try {
    const init = await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    assert.equal(init.result.serverInfo.name, 'onestop-engine');
    assert.equal(init.result.protocolVersion, '2025-06-18');

    const list = await s.rpc('tools/list');
    const names = list.result.tools.map((t) => t.name);
    assert.equal(names.length, 18);
    for (const required of ['run_open', 'phase_start', 'phase_finish', 'gate_record', 'brief', 'checkpoint_revert']) {
      assert.ok(names.includes(required), required);
    }
    for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object', t.name);

    assert.equal((await s.callTool('classify', { request: 'the checkout page crashes on submit' })).intent, 'defect');
    assert.equal((await s.callTool('run_open', { request: 'fix the crash' })).created, true);
    assert.equal((await s.callTool('run_status')).request, 'fix the crash');

    const unknown = await s.rpc('tools/call', { name: 'no_such_tool', arguments: {} });
    assert.equal(unknown.error.code, -32602);
    const refused = await s.rpc('tools/call', { name: 'phase_start', arguments: { phase: 'implement' } });
    assert.equal(refused.result.isError, false, 'a refusal is an answer, not a malfunction');
    assert.ok((await s.rpc('ping')).result);
  } finally {
    s.stop();
    removeRepo(dir);
  }
});
