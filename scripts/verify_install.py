"""Verify onestop is laid out so `marketplace add` + `plugin install` actually work.

This checks the packaging contract, not the plugin logic - the things that make an
install silently half-broken:

  1. .claude-plugin/marketplace.json and plugin.json exist and agree
  2. every path plugin.json declares actually exists
  3. agents are discoverable at agents/*.md (flat, with frontmatter)
  4. commands are at commands/*.md with a description
  5. hooks.json parses and every referenced script exists and is executable
  6. skills are at skills/<name>/SKILL.md with a name in frontmatter
  7. plugin-internal paths inside skills use ${CLAUDE_PLUGIN_ROOT}, not bare relatives
     (a bare relative resolves against the USER's repo once installed, and silently
      finds nothing)

Usage:  python scripts/verify_install.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FM = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)
errors, checks = [], []


def ok(label, cond, detail=""):
    checks.append((label, cond, detail))
    if not cond:
        errors.append(label + (" - " + detail if detail else ""))


def fm_of(path):
    try:
        m = FM.match(open(path, encoding="utf-8").read())
    except OSError:
        return None
    if not m:
        return None
    out = {}
    for line in m.group(1).split("\n"):
        if ":" in line and not line.startswith((" ", "\t", "#")):
            k, _, v = line.partition(":")
            out[k.strip()] = v.strip()
    return out


def main():
    # 1 - manifests
    mp = os.path.join(ROOT, ".claude-plugin", "marketplace.json")
    pj = os.path.join(ROOT, ".claude-plugin", "plugin.json")
    ok("marketplace.json present", os.path.isfile(mp))
    ok("plugin.json present", os.path.isfile(pj))
    if not (os.path.isfile(mp) and os.path.isfile(pj)):
        return report()

    market = json.load(open(mp, encoding="utf-8"))
    plugin = json.load(open(pj, encoding="utf-8"))
    entry = market["plugins"][0]

    ok("names agree", plugin["name"] == entry["name"],
       plugin["name"] + " vs " + entry["name"])
    ok("versions agree", plugin["version"] == entry["version"],
       str(plugin["version"]) + " vs " + str(entry["version"]))
    ok("plugin source is repo root", entry.get("source") == "./",
       "source=" + str(entry.get("source")))

    # 2 - declared paths exist
    for key in ("skills", "commands", "agents"):
        for rel in plugin.get(key, []):
            p = os.path.join(ROOT, rel.lstrip("./"))
            ok("declared " + key + " path exists: " + rel, os.path.isdir(p))
    if "hooks" in plugin:
        hp = os.path.join(ROOT, plugin["hooks"].lstrip("./"))
        ok("declared hooks file exists", os.path.isfile(hp))

    # 3 - agents flat and parseable
    ad = os.path.join(ROOT, "agents")
    agents = [f for f in os.listdir(ad) if f.endswith(".md")] if os.path.isdir(ad) else []
    ok("agents present at agents/*.md", len(agents) > 0, str(len(agents)) + " found")
    ok("no agent subdirectories",
       not any(os.path.isdir(os.path.join(ad, e)) for e in os.listdir(ad)) if agents else True,
       "agents in a subdirectory may not be discovered")
    bad = [a for a in agents if not (fm_of(os.path.join(ad, a)) or {}).get("name")]
    ok("every agent declares a name", not bad, ", ".join(bad[:3]))

    # 4 - commands
    cd = os.path.join(ROOT, "commands")
    cmds = [f for f in os.listdir(cd) if f.endswith(".md")] if os.path.isdir(cd) else []
    ok("commands present", len(cmds) > 0, str(len(cmds)) + " found")
    bad = [c for c in cmds if not (fm_of(os.path.join(cd, c)) or {}).get("description")]
    ok("every command has a description", not bad, ", ".join(bad[:3]))

    # 5 - hooks
    hp = os.path.join(ROOT, "hooks", "hooks.json")
    if os.path.isfile(hp):
        h = json.load(open(hp, encoding="utf-8"))
        # json.dumps escapes the inner quotes, so exclude the backslash too or the
        # captured path picks up a trailing one.
        refs = re.findall(r"\$\{CLAUDE_PLUGIN_ROOT\}/([^\"\s\\]+)", json.dumps(h))
        ok("hooks reference at least one script", len(refs) > 0)
        for r in refs:
            f = os.path.join(ROOT, r)
            ok("hook script exists: " + r, os.path.isfile(f))
            if os.path.isfile(f) and os.name != "nt":
                ok("hook script executable: " + r, os.access(f, os.X_OK))

    # 6 - skills
    sd = os.path.join(ROOT, "skills")
    skills = [d for d in os.listdir(sd)
              if os.path.isfile(os.path.join(sd, d, "SKILL.md"))]
    ok("skills present", len(skills) > 0, str(len(skills)) + " found")
    bad = [s for s in skills
           if not (fm_of(os.path.join(sd, s, "SKILL.md")) or {}).get("name")]
    ok("every skill declares a name", not bad, ", ".join(bad[:3]))

    # 7 - the one that silently breaks an install
    bare = re.compile(r"(?<![\w/}])(?:scripts/[a-z_]+\.(?:sh|py)|registry/[a-z]+\.json)")
    offenders = []
    for base in ("skills", "agents", "commands"):
        for dp, _, fs in os.walk(os.path.join(ROOT, base)):
            for fn in fs:
                if not fn.endswith(".md"):
                    continue
                fp = os.path.join(dp, fn)
                for line in open(fp, encoding="utf-8"):
                    if bare.search(line) and "CLAUDE_PLUGIN_ROOT" not in line:
                        offenders.append(os.path.relpath(fp, ROOT))
                        break
    ok("plugin-internal paths use ${CLAUDE_PLUGIN_ROOT}", not offenders,
       "bare relative paths in: " + ", ".join(sorted(set(offenders))[:4]))

    return report()


def report():
    print("Install packaging check\n")
    for label, cond, detail in checks:
        print("  " + ("PASS" if cond else "FAIL") + "  " + label +
              (("  [" + detail + "]") if detail and not cond else ""))
    print()
    if errors:
        print("FAILED - " + str(len(errors)) + " problem(s)")
        return 1
    print("PASSED - " + str(len(checks)) + " checks. Ready to publish.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
