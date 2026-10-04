"""Validate the onestop plugin for internal consistency.

Exits non-zero on any error, so it can gate CI. Checks:
  1. every JSON file parses
  2. plugin.json and marketplace.json agree on name and version
  3. every phase named in an intent phase_mask has a skill or is a declared inline phase
  4. every agent named in intents.json and stacks.json exists on disk
  5. every skill named in stacks.json exists
  6. every agent and skill file has usable frontmatter
  7. the derived registries are in sync with what is on disk

Usage:  python scripts/validate.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FM = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)

# Phases the orchestrate skill handles inline rather than in a phase-* skill.
INLINE_PHASES = {"intake", "flow-decomposition"}

# Phases with no delegated specialist: intake is run by the engine. Everything else must
# have an agent declaring it, or the phase has nobody to execute it.
ORCHESTRATOR_PHASES = {"intake"}

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load_json(rel):
    p = os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        err("missing file: " + rel)
        return None
    try:
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as e:
        err("invalid JSON in " + rel + ": " + str(e))
        return None


def frontmatter(path):
    try:
        with open(path, encoding="utf-8") as fh:
            m = FM.match(fh.read())
    except (OSError, UnicodeDecodeError) as e:
        return None
    if not m:
        return None
    out = {}
    for line in m.group(1).split("\n"):
        if ":" in line and not line.startswith((" ", "\t", "#")):
            k, _, v = line.partition(":")
            out[k.strip()] = v.strip()
    return out


def agent_names():
    names = set()
    d = os.path.join(ROOT, "agents")
    for fn in os.listdir(d):
        if fn.endswith(".md"):
            fm = frontmatter(os.path.join(d, fn))
            if fm and "name" in fm:
                names.add(fm["name"])
    return names


def pack_ids():
    """Every language and concern pack available on disk."""
    out = set()
    for kind in ("languages", "concerns"):
        d = os.path.join(ROOT, "packs", kind)
        if os.path.isdir(d):
            out.update(fn[:-3] for fn in os.listdir(d) if fn.endswith(".md"))
    return out


def main():
    print("Validating onestop\n")

    # 1 + 2 - manifests
    plugin = load_json(".claude-plugin/plugin.json")
    market = load_json(".claude-plugin/marketplace.json")
    if plugin and market:
        mp = market.get("plugins", [{}])[0]
        if plugin.get("name") != mp.get("name"):
            err("plugin.json name != marketplace.json plugin name")
        if plugin.get("version") != mp.get("version"):
            err("plugin.json version (" + str(plugin.get("version")) +
                ") != marketplace.json version (" + str(mp.get("version")) + ")")
    print("  manifests           ok" if not errors else "  manifests           FAIL")

    intents = load_json("registry/intents.json")
    stacks = load_json("registry/stacks.json")
    agents_reg = load_json("registry/agents.json")
    packs_reg = load_json("registry/packs.json")
    if not all([intents, stacks, agents_reg, packs_reg]):
        report()
        return 1
    print("  registries parse    ok")

    have_agents = agent_names()
    have_packs = pack_ids()

    # 3 - phase coverage
    all_phases = set()
    for it in intents["intents"]:
        all_phases.update(it["phase_mask"])
    missing = sorted(
        p for p in all_phases
        if p not in INLINE_PHASES and not os.path.isfile(
            os.path.join(ROOT, "skills", "phase-" + p, "SKILL.md"))
    )
    for p in missing:
        err("phase '" + p + "' is in a phase_mask but skills/phase-" + p + "/SKILL.md does not exist")
    print("  phase coverage      " + ("ok (" + str(len(all_phases)) + " phases)" if not missing else "FAIL"))

    # 4 - agents referenced by intents
    for it in intents["intents"]:
        for a in it.get("primary_agents", []):
            if a not in have_agents:
                err("intent '" + it["id"] + "' references unknown agent: " + a)

    # 4b - every stack declares at least one pack
    for st in stacks["stacks"]:
        if not st.get("packs"):
            err("stack '" + st["id"] + "' declares no packs")
    print("  agent references    " + ("ok (" + str(len(have_agents)) + " agents)"
                                      if not any("unknown agent" in e for e in errors) else "FAIL"))

    # 5 - packs referenced by stacks
    for st in stacks["stacks"]:
        for pk in st.get("packs", []) + st.get("concern_packs", []):
            if pk not in have_packs:
                err("stack '" + st["id"] + "' references pack not on disk: " + pk)
    # Every role agent the binding model names must exist.
    for role, agent in stacks.get("binding_model", {}).get("role_agents", {}).items():
        if agent not in have_agents:
            err("binding_model role '" + role + "' names unknown agent: " + agent)
    print("  pack references     " + ("ok (" + str(len(have_packs)) + " packs)"
                                      if not any("pack not on disk" in e for e in errors) else "FAIL"))

    # 6 - frontmatter present
    bad_fm = 0
    d = os.path.join(ROOT, "agents")
    for fn in os.listdir(d):
        if fn.endswith(".md") and not frontmatter(os.path.join(d, fn)):
            err("agent has no parseable frontmatter: agents/" + fn)
            bad_fm += 1
    print("  frontmatter         " + ("ok" if bad_fm == 0 else "FAIL (" + str(bad_fm) + ")"))

    # 7 - derived registries in sync
    if agents_reg["count"] != len(have_agents):
        err("registry/agents.json count (" + str(agents_reg["count"]) +
            ") != agents on disk (" + str(len(have_agents)) + ") - re-run scripts/build_registry.py")
    # 8 - every role agent declares its phases explicitly
    no_phase = []
    for fn in sorted(os.listdir(os.path.join(ROOT, "agents"))):
        if not fn.endswith(".md"):
            continue
        fm = frontmatter(os.path.join(ROOT, "agents", fn)) or {}
        if not fm.get("phases"):
            no_phase.append(fn)
            err("agent does not declare phases: agents/" + fn)
    print("  phase declarations  " + ("ok" if not no_phase else "FAIL (" + str(len(no_phase)) + ")"))

    print("  registry sync       " + ("ok" if agents_reg["count"] == len(have_agents) else "STALE"))

    # 9 - the knowledge graph is code-only unless the user opts in. graphify's semantic
    # mode sends repository text to whichever LLM provider it finds a key for, billed to
    # that key, with no notice - so the engine must build with --code-only and gate
    # semantic extraction on ONESTOP_KG_SEMANTIC.
    kg = os.path.join(ROOT, "engine", "lib", "kg.mjs")
    kg_src = open(kg, encoding="utf-8").read() if os.path.isfile(kg) else ""
    kg_ok = "'--code-only'" in kg_src and "ONESTOP_KG_SEMANTIC" in kg_src
    if not kg_ok:
        err("engine/lib/kg.mjs must build with --code-only unless ONESTOP_KG_SEMANTIC=1")
    if os.path.exists(os.path.join(ROOT, "scripts", "kg.sh")):
        err("scripts/kg.sh exists again - the engine owns the knowledge graph")
        kg_ok = False
    print("  graph code-only     " + ("ok" if kg_ok else "FAIL"))

    # 10 - the enforcement hooks must stay wired to the engine. They are what makes the
    # rules code instead of prose: the guard, the write guard, report capture and the
    # session ownership claim. A hook wired to an event the dispatcher does not handle
    # silently does nothing. The command must stay in the one form Claude Code, Copilot
    # CLI and VS Code all run: Copilot ignores exec-form "args" and runs a bare `node`,
    # which fails - and a failing PreToolUse hook there denies every tool.
    hj = load_json("hooks/hooks.json")
    dispatcher = os.path.join(ROOT, "engine", "hooks.mjs")
    hook_cmd = re.compile(r'^node "\$\{CLAUDE_PLUGIN_ROOT\}/engine/hooks\.mjs" ([\w-]+)$')
    hook_problems = []
    if hj and os.path.isfile(dispatcher):
        dsrc = open(dispatcher, encoding="utf-8").read()
        table = dsrc[dsrc.rfind("try {"):]
        wired = {}
        for event, entries in hj.get("hooks", {}).items():
            for entry in entries:
                for h in entry.get("hooks", []):
                    m = hook_cmd.match(h.get("command", ""))
                    if "args" in h or not m:
                        hook_problems.append(event + ' does not run node "${CLAUDE_PLUGIN_ROOT}/engine/hooks.mjs" <event> in shell form')
                        continue
                    if not re.search(r"['\"]?" + re.escape(m.group(1)) + r"['\"]?\s*[:,]", table):
                        hook_problems.append(event + " is wired to '" + m.group(1) + "', which hooks.mjs does not handle")
                    wired[event] = entry.get("matcher", "")
        for event in ("PreToolUse", "PostToolUse", "SubagentStop", "Stop", "SessionStart", "UserPromptSubmit"):
            if event not in wired:
                hook_problems.append(event + " is not wired")
        for tool in ("Bash", "PowerShell", "Write", "Edit", "Agent"):
            if tool not in wired.get("PreToolUse", "").split("|"):
                hook_problems.append("the PreToolUse guard does not cover " + tool)
        for run_open in ("mcp__plugin_onestop_engine__run_open", "engine-run_open"):
            if run_open not in wired.get("PostToolUse", "").split("|"):
                hook_problems.append("PostToolUse no longer sees " + run_open + " - those sessions would never claim their run")
    for p_ in hook_problems:
        err("hooks: " + p_)
    print("  enforcement hooks   " + ("ok" if not hook_problems else "FAIL"))

    # 11 - the gate protocol must keep its teeth: one gate per phase, a progress-bearing
    # gate shape, and gate zero. Each of these was added after a real run lost them.
    g = load_json("registry/gates.json")
    if g:
        gate_problems = []
        if "no_batching" not in g:
            gate_problems.append("no_batching rule missing")
        if "gate_zero" not in g:
            gate_problems.append("gate_zero (classification consent) missing")
        shape = [s["name"] for s in g.get("gate_shape", {}).get("sections", [])]
        for required in ("PROGRESS", "JUST DID", "DECIDE", "NEXT", "RECOMMEND"):
            if required not in shape:
                gate_problems.append(f"gate_shape is missing {required}")
        if not g.get("gate_modes", {}).get("always_stop"):
            gate_problems.append("gate_modes.always_stop is missing - user-only decisions must stop in every mode")
        for p_ in gate_problems:
            err("registry/gates.json: " + p_)
        print("  gate protocol       " + ("ok" if not gate_problems else "FAIL"))

        # Every intent must be able to announce itself in plain words at gate zero.
        ints = load_json("registry/intents.json")
        if ints:
            silent = [i["id"] for i in ints["intents"] if not i.get("announce_as")]
            for s in silent:
                err("intent '" + s + "' has no announce_as text for gate zero")
            print("  intent announcements " + ("ok" if not silent else "FAIL"))

    # 12 - onestop must ship the tooling its own content depends on. The
    # web-automation-agent tells the model to derive selectors from the live page; with
    # no browser MCP server declared it cannot, and a real run silently borrowed another
    # installed plugin's server instead. Anything onestop asks for, onestop provides -
    # or documents as opt-in.
    if plugin is not None:
        mcp = plugin.get("mcpServers", {})
        missing_mcp = [s for s in ("chrome-devtools", "playwright", "context7") if s not in mcp]
        for s in missing_mcp:
            err("plugin.json declares no `" + s + "` MCP server - onestop's own agents depend on it")
        print("  mcp servers         " + ("ok (" + str(len(mcp)) + ")" if not missing_mcp else "FAIL"))

    # 13 - every stack must name packs that exist, and every pack should be reachable
    # from at least one stack, or it is knowledge nothing can ever bind.
    if stacks:
        declared = set()
        for st in stacks["stacks"]:
            declared.update(st.get("packs", []))
        orphan_packs = sorted(p_ for p_ in have_packs
                              if p_ not in declared
                              and os.path.isfile(os.path.join(ROOT, "packs", "languages", p_ + ".md")))
        for p_ in orphan_packs:
            warn("language pack '" + p_ + "' is not reachable from any stack - nothing can bind it")
        print("  pack reachability   " + ("ok" if not orphan_packs else str(len(orphan_packs)) + " orphaned"))

    # 14 - every phase that runs must have an agent that declares it. This is the check
    # that would have caught qa-planner declaring `phases: test` while the phase it
    # serves is `qa-plan` - a binding that could never fire, invisible until a run
    # silently skipped manual test planning.
    declared = {}
    for fn in sorted(os.listdir(os.path.join(ROOT, "agents"))):
        if not fn.endswith(".md"):
            continue
        fm = frontmatter(os.path.join(ROOT, "agents", fn)) or {}
        for ph in fm.get("phases", "").split():
            declared.setdefault(ph, []).append(fm.get("name", fn))
    unstaffed = sorted(p for p in all_phases
                       if p not in ORCHESTRATOR_PHASES and p not in declared)
    for p in unstaffed:
        err("phase '" + p + "' runs in a phase_mask but no agent declares it")
    ghost = sorted(p for p in declared if p not in all_phases)
    for p in ghost:
        err("agent(s) " + ", ".join(declared[p]) + " declare phase '" + p +
            "' which is in no intent phase_mask - that binding can never fire")
    print("  agent phase cover   " + ("ok" if not (unstaffed or ghost) else "FAIL"))

    # 15 - patterns.json must answer, for every automation framework onestop can bind,
    # HOW that framework is structured. Binding Playwright without binding its pattern
    # is half a decision: the suite works today and is rewritten in a quarter.
    patterns = load_json("registry/patterns.json")
    if patterns and stacks:
        patterned = {e["framework"] for tgt in patterns["automation_patterns"].values()
                     if isinstance(tgt, list) for e in tgt}
        # automation_frameworks also carries `instruction` (a string) and
        # `selection_rules` (a list of strings) - only the target lists hold entries.
        bindable = {f["id"] for tgt in ("web", "app")
                    for f in stacks["automation_frameworks"].get(tgt, [])}
        no_pattern = sorted(bindable - patterned)
        for f in no_pattern:
            err("automation framework '" + f + "' is bindable but patterns.json names no "
                "pattern for it - the agent would invent a structure")
        print("  automation patterns " + ("ok (" + str(len(patterned)) + ")"
                                          if not no_pattern else "FAIL"))

    # 16 - artifacts.json must cover every phase that produces something durable, or a
    # phase writes to a path nothing else in the pipeline knows to look for. That is how
    # the RTM ended up written to docs/ba/ and read from nowhere else.
    arts = load_json("registry/artifacts.json")
    if arts:
        mapped = {a["phase"] for a in arts["by_phase"]}
        stray = sorted(p for p in mapped if p not in all_phases)
        for p in stray:
            err("artifacts.json maps phase '" + p + "' which is in no phase_mask")
        for p in sorted(all_phases - mapped - ORCHESTRATOR_PHASES):
            warn("phase '" + p + "' has no entry in artifacts.json - if it writes "
                 "anything, the path is undeclared")
        print("  artifact map        " + ("ok (" + str(len(mapped)) + " phases)"
                                          if not stray else "FAIL"))

    # 18 - the visual style registry must be usable by the selection algorithm: every
    # domain_fit id must be a real design.json domain (a typo silently excludes nothing
    # and matches nothing), no style may be both strong and never for one domain, every
    # style must state its accessibility cost, and every domain must have at least one
    # style that fits it - otherwise the selector falls through to the default forever.
    ui = load_json("registry/ui-styles.json")
    design = load_json("registry/design.json")
    if ui and design:
        domains = {d["id"] for d in design["domains"]}
        problems, covered = [], set()
        for st in ui["styles"]:
            fit = st.get("domain_fit", {})
            for bucket in ("strong", "possible", "never"):
                for dom in fit.get(bucket, []):
                    if dom not in domains:
                        problems.append(st["id"] + " domain_fit." + bucket +
                                        " names unknown domain: " + dom)
            both = set(fit.get("strong", [])) & set(fit.get("never", []))
            for dom in sorted(both):
                problems.append(st["id"] + " lists '" + dom + "' as both strong and never")
            if not st.get("accessibility"):
                problems.append(st["id"] + " states no accessibility cost - every style has one")
            if not st.get("recipe"):
                problems.append(st["id"] + " has no recipe, so nothing can implement it")
            covered.update(fit.get("strong", []))

        # There must be exactly one declared default, and it must be bindable for every
        # domain - a default with a `never` entry leaves some domain with no fallback at
        # all, which is the one situation selection cannot recover from.
        defaults = [s["id"] for s in ui["styles"] if s.get("is_default")]
        named = ui.get("default_style", {}).get("id")
        if len(defaults) != 1:
            problems.append("expected exactly one style flagged is_default, found " +
                            str(len(defaults)) + ": " + ", ".join(defaults))
        elif defaults[0] != named:
            problems.append("default_style.id is '" + str(named) + "' but '" +
                            defaults[0] + "' carries is_default")
        else:
            blocked = [s for s in ui["styles"] if s["id"] == named][0]["domain_fit"]["never"]
            if blocked:
                problems.append("default style '" + named + "' excludes " +
                                ", ".join(blocked) + " - a default must be bindable everywhere")

        for dom in sorted(domains - covered):
            warn("no UI style lists domain '" + dom + "' as a strong fit - selection "
                 "will always fall through to the default there")
        for p_ in problems:
            err("registry/ui-styles.json: " + p_)
        print("  ui styles           " + ("ok (" + str(len(ui["styles"])) + ")"
                                          if not problems else "FAIL"))

    # 19 - the engine is the only writer of the run ledger. A playbook, agent or command
    # telling the model to write, mark or stamp .onestop/run.json brings back the
    # hand-written ledgers that produced three incompatible shapes in three releases.
    ledger_writes = []
    verb = re.compile(r"\b(mark|stamp|write|update|edit|set|append)\b", re.I)
    negated = re.compile(r"\b(never|nobody|not|engine)\b", re.I)
    for sub in ("skills", "agents", "commands"):
        for dirpath, _, files in os.walk(os.path.join(ROOT, sub)):
            for fn in files:
                if not fn.endswith(".md"):
                    continue
                src = os.path.join(dirpath, fn)
                for n, line in enumerate(open(src, encoding="utf-8"), 1):
                    if ".onestop/run.json" in line and verb.search(line) and not negated.search(line):
                        ledger_writes.append(os.path.relpath(src, ROOT) + ":" + str(n))
    pol = load_json("registry/policies.json") or {}
    if ".onestop/run.json" not in pol.get("write_guard", {}).get("ledger_files", []):
        ledger_writes.append("registry/policies.json write_guard.ledger_files")
    if not os.path.isfile(os.path.join(ROOT, "registry", "run.schema.json")):
        ledger_writes.append("registry/run.schema.json is missing")
    for w_ in ledger_writes:
        err("only the engine writes the ledger: " + w_)
    print("  ledger writer       " + ("ok" if not ledger_writes else "FAIL"))

    # 20 - specialists are spokes: none may dispatch another agent, and none pins a
    # model - they inherit the session's, so a user on any plan is never sent to a model
    # their account cannot use.
    spoke_problems = []
    adir = os.path.join(ROOT, "agents")
    for fn in sorted(os.listdir(adir)):
        if not fn.endswith(".md"):
            continue
        fm = frontmatter(os.path.join(adir, fn)) or {}
        tools = [t.strip() for t in fm.get("tools", "").split(",") if t.strip()]
        if any(t in ("Agent", "Task") for t in tools):
            spoke_problems.append(fn + " can dispatch agents (Agent/Task in tools)")
        if fm.get("model", "inherit") != "inherit":
            spoke_problems.append(fn + " pins model: " + fm.get("model"))
    wg = pol.get("write_guard", {})
    names = agent_names()
    for role in wg.get("report_only", []) + wg.get("docs_only", []):
        if role not in names:
            spoke_problems.append("write_guard names an agent that does not exist: " + role)
    for p_ in spoke_problems:
        err("agents: " + p_)
    print("  specialist spokes   " + ("ok" if not spoke_problems else "FAIL"))

    # 21 - every phase any intent can run has a dispatch recipe, every specialist the
    # recipes name exists, and every playbook they point at is on disk.
    phases_reg = load_json("registry/phases.json") or {}
    ints = load_json("registry/intents.json") or {"intents": []}
    recipe_problems = []
    specs = phases_reg.get("phases", {})
    for intent in ints["intents"]:
        for ph in intent["phase_mask"]:
            if ph not in specs:
                recipe_problems.append(intent["id"] + " runs " + ph + ", which phases.json does not describe")
    for ph, spec in specs.items():
        named = [spec.get("lead")] + spec.get("also", []) + spec.get("then", []) + list(spec.get("panel", {}).keys())
        named += [v for v in spec.get("roles", {}).values() if v]
        for a in filter(None, named):
            if a not in names:
                recipe_problems.append(ph + " names a missing agent: " + a)
        pb = spec.get("playbook")
        if pb and not os.path.isfile(os.path.join(ROOT, "skills", pb, "SKILL.md")):
            recipe_problems.append(ph + " points at a missing playbook: skills/" + pb)
        if spec.get("dispatch") not in phases_reg.get("dispatch_shapes", {}):
            recipe_problems.append(ph + " has an unknown dispatch shape: " + str(spec.get("dispatch")))
    for intent_id, over in phases_reg.get("intent_overrides", {}).items():
        if not isinstance(over, dict):
            continue
        for roles in over.values():
            for a in roles.values():
                if a and a not in names:
                    recipe_problems.append("intent override " + intent_id + " names a missing agent: " + a)
    for p_ in recipe_problems:
        err("phases: " + p_)
    print("  dispatch recipes    " + ("ok" if not recipe_problems else "FAIL"))

    # 22 - every guard pattern compiles. A pattern that fails to compile throws inside
    # the hook, and the hook fails open - the rule silently stops existing.
    bad_patterns = []
    rules = (pol.get("bash_guard", {}).get("always_blocked", []) + pol.get("bash_guard", {}).get("allowed_after_ship_gate", [])
             + pol.get("dependency_guard", {}).get("add_commands", []) + wg.get("scoped_bash", []))
    for r in rules:
        try:
            re.compile(r["pattern"], 0 if r.get("flags") == "" else re.I)
        except re.error as e:
            bad_patterns.append(str(r.get("id") or r.get("ecosystem")) + ": " + str(e))
    for b in bad_patterns:
        err("policies.json pattern does not compile: " + b)
    print("  guard patterns      " + ("ok (" + str(len(rules)) + ")" if not bad_patterns else "FAIL"))

    # 23 - one RTM schema. The analyst writes the matrix, three phases complete it, and
    # the validator reads it: if their column lists differ, the relay silently breaks.
    rtm_problems = []
    arts = load_json("registry/artifacts.json") or {"by_phase": []}
    want = None
    for entry in arts["by_phase"]:
        for a in entry.get("artifacts", []):
            if a["path"].endswith("RTM.md") and want is None:
                m = re.search(r"Columns, exactly: ([A-Za-z,\- ]+)\.", a["what"])
                want = [c.strip() for c in m.group(1).split(",")] if m else None
    # The analyst's method lives in the skill that owns it; the agent file is only its rules.
    ba_method = os.path.join(ROOT, "skills", "phase-requirements", "agents", "ba-analyst.md")
    ba = open(ba_method if os.path.isfile(ba_method) else os.path.join(ROOT, "agents", "ba-analyst.md"), encoding="utf-8").read()
    m = re.search(r"^(Req-ID,[^\n]+)$", ba, re.M)
    have = [c.strip() for c in m.group(1).split(",")] if m else None
    if not want:
        rtm_problems.append("artifacts.json does not state the RTM columns")
    elif have != want:
        rtm_problems.append("ba-analyst writes " + str(have) + " but artifacts.json says " + str(want))
    for p_ in rtm_problems:
        err("RTM: " + p_)
    print("  RTM schema          " + ("ok" if not rtm_problems else "FAIL"))

    # 24 - every visual style has a CSS recipe. ui-designer is told the recipes exist;
    # a style without one gets improvised.
    styles = load_json("registry/ui-styles.json") or {"styles": []}
    # One recipe file per style, so the designer reads only the one it binds.
    recipe_dir = os.path.join(ROOT, "skills", "phase-ui-design", "references", "styles")
    no_recipe = [s["id"] for s in styles["styles"] if not os.path.isfile(os.path.join(recipe_dir, s["id"] + ".md"))]
    for s in no_recipe:
        err("style '" + s + "' has no recipe at skills/phase-ui-design/references/styles/" + s + ".md")
    print("  style recipes       " + ("ok" if not no_recipe else "FAIL"))

    # 25 - what is always loaded stays small. Agent files, the orchestrator skill and every
    # description are paid for on every spawn or in every session; the detail lives in
    # method files and guides that are read only when needed.
    lite = []
    methods = {}
    for skill in os.listdir(os.path.join(ROOT, "skills")):
        mdir = os.path.join(ROOT, "skills", skill, "agents")
        if os.path.isdir(mdir):
            for fn in os.listdir(mdir):
                if fn.endswith(".md"):
                    methods[fn[:-3]] = os.path.join("skills", skill, "agents", fn)
    for fn in sorted(os.listdir(adir)):
        if not fn.endswith(".md"):
            continue
        name, text = fn[:-3], open(os.path.join(adir, fn), encoding="utf-8").read()
        body = FM.sub("", text, count=1)
        if name not in methods:
            lite.append(fn + " has no method file at skills/<skill>/agents/" + fn)
        if len(body) > 2400:
            lite.append(fn + " body is " + str(len(body)) + " chars - move method detail to its method file (limit 2400)")
        desc = (frontmatter(os.path.join(adir, fn)) or {}).get("description", "")
        if len(desc) > 160:
            lite.append(fn + " description is " + str(len(desc)) + " chars (limit 160) - it is in context in every session")
    for name in methods:
        if not os.path.isfile(os.path.join(adir, name + ".md")):
            lite.append(methods[name] + " is a method with no agent")
    orch = open(os.path.join(ROOT, "skills", "orchestrate", "SKILL.md"), encoding="utf-8").read()
    if len(orch) > 4000:
        lite.append("skills/orchestrate/SKILL.md is " + str(len(orch)) + " chars (limit 4000) - move detail to its references/")
    for guide in ("start", "context", "dev-loop", "gates", "ship"):
        if not os.path.isfile(os.path.join(ROOT, "skills", "orchestrate", "references", guide + ".md")):
            lite.append("orchestrator guide missing: skills/orchestrate/references/" + guide + ".md")
    for d in os.listdir(os.path.join(ROOT, "skills")):
        f = os.path.join(ROOT, "skills", d, "SKILL.md")
        if d != "orchestrate" and os.path.isfile(f) and (frontmatter(f) or {}).get("disable-model-invocation") != "true":
            lite.append("skills/" + d + " is listed in every session - set disable-model-invocation: true (it is read by path)")
    for p_ in lite:
        err("lite: " + p_)
    print("  lite context        " + ("ok" if not lite else "FAIL"))

    # 17 - every plugin-internal file referenced with ${CLAUDE_PLUGIN_ROOT} must exist.
    # A broken reference is silent at runtime: the model simply does not load the
    # protocol it was told to follow, and the run degrades with no error anywhere.
    ref = re.compile(r"\$\{CLAUDE_PLUGIN_ROOT\}/([A-Za-z0-9_./-]+)")
    broken = set()
    for sub in ("skills", "agents", "commands", "rules", "packs"):
        for dirpath, _, files in os.walk(os.path.join(ROOT, sub)):
            for fn in files:
                if not fn.endswith(".md"):
                    continue
                src = os.path.join(dirpath, fn)
                try:
                    body = open(src, encoding="utf-8").read()
                except (OSError, UnicodeDecodeError):
                    continue
                for rel in ref.findall(body):
                    rel = rel.rstrip(".,)")
                    # A reference may name a file, a directory of them, or a JSON
                    # registry with a dotted key path appended (stacks.json.web).
                    target = os.path.join(ROOT, rel)
                    if os.path.isfile(target) or os.path.isdir(target):
                        continue
                    if ".json" in rel and os.path.isfile(
                            os.path.join(ROOT, rel[:rel.index(".json") + 5])):
                        continue
                    broken.add(os.path.relpath(src, ROOT) + " -> " + rel)
    for b in sorted(broken):
        err("broken plugin reference: " + b)
    print("  internal references " + ("ok" if not broken else "FAIL (" + str(len(broken)) + ")"))

    return report()


def report():
    print()
    for w in warnings:
        print("  WARN  " + w)
    for e in errors:
        print("  ERROR " + e)
    print()
    if errors:
        print("FAILED - " + str(len(errors)) + " error(s), " + str(len(warnings)) + " warning(s)")
        return 1
    print("PASSED" + (" - " + str(len(warnings)) + " warning(s)" if warnings else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
