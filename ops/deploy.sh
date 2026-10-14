#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(git rev-parse --show-toplevel)"
cd "$repo_dir"
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Commit the reviewed changes before deployment.' >&2
  exit 1
fi
release_id="$(git rev-parse --short HEAD)-$(date +%s)"
release_dir="$repo_dir/releases/$release_id"
config_file="$HOME/.config/michiratagame/production.env"
mkdir -p "$release_dir"
git archive HEAD | tar -x -C "$release_dir"
cd "$release_dir"
npm ci --include=dev
npm test
VITE_GAME_MODE=online node --env-file-if-exists="$config_file" --run build
cd "$repo_dir"
previous_release="$(readlink -f current || true)"
if [[ -f data/production/community.sqlite ]]; then
  MICHI_DATA_DIR="$repo_dir/data/production" node --experimental-strip-types tools/backup.ts
fi
ln -s "$release_dir" current.next
mv -Tf current.next current
systemctl --user restart michiratagame.service
healthy=0
for attempt in {1..10}; do
  if node --env-file-if-exists="$config_file" --experimental-strip-types "$release_dir/tools/check-health.ts"; then
    healthy=1
    break
  fi
  sleep 1
done
if [[ "$healthy" != 1 ]]; then
  if [[ -d "$previous_release" && "$previous_release" != "$repo_dir/current" ]]; then
    ln -s "$previous_release" current.next
    mv -Tf current.next current
    systemctl --user restart michiratagame.service
  fi
  echo 'Deployment failed the health check. Existing releases and database backups are retained.' >&2
  exit 1
fi
printf '%s\n' "$previous_release" > data/production/previous-release
systemctl --user enable --now michiratagame-backup.timer michiratagame-health.timer
printf 'Published release %s\n' "$release_id"
