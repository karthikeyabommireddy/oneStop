"""Executable test of the onestop routing logic.

The registries are only useful if the scoring rule they describe actually separates
real requests. This implements the algorithm exactly as intents.json specifies it and
asserts the expected intent for a corpus of realistic requests.

Usage:  python scripts/test_routing.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "registry", "intents.json"), encoding="utf-8") as fh:
    REG = json.load(fh)
with open(os.path.join(ROOT, "registry", "stacks.json"), encoding="utf-8") as fh:
    STACKS = json.load(fh)

WEIGHTS = {"strong": 1.0, "weak": 0.4, "negative": -0.8}
MARGIN = REG["classification"]["ambiguity_margin"]


def normalize(text):
    """Lowercase, reduce every non-alphanumeric run to a single space, and pad.

    Padding lets a signal be tested as " signal ", which gives whole-word and
    whole-phrase matching without regex escaping. Substring matching misrouted
    "audit my changes before I merge": the `change` signal fired inside
    "changes" and stole the request from the review intent.
    """
    out = []
    for ch in text.lower():
        out.append(ch if ch.isalnum() else " ")
    return " " + " ".join("".join(out).split()) + " "


def matches(signal, padded):
    """Whole-word / whole-phrase containment, per the classification rule."""
    return (" " + normalize(signal).strip() + " ") in padded


def score(request, intent):
    """Score one intent against a request, per intents.json classification rule."""
    padded = normalize(request)
    total = 0.0
    hits = 0
    for kind, weight in WEIGHTS.items():
        for sig in intent["signals"].get(kind, []):
            if matches(sig, padded):
                total += weight
                if weight > 0:
                    hits += 1
    # Normalise so intents with long signal lists are not automatically favoured.
    return total / (1 + 0.15 * hits) if hits else total


def classify(request):
    ranked = sorted(
        ((score(request, i), i["id"]) for i in REG["intents"]),
        key=lambda p: -p[0],
    )
    top, second = ranked[0], ranked[1]
    ambiguous = (top[0] - second[0]) < MARGIN and top[0] > 0
    return top[1], top[0], second[1], ambiguous


CASES = [
    ("user signs in with Google, then they land on the dashboard and see recent orders", "flow"),
    ("walk through the checkout journey step by step and build it", "flow"),
    ("add support for CSV export on the reports page", "feature"),
    ("implement a new billing webhook endpoint", "feature"),
    ("the login button throws a null pointer exception on mobile", "defect"),
    ("checkout is broken, payment fails with a 500 error", "defect"),
    ("refactor the auth module, clean up the duplicate token logic", "refactor"),
    ("simplify and restructure the reporting service", "refactor"),
    ("bootstrap a new project from scratch with a REST API", "mvp"),
    ("review this PR for correctness", "review"),
    ("audit my changes before I merge", "review"),
    ("write tests for the order service, we need coverage", "test"),
    ("add e2e automation test for the signup page", "test"),
    ("how does the session middleware work", "investigate"),
    ("explain why does the cache invalidate on write", "investigate"),
    ("the dashboard is slow, optimize the query latency", "perf"),
    ("check for owasp vulnerability in the upload handler", "security"),
    ("the ci pipeline build fails on the docker step", "ops"),
    ("update the readme and document the api", "docs"),
    ("design the architecture for multi-tenant support, decide between two approaches", "design"),
    ("change the date format to ISO instead of US format", "change"),
]


def main():
    print("Routing test - " + str(len(CASES)) + " cases\n")
    passed = failed = 0
    for request, expected in CASES:
        got, sc, second, ambiguous = classify(request)
        ok = got == expected
        flag = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        amb = "  [ambiguous with " + second + " -> would ask]" if ambiguous else ""
        print("  " + flag + "  " + got.ljust(12) + " (want " + expected.ljust(12) +
              ") " + format(sc, ".2f") + amb)
        if not ok:
            print("        request: " + request)

    # Stack binding spot-checks - proves pack and automation binding resolves.
    print("")
    print("Stack binding (packs + automation)")
    by_id = {s["id"]: s for s in STACKS["stacks"]}
    checks = [
        ("react",        ["typescript", "react"],                 "playwright",        None),
        ("react-native", ["typescript", "react", "react-native"], None,                "detox"),
        ("swift",        ["swift"],                               None,                "xcuitest"),
        ("flutter",      ["dart"],                                "playwright",        "flutter-integration-test"),
        ("kotlin",       ["kotlin"],                              None,                "espresso"),
        ("django",       ["python", "django"],                    "playwright-python", None),
        ("csharp",       ["csharp"],                              "playwright-dotnet", "winappdriver"),
    ]
    for sid, packs, web, app in checks:
        s = by_id[sid]
        ok = (s["packs"] == packs
              and s["web_automation"] == web
              and s["app_automation"] == app)
        if ok:
            passed += 1
            print("  PASS  " + sid.ljust(14) + str(packs).ljust(40) +
                  "web=" + str(web).ljust(20) + "app=" + str(app))
        else:
            failed += 1
            print("  FAIL  " + sid + ": packs=" + str(s.get("packs")) +
                  " web=" + str(s.get("web_automation")) +
                  " app=" + str(s.get("app_automation")))

    # Every pack any stack names must resolve to a file on disk.
    print("")
    print("Pack files")
    missing = []
    for s in STACKS["stacks"]:
        for pk in s.get("packs", []) + s.get("concern_packs", []):
            found = any(
                os.path.isfile(os.path.join(ROOT, "packs", kind, pk + ".md"))
                for kind in ("languages", "concerns")
            )
            if not found:
                missing.append(s["id"] + " -> " + pk)
    if missing:
        failed += 1
        for m in missing:
            print("  FAIL  missing pack: " + m)
    else:
        passed += 1
        print("  PASS  all " + str(len(STACKS["stacks"])) + " stacks resolve their packs")

    print("\n" + str(passed) + " passed, " + str(failed) + " failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
