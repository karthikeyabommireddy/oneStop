#!/usr/bin/env bash
# An empty repository: no manifest, no source - greenfield.
set -euo pipefail
printf '# todo
' > README.md
git init -q
git add -A
git -c user.email=eval@onestop -c user.name=eval commit -qm "empty"
