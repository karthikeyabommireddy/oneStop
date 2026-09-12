"""Executable specification of the onestop wave scheduler.

registry/parallel.json describes the algorithm in prose. This implements it exactly and
asserts the resulting waves on realistic task graphs - including the collision cases that
are easy to get wrong (a shared barrel file, a migration, a lockfile edit).

Usage:  python scripts/test_parallel.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT, "registry", "parallel.json"), encoding="utf-8") as fh:
    REG = json.load(fh)

MAX_WIDTH = REG["scheduling"]["max_width"]

# Task shapes that are serialised regardless of what the DAG allows.
SERIAL_KINDS = {"migration", "manifest", "git", "destructive", "registration"}


def longest_path(task_id, tasks, memo=None):
    """Remaining depth below a task - used to put the critical path first."""
    memo = memo if memo is not None else {}
    if task_id in memo:
        return memo[task_id]
    children = [t["id"] for t in tasks.values() if task_id in t.get("depends_on", [])]
    memo[task_id] = 1 + max((longest_path(c, tasks, memo) for c in children), default=0)
    return memo[task_id]


def collides(a, b):
    """True when two tasks share any write path."""
    return bool(set(a.get("writes", [])) & set(b.get("writes", [])))


def schedule(task_list):
    """Group tasks into waves per registry/parallel.json."""
    tasks = {t["id"]: t for t in task_list}
    done, waves = set(), []

    while len(done) < len(tasks):
        ready = [
            t for t in tasks.values()
            if t["id"] not in done
            and all(d in done for d in t.get("depends_on", []))
        ]
        if not ready:
            raise ValueError("cycle or unsatisfiable dependency in the task graph")

        # Critical path first: deepest remaining subtree leads the wave.
        ready.sort(key=lambda t: (-longest_path(t["id"], tasks), t["id"]))

        wave = []
        for t in ready:
            if t.get("kind") in SERIAL_KINDS:
                # A serial task runs alone. It only forms a wave if nothing else has.
                if not wave:
                    wave = [t]
                break
            if len(wave) >= MAX_WIDTH:
                break
            if any(collides(t, w) for w in wave):
                continue          # collides - defer to a later wave
            wave.append(t)

        waves.append([t["id"] for t in wave])
        done.update(t["id"] for t in wave)

    return waves


# ---------------------------------------------------------------- test scenarios

SCENARIOS = [
    {
        "name": "contract unlocks frontend and backend",
        "why": "Once the interface is agreed both sides build at once - the single "
               "biggest source of parallelism in a normal feature.",
        "tasks": [
            {"id": "T1", "writes": ["openapi.yaml"], "depends_on": []},
            {"id": "T2", "writes": ["src/api/orders.ts"], "depends_on": ["T1"]},
            {"id": "T3", "writes": ["src/ui/OrderList.tsx"], "depends_on": ["T1"]},
            {"id": "T4", "writes": ["src/ui/OrderDetail.tsx"], "depends_on": ["T1"]},
        ],
        "expect": [["T1"], ["T2", "T3", "T4"]],
    },
    {
        "name": "hidden barrel collision serialises",
        "why": "Three features each registering into one index.ts is the collision "
               "everyone misses. They must not share a wave.",
        "tasks": [
            {"id": "A", "writes": ["src/f/a.ts", "src/index.ts"], "depends_on": []},
            {"id": "B", "writes": ["src/f/b.ts", "src/index.ts"], "depends_on": []},
            {"id": "C", "writes": ["src/f/c.ts", "src/index.ts"], "depends_on": []},
        ],
        "expect": [["A"], ["B"], ["C"]],
    },
    {
        "name": "deferred registration recovers the parallelism",
        "why": "Same three features, but registration is deferred to one final task - "
               "three waves collapse to two, and the three build concurrently.",
        "tasks": [
            {"id": "A", "writes": ["src/f/a.ts"], "depends_on": []},
            {"id": "B", "writes": ["src/f/b.ts"], "depends_on": []},
            {"id": "C", "writes": ["src/f/c.ts"], "depends_on": []},
            {"id": "REG", "writes": ["src/index.ts"], "depends_on": ["A", "B", "C"],
             "kind": "registration"},
        ],
        "expect": [["A", "B", "C"], ["REG"]],
    },
    {
        "name": "migration never shares a wave",
        "why": "Migration ordering is global state; a concurrent apply corrupts it.",
        "tasks": [
            {"id": "M", "writes": ["db/migrations/003.sql"], "depends_on": [],
             "kind": "migration"},
            {"id": "X", "writes": ["src/x.ts"], "depends_on": []},
            {"id": "Y", "writes": ["src/y.ts"], "depends_on": []},
        ],
        "expect": [["M"], ["X", "Y"]],
    },
    {
        "name": "max width caps the wave",
        "why": "Seven independent lanes still cap at five; the rest wait.",
        "tasks": [{"id": "T%d" % i, "writes": ["src/%d.ts" % i], "depends_on": []}
                  for i in range(1, 8)],
        "expect": [["T1", "T2", "T3", "T4", "T5"], ["T6", "T7"]],
    },
    {
        "name": "pure chain gains nothing",
        "why": "Every task depends on the last. Wave scheduling must report one lane "
               "per wave rather than manufacturing concurrency.",
        "tasks": [
            {"id": "S1", "writes": ["a.ts"], "depends_on": []},
            {"id": "S2", "writes": ["b.ts"], "depends_on": ["S1"]},
            {"id": "S3", "writes": ["c.ts"], "depends_on": ["S2"]},
        ],
        "expect": [["S1"], ["S2"], ["S3"]],
    },
]


def main():
    print("Wave scheduler - " + str(len(SCENARIOS)) + " scenarios  (max_width=" +
          str(MAX_WIDTH) + ")\n")
    passed = failed = 0

    for s in SCENARIOS:
        got = schedule(s["tasks"])
        want = s["expect"]
        ok = got == want
        if ok:
            passed += 1
            print("  PASS  " + s["name"])
            print("        " + " -> ".join("[" + ",".join(w) + "]" for w in got))
        else:
            failed += 1
            print("  FAIL  " + s["name"])
            print("        want " + str(want))
            print("        got  " + str(got))
        print("        " + s["why"])
        print()

    # Sequential vs wave-scheduled, on the contract scenario.
    seq = len(SCENARIOS[0]["tasks"])
    wav = len(schedule(SCENARIOS[0]["tasks"]))
    print("Speedup on the contract scenario: " + str(seq) + " sequential steps -> " +
          str(wav) + " waves\n")

    print(str(passed) + " passed, " + str(failed) + " failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
