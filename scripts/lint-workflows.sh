#!/usr/bin/env bash
#
# Lint the GitHub Actions workflows with actionlint (npm run lint:workflows).
#
# This used to exist only as inline bash in .github/workflows/pr-check.yml, which
# YAML-parsed each file and grepped for `on:` and `jobs:` -- so it could not be run
# before pushing. actionlint is strictly stronger: it catches YAML errors and
# missing keys too, plus bad expressions, unknown action inputs, wrong `needs:`
# and, through shellcheck when that is installed, mistakes in `run:` scripts.
# pr-check.yml now calls this script, so CI and local runs share one definition.
# Issue #249.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v actionlint >/dev/null 2>&1; then
  echo "✖ actionlint is not installed."
  echo "  Install it with ./scripts/bootstrap.sh, or: brew install actionlint"
  echo "  https://github.com/rhysd/actionlint/blob/main/docs/install.md"
  exit 1
fi

# With no file arguments actionlint finds .github/workflows/*.{yml,yaml} itself.
actionlint "$@"
echo "✓ GitHub Actions workflows pass actionlint"
