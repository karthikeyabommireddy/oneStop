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
import { PLUGIN_ROOT } from './lib/env.mjs';
import { TOOLS, callTool } from './lib/tools.mjs';

let VERSION = '0.0.0';
try { VERSION = fs.readFileSync(path.join(PLUGIN_ROOT, 'VERSION'), 'utf8').trim(); } catch { /* unversioned checkout */ }

const INSTRUCTIONS = 'onestop pipeline engine. Use these tools only inside an /onestop run: they hold the run state, gates, checkpoints and retry budgets, and refuse out-of-order moves - follow the hint in any refusal. Outside an /onestop run, ignore them.';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(msg) {
  const { id, method, params = {} } = msg;
  const reply = (result) => send({ jsonrpc: '2.0', id, result });
  const error = (code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize':
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
