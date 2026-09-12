"""Print one version's section from CHANGELOG.md, for use as release notes.

The GitHub Releases page is built from tags, not from commits - so pushing to main
publishes code and leaves Releases empty. The release workflow closes that gap, and it
needs the notes for exactly one version. Reading them from the changelog rather than
generating them from commit subjects keeps one hand-written account of each release
instead of two that drift.

Exits non-zero when the version has no section, so the workflow fails loudly rather than
publishing a release with an empty body.

Usage:  python scripts/changelog_section.py 1.7.0
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def section(text, version):
    """Return the body under '## <version>', up to the next '## ' heading."""
    # Anchored to the start of a line so a '## 1.7.0' inside a fenced block is ignored.
    start = re.search(r"^##\s+" + re.escape(version) + r"\s*$", text, re.M)
    if not start:
        return None
    rest = text[start.end():]
    nxt = re.search(r"^##\s+\S", rest, re.M)
    return (rest[:nxt.start()] if nxt else rest).strip()


def main(argv):
    if len(argv) != 2:
        print("usage: changelog_section.py <version>", file=sys.stderr)
        return 2
    version = argv[1].lstrip("v")
    path = os.path.join(ROOT, "CHANGELOG.md")
    with open(path, encoding="utf-8") as fh:
        body = section(fh.read(), version)
    if not body:
        print("no CHANGELOG.md section found for version " + version, file=sys.stderr)
        return 1
    print(body)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
