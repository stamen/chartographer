#!/usr/bin/env bash
set -euo pipefail

# Builds the static site and publishes it to the gh-pages branch, which
# GitHub Pages serves (custom domain via CNAME — see static/CNAME).
#
# Runs the same way whether invoked directly or from CI, so the two paths
# can't drift apart:
#   - Locally:  npm run deploy   (uses your own git identity/credentials)
#   - From CI:  .github/workflows/deploy.yml checks out the desired
#               branch/ref first, then calls this script — see that file
#               if you need to deploy something other than main.

cd "$(dirname "$0")/.."

npm run build

args=(--dist build --branch gh-pages --dotfiles --message "Deploy $(git rev-parse --short HEAD)")

# CI sets this to a bot identity; a local run falls back to your own git
# config instead of forcing one.
if [ -n "${GIT_DEPLOY_USER:-}" ]; then
	args+=(--user "$GIT_DEPLOY_USER")
fi

npx gh-pages "${args[@]}"
