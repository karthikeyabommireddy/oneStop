"""Generate registry/agents.json and registry/packs.json from what is on disk.

The routing catalogue is DERIVED, never hand-maintained, so it cannot drift from the
files that actually exist. Re-run after adding or renaming an agent or a pack.

Usage:  python scripts/build_registry.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FM = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)


def parse_frontmatter(path):
    """Return the simple top-level YAML scalars in a file frontmatter block."""
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except (OSError, UnicodeDecodeError):
        return None
    m = FM.match(text)
    if not m:
        return None
    data, key = {}, None
    for raw in m.group(1).split("\n"):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if re.match(r"^\s", raw) and key:
            data[key] = (str(data.get(key, "")) + " " + raw.strip()).strip()
            continue
        if ":" not in raw:
            continue
        key, _, val = raw.partition(":")
        key = key.strip()
        data[key] = val.strip().strip("\"").strip(">").strip()
    return data


def collect_agents():
    agents = []
    d = os.path.join(ROOT, "agents")
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".md"):
            continue
        fm = parse_frontmatter(os.path.join(d, fn))
        if not fm or "name" not in fm:
            print("  SKIP (no frontmatter): " + fn)
            continue
        phases = [p for p in fm.get("phases", "").replace(",", " ").split() if p]
        agents.append({
            "name": fm["name"],
            "path": "agents/" + fn,
            "description": fm.get("description", ""),
            "tools": [t.strip() for t in fm.get("tools", "").split(",") if t.strip()],
            "model": fm.get("model", "sonnet"),
            "phases": phases or ["implement"],
        })
    return agents


def collect_packs():
    packs = {"languages": [], "concerns": []}
    for kind in packs:
        d = os.path.join(ROOT, "packs", kind)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".md"):
                continue
            packs[kind].append({
                "id": fn[:-3],
                "path": "packs/" + kind + "/" + fn,
            })
    return packs


def collect_skills():
    skills = []
    base = os.path.join(ROOT, "skills")
    for name in sorted(os.listdir(base)):
        p = os.path.join(base, name, "SKILL.md")
        if not os.path.isfile(p):
            continue
        fm = parse_frontmatter(p) or {}
        skills.append({
            "name": fm.get("name", name),
            "path": "skills/" + name + "/SKILL.md",
            "description": fm.get("description", ""),
            "phase": fm.get("phase", ""),
        })
    return skills


def main():
    agents = collect_agents()
    packs = collect_packs()
    skills = collect_skills()

    by_phase = {}
    for a in agents:
        for ph in a["phases"]:
            by_phase.setdefault(ph, []).append(a["name"])

    with open(os.path.join(ROOT, "registry", "agents.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "version": "1.0.0",
            "generated_by": "scripts/build_registry.py",
            "description": "Derived agent catalogue. Do not hand-edit. onestop uses role agents that specialise by loading language and concern packs, rather than one agent per language.",
            "count": len(agents),
            "by_phase": {k: sorted(v) for k, v in sorted(by_phase.items())},
            "agents": sorted(agents, key=lambda x: x["name"]),
        }, fh, indent=2)
        fh.write("\n")

    with open(os.path.join(ROOT, "registry", "packs.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "version": "1.0.0",
            "generated_by": "scripts/build_registry.py",
            "description": "Derived pack catalogue. A role agent loads the packs a stack names, in order, and applies them on top of its own role contract.",
            "counts": {k: len(v) for k, v in packs.items()},
            "packs": packs,
        }, fh, indent=2)
        fh.write("\n")

    with open(os.path.join(ROOT, "registry", "skills.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "version": "1.0.0",
            "generated_by": "scripts/build_registry.py",
            "description": "Derived skill catalogue - the orchestrator engine and its phase skills.",
            "count": len(skills),
            "skills": skills,
        }, fh, indent=2)
        fh.write("\n")

    print("agents.json: " + str(len(agents)) + " role agents")
    print("packs.json : " + str(len(packs["languages"])) + " language, " +
          str(len(packs["concerns"])) + " concern")
    print("skills.json: " + str(len(skills)) + " skills")
    print("phases     : " + ", ".join(sorted(by_phase)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
