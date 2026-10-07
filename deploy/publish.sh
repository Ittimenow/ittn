#!/usr/bin/env bash
set -euo pipefail

: "${ITTN_SSH_KEY:?Configure the ITTN_SSH_KEY repository Actions secret}"
: "${GITHUB_SHA:?}"
: "${GITHUB_RUN_NUMBER:?}"
: "${GITHUB_REPOSITORY:?}"
: "${RUNNER_TEMP:?}"

# A slower old workflow must never replace a newer commit on main.
latest=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq '.object.sha')
if [[ "$latest" != "$GITHUB_SHA" ]]; then
  echo 'This commit was superseded on main; deployment skipped.'
  exit 0
fi

key=$(mktemp "$RUNNER_TEMP/ittn-ssh.XXXXXX")
trap 'rm -f "$key"' EXIT
chmod 600 "$key"
printf '%s\n' "$ITTN_SSH_KEY" > "$key"
unset ITTN_SSH_KEY

(
  cd release
  sha256sum -c image.tar.gz.sha256
)
checksum=$(cut -d ' ' -f 1 release/image.tar.gz.sha256)
[[ "$checksum" =~ ^[0-9a-f]{64}$ ]]

ssh -i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=deploy/known_hosts -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=20 \
  deploy@201.51.11.138 "deploy $GITHUB_SHA $checksum $GITHUB_RUN_NUMBER" < release/image.tar.gz

node scripts/check-http.mjs https://ittimenow.com --production --routes release/routes.json
echo "Published https://ittimenow.com from $GITHUB_SHA" >> "$GITHUB_STEP_SUMMARY"
