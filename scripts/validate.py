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

# Phases the orchestrator runs itself, with no delegated agent. Everything else must
# have an agent declaring it, or the phase has nobody to execute it.
ORCHESTRATOR_PHASES = {"intake", "flow-decomposition", "context", "research"}

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

    # 9 - kg.sh build must not require an LLM key. Bare `graphify <path>` demands one
    # the moment the corpus has any doc/markdown file - true of nearly every real repo,
    # starting with README.md - which would silently break the graph for every user
    # without an LLM key configured. This was a real bug, found by running kg.sh
    # against a genuine mixed code+docs project. Guard against it regressing.
    kg = os.path.join(ROOT, "scripts", "kg.sh")
    if os.path.isfile(kg):
        kg_src = open(kg, encoding="utf-8").read()
        build_fn = kg_src.split("cmd_build()")[1].split("\ncmd_refresh()")[0] if "cmd_build()" in kg_src else ""
        kg_llm_safe = "--code-only" in build_fn and "API_KEY" in build_fn
        if not kg_llm_safe:
            err("kg.sh build calls bare `graphify <path>` with no --code-only fallback - "
                "this fails on any repo with a doc/markdown file unless an LLM key is set")
        print("  kg.sh no-LLM build   " + ("ok" if kg_llm_safe else "FAIL"))

    # 10 - the conformance hooks must stay registered. They are the only mechanical
    # check that a run actually executed its declared phases and reviewed its security
    # surfaces; without them every gate in this plugin is prose nothing enforces.
    hj = os.path.join(ROOT, "hooks", "hooks.json")
    if os.path.isfile(hj):
        hooks_src = open(hj, encoding="utf-8").read()
        need = ["kg-mark-dirty.sh", "kg-refresh.sh", "security-watch.sh", "run-conformance.sh"]
        missing_hooks = [h for h in need if h not in hooks_src]
        for h in missing_hooks:
            err("hooks.json no longer registers " + h)
        print("  conformance hooks    " + ("ok" if not missing_hooks else "FAIL"))

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
        for required in ("PROGRESS", "REMAINING"):
            if required not in shape:
                gate_problems.append(f"gate_shape is missing {required}")
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
        stray = sorted(p for p in mapped if p not in all_phases and p != "gate")
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
