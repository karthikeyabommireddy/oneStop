#!/usr/bin/env node
// onestop pipeline engine - MCP server over stdio.
//
// "The orchestrator decides, code enforces the rules." This process is the code half:
// it holds the run's state, gates, checkpoints and budgets, and refuses moves the rules
// forbid. It is a thin JSON-RPC transport over engine/lib/tools.mjs - newline-delimited
// messages on stdin and stdout, nothing else ever written to stdout. Zero dependencies,
// so there is nothing to install and nothing to pull from a registry at run time.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { PLUGIN_ROOT, setClientRoot } from './lib/env.mjs';
import { TOOLS, callTool } from './lib/tools.mjs';

let VERSION = '0.0.0';
try { VERSION = fs.readFileSync(path.join(PLUGIN_ROOT, 'VERSION'), 'utf8').trim(); } catch { /* unversioned checkout */ }

const INSTRUCTIONS = 'onestop pipeline engine. Use these tools only inside an /onestop run: they hold the run state, gates, checkpoints and retry budgets, and refuse out-of-order moves - follow the hint in any refusal. Outside an /onestop run, ignore them.';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

// MCP roots: a client that has them (VS Code) names its workspace folders - the project,
// when nothing more specific does. Asked after the handshake and whenever they change.
let clientHasRoots = false;
let rootsAsked = 0;
const ROOTS_ID = 'onestop-roots-';

function askRoots() {
  if (clientHasRoots) send({ jsonrpc: '2.0', id: `${ROOTS_ID}${++rootsAsked}`, method: 'roots/list' });
}

// The only requests this server sends are roots/list; any other response is ignored.
function takeResponse({ id, result }) {
  if (!String(id).startsWith(ROOTS_ID) || !Array.isArray(result?.roots)) return;
  const first = result.roots.find((r) => String(r?.uri || '').startsWith('file:'));
  setClientRoot(first ? fileURLToPath(first.uri) : null);
}

function handle(msg) {
  const { id, method, params = {} } = msg;
  const reply = (result) => send({ jsonrpc: '2.0', id, result });
  const error = (code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
  if (!method) return takeResponse(msg);

  switch (method) {
    case 'notifications/initialized':
    case 'notifications/roots/list_changed':
      return askRoots();
    case 'initialize':
      clientHasRoots = Boolean(params.capabilities?.roots);
      return reply({
        protocolVersion: params.protocolVersion || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'onestop-engine', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      if (!TOOLS.some((t) => t.name === params.name)) return error(-32602, `unknown tool: ${params.name}`);
      const result = callTool(params.name, params.arguments || {});
      // A refusal is an answer, not a malfunction: only an engine exception is an error.
      return reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 1) }], isError: Boolean(result && result.engine_error) });
    }
    default:
      if (method && method.startsWith('notifications/')) return undefined;
      if (id !== undefined && id !== null) return error(-32601, `method not found: ${method}`);
      return undefined;
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
    return;
  }
  try {
    handle(msg);
  } catch (e) {
    if (msg && msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `internal error: ${e.message}` } });
    process.stderr.write(`onestop-engine: ${e.stack || e.message}\n`);
  }
});
rl.on('close', () => process.exit(0));
