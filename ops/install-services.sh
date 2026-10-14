#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(git rev-parse --show-toplevel)"
node_binary="$(node -p process.execPath)"
unit_dir="$HOME/.config/systemd/user"
mkdir -p "$unit_dir" "$HOME/.config/michiratagame"
for file in "$repo_dir"/ops/*.service "$repo_dir"/ops/*.timer; do
  sed "s|/usr/bin/env node|$node_binary|g" "$file" > "$unit_dir/$(basename "$file")"
done
systemctl --user daemon-reload
systemctl --user enable michiratagame.service
printf 'Services installed. Run ops/deploy.sh from a clean committed checkout.\n'
