// What a tool call does, whichever client made it.
//
// The hooks run under Claude Code, GitHub Copilot CLI and VS Code. Claude Code names its
// tools Bash, Write, Edit. Copilot CLI reports the same names to Claude-format hooks but
// keeps its own arguments (path, file_text, old_str). VS Code reports its own tools
// (run_in_terminal, create_file, replace_string_in_file, apply_patch). The guard asks the
// same questions of all of them: is this a shell command, which files does it write and
// with what text, does it dispatch an agent, and is it the engine's run_open.

const SHELL = new Set(['bash', 'powershell', 'shell', 'execute', 'run_in_terminal']);
const WRITE = new Set([
  'edit', 'write', 'multiedit', 'notebookedit',
  'create', 'str_replace_editor', 'apply_patch',
  'create_file', 'replace_string_in_file', 'multi_replace_string_in_file',
  'insert_edit_into_file', 'edit_notebook_file', 'editfiles',
]);
const AGENT = new Set(['agent', 'task', 'runsubagent']);
const PATH_KEYS = ['file_path', 'filePath', 'path', 'notebook_path'];
const TEXT_KEYS = ['content', 'file_text', 'new_string', 'new_str', 'newString', 'new_source', 'newCode', 'code'];
// str_replace_editor reads with the same tool it writes with.
const READS = new Set(['view', 'read']);

function argsOf(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return { input: raw }; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

const strings = (items, keys) => items.flatMap((o) => keys.map((k) => o?.[k]).filter((v) => typeof v === 'string'));

// Claude Code: mcp__plugin_onestop_engine__run_open. Copilot CLI: engine-run_open. VS Code
// adds its own prefix. Each ends in run_open and names the engine.
export function isRunOpen(name) {
  return /run_open$/.test(name) && /engine/i.test(name);
}

export function toolCall(payload = {}) {
  const name = String(payload.tool_name ?? payload.toolName ?? '');
  const input = argsOf(payload.tool_input ?? payload.toolArgs);
  const key = name.toLowerCase();
  const call = { name, input, kind: 'other', command: '', files: [], text: '', agent: '' };
  if (isRunOpen(name)) return { ...call, kind: 'run-open' };
  if (SHELL.has(key)) return { ...call, kind: 'shell', command: String(input.command ?? '') };
  if (AGENT.has(key)) return { ...call, kind: 'agent', agent: String(input.subagent_type || input.agent_type || input.agentName || '') };
  if (!WRITE.has(key) || READS.has(String(input.command ?? '').toLowerCase())) return call;

  const items = [input, ...[input.edits, input.replacements].flatMap((l) => (Array.isArray(l) ? l : []))];
  const files = strings(items, PATH_KEYS).filter(Boolean);
  const text = strings(items, TEXT_KEYS);
  // apply_patch carries every file in one text: "*** Update File: <path>" headers and
  // "+"-prefixed added lines.
  const patch = Object.values(input).filter((v) => typeof v === 'string' && v.includes('*** Begin Patch')).join('\n');
  for (const m of patch.matchAll(/^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/gm)) files.push(m[1].trim());
  for (const line of patch.split('\n')) if (line.startsWith('+') && !line.startsWith('+++')) text.push(line.slice(1));
  return { ...call, kind: 'write', files: [...new Set(files)], text: text.join('\n') };
}
