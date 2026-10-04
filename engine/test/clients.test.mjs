// The same plugin under Claude Code, GitHub Copilot CLI and VS Code: one reading of their
// tool calls, and the project found the way each client starts the engine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { toolCall } from '../lib/toolcall.mjs';
import { PLUGIN, makeRepo, removeRepo } from './helpers.mjs';

const ENV_MODULE = pathToFileURL(path.join(PLUGIN, 'engine', 'lib', 'env.mjs')).href;
const same = (a, b) => fs.realpathSync.native(a) === fs.realpathSync.native(b);

// The environment a client would give the engine: none of this machine's project hints.
function bareEnv(extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ONESTOP_|CLAUDE_PROJECT_DIR$|PWD$|COPILOT_)/.test(k)));
  return { ...env, ...extra };
}

test('every client\'s tool calls read the same', () => {
  const tc = (tool_name, tool_input) => toolCall({ tool_name, tool_input });
  // Claude Code
  assert.equal(tc('Bash', { command: 'ls' }).command, 'ls');
  assert.deepEqual(tc('MultiEdit', { file_path: 'a.ts', edits: [{ old_string: 'x', new_string: 'y' }] }).files, ['a.ts']);
  assert.equal(tc('NotebookEdit', { notebook_path: 'n.ipynb', new_source: 'print(1)' }).text, 'print(1)');
  assert.equal(tc('Agent', { subagent_type: 'onestop:planner' }).agent, 'onestop:planner');
  assert.equal(tc('mcp__plugin_onestop_engine__run_open', {}).kind, 'run-open');
  // GitHub Copilot CLI: Claude's tool names, its own arguments
  const created = tc('Write', { path: 'b.ts', file_text: 'B' });
  assert.deepEqual([created.kind, created.files, created.text], ['write', ['b.ts'], 'B']);
  assert.equal(tc('Edit', { path: 'b.ts', old_str: 'B', new_str: 'C' }).text, 'C');
  assert.equal(tc('str_replace_editor', { command: 'view', path: 'b.ts' }).kind, 'other', 'a read through the edit tool is a read');
  assert.equal(tc('Agent', { agent_type: 'onestop:planner', name: 'plan' }).agent, 'onestop:planner');
  assert.equal(tc('engine-run_open', {}).kind, 'run-open');
  assert.equal(toolCall({ toolName: 'bash', toolArgs: '{"command":"ls"}' }).command, 'ls', 'native camelCase payloads too');
  // VS Code
  assert.equal(tc('run_in_terminal', { command: 'npm test', isBackground: false }).kind, 'shell');
  assert.deepEqual(tc('multi_replace_string_in_file', { replacements: [{ filePath: 'x.ts', newString: 'X' }, { filePath: 'y.ts', newString: 'Y' }] }).files, ['x.ts', 'y.ts']);
  const patch = tc('apply_patch', { input: '*** Begin Patch\n*** Add File: new.ts\n+export const n = 1;\n*** Update File: old.ts\n*** Move to: moved.ts\n@@\n-a\n+b\n*** Delete File: gone.ts\n*** End Patch' });
  assert.deepEqual(patch.files, ['new.ts', 'old.ts', 'moved.ts', 'gone.ts']);
  assert.equal(patch.text, 'export const n = 1;\nb');
  assert.equal(tc('read_file', { filePath: 'x.ts' }).kind, 'other');
  assert.equal(tc('runSubagent', { agentName: 'onestop:validator' }).agent, 'onestop:validator');
});

test('the engine finds the project however the client starts it', () => {
  const project = makeRepo({ 'package.json': '{}' });
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'onestop-copilot-home-'));
  const rootIn = (env, cwd = PLUGIN) => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { projectRoot } from ${JSON.stringify(ENV_MODULE)}; process.stdout.write(String(projectRoot()));`,
  ], { cwd, env: bareEnv(env), encoding: 'utf8' }).stdout;
  try {
    assert.equal(rootIn({}), 'null', 'started in the plugin folder with nothing to go on, it asks rather than guesses');
    assert.ok(same(rootIn({ CLAUDE_PROJECT_DIR: project }), project), 'Claude Code names it');
    fs.mkdirSync(path.join(home, 'session-state', 'sess-1'), { recursive: true });
    fs.writeFileSync(path.join(home, 'session-state', 'sess-1', 'workspace.yaml'), `id: sess-1\ncwd: ${project}\nclient_name: github/cli\n`);
    assert.ok(same(rootIn({ COPILOT_AGENT_SESSION_ID: 'sess-1', COPILOT_HOME: home }), project), 'Copilot CLI records it');
    assert.ok(same(rootIn({}, project), project), 'a client that starts the engine in the project');
  } finally {
    removeRepo(project);
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// A minimal MCP client that answers the server's roots/list with `roots`.
function client({ roots = null } = {}) {
  const srv = spawn(process.execPath, [path.join(PLUGIN, 'engine', 'server.mjs')], { cwd: PLUGIN, env: bareEnv() });
  const waiting = new Map();
  let id = 0;
  let rootsAsked = 0;
  const write = (m) => srv.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...m })}\n`);
  readline.createInterface({ input: srv.stdout }).on('line', (line) => {
    const msg = JSON.parse(line);
    if (msg.method === 'roots/list') {
      rootsAsked += 1;
      write({ id: msg.id, result: { roots: roots.map((d) => ({ uri: pathToFileURL(d).href, name: 'workspace' })) } });
      return;
    }
    waiting.get(msg.id)?.(msg);
  });
  const rpc = (method, params = {}) => new Promise((resolve) => {
    const n = ++id;
    waiting.set(n, resolve);
    write({ id: n, method, params });
  });
  const tool = async (name, args = {}) => JSON.parse((await rpc('tools/call', { name, arguments: args })).result.content[0].text);
  const start = async () => {
    await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: roots ? { roots: { listChanged: true } } : {}, clientInfo: { name: 'test', version: '0' } });
    write({ method: 'notifications/initialized' });
    await rpc('ping');
  };
  return { start, tool, rootsAsked: () => rootsAsked, stop: () => srv.kill() };
}

test('the engine takes the project from MCP roots (VS Code)', async () => {
  const project = makeRepo({ 'package.json': '{"name":"x"}' }, { git: true });
  const c = client({ roots: [project] });
  try {
    await c.start();
    assert.equal(c.rootsAsked(), 1);
    const status = await c.tool('run_status');
    assert.ok(same(status.project, project), `engine used ${status.project}`);
    assert.ok(fs.existsSync(path.join(status.plugin_root, 'registry', 'intents.json')), 'and says where its own files are');
  } finally {
    c.stop();
    removeRepo(project);
  }
});

test('with nothing to go on, the engine asks for the project once and keeps the answer', async () => {
  const project = makeRepo({ 'package.json': '{"name":"x"}' }, { git: true });
  const c = client();
  try {
    await c.start();
    const asked = await c.tool('run_status');
    assert.equal(asked.ok, false);
    assert.match(asked.hint, /project_dir/);
    assert.ok(same((await c.tool('run_status', { project_dir: project })).project, project));
    assert.ok(same((await c.tool('run_status')).project, project), 'kept for the session');
  } finally {
    c.stop();
    removeRepo(project);
  }
});
