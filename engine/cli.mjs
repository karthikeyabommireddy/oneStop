#!/usr/bin/env node
// Command-line front door to the engine - for tests, evals, background graph builds,
// and anyone who wants to see exactly what the orchestrator would see.
//
//   node engine/cli.mjs call <tool> ['<json args>'] [--project <dir>]
//   node engine/cli.mjs classify "<request>"         [--project <dir>]
//   node engine/cli.mjs kg <status|build-sync|refresh-sync> [--project <dir>]
//   node engine/cli.mjs tools

import { projectRoot } from './lib/env.mjs';
import { TOOLS, callTool } from './lib/tools.mjs';
import { kgBuildSync, kgRefreshSync, kgStatus } from './lib/kg.mjs';

const argv = process.argv.slice(2);
let project;
const at = argv.indexOf('--project');
if (at >= 0) {
  project = argv[at + 1];
  argv.splice(at, 2);
}
const [command, ...rest] = argv;

function out(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result && result.ok === false ? 1 : 0;
}

switch (command) {
  case 'call': {
    let args = {};
    try { args = rest[1] ? JSON.parse(rest[1]) : {}; } catch (e) { out({ ok: false, error: `arguments are not valid JSON: ${e.message}` }); break; }
    if (project) args.project_dir = project;
    out(callTool(rest[0], args));
    break;
  }
  case 'classify':
    out(callTool('classify', { request: rest.join(' '), ...(project ? { project_dir: project } : {}) }));
    break;
  case 'kg': {
    const root = projectRoot(project);
    const sub = rest[0] || 'status';
    if (sub === 'build-sync') out(kgBuildSync(root));
    else if (sub === 'refresh-sync') out(kgRefreshSync(root));
    else out({ ok: true, ...kgStatus(root) });
    break;
  }
  case 'tools':
    out({ ok: true, tools: TOOLS.map((t) => t.name) });
    break;
  default:
    process.stderr.write('usage: cli.mjs call <tool> [json] | classify <request> | kg <status|build-sync|refresh-sync> | tools   [--project <dir>]\n');
    process.exitCode = 2;
}
