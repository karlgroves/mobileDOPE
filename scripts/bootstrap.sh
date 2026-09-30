#!/usr/bin/env bash
#
# Installs the optional, non-npm security/quality binaries used by the Husky
# hooks and the `security:*` / `links` npm scripts. The hooks degrade gracefully
# when these are absent, so this script is a convenience, not a requirement.
set -euo pipefail

# Presence is not the same as working. #78: a Linux gitleaks build sat in
# /usr/local/bin on an arm64 Mac, satisfied `command -v`, and then failed to exec
# on every commit -- while this script reported it "present" and declined to
# reinstall it. Ask the binary to run instead.
have() { "$1" --version >/dev/null 2>&1; }

echo "Checking optional tooling binaries..."

# trufflehog — secret scanning (pre-commit / pre-push)
if have trufflehog; then
  echo "✓ trufflehog present"
else
  echo "… installing trufflehog"
  brew install trufflehog 2>/dev/null || echo "  ! install trufflehog manually: https://github.com/trufflesecurity/trufflehog/releases"
fi

# osv-scanner — dependency vulnerability scanning (npm run security:osv)
if have osv-scanner; then
  echo "✓ osv-scanner present"
else
  echo "… installing osv-scanner"
  brew install osv-scanner 2>/dev/null || echo "  ! install osv-scanner manually: https://github.com/google/osv-scanner/releases"
fi

# semgrep — SAST / OWASP Top 10 rulesets (npm run security:semgrep)
if have semgrep; then
  echo "✓ semgrep present"
else
  echo "… installing semgrep"
  brew install semgrep 2>/dev/null || pip install --user semgrep 2>/dev/null || echo "  ! install semgrep manually: https://semgrep.dev/docs/getting-started/"
fi

# maestro — mobile E2E runner (npm run test:e2e)
if have maestro; then
  echo "✓ maestro present"
else
  echo "… installing maestro"
  curl -Ls https://get.maestro.mobile.dev | bash 2>/dev/null \
    || brew install maestro 2>/dev/null \
    || echo "  ! install maestro manually: https://maestro.dev/docs/getting-started/installing-maestro"
fi

# lychee — Markdown link checker (npm run links)
if have lychee; then
  echo "✓ lychee present"
else
  echo "… installing lychee"
  brew install lychee 2>/dev/null || cargo install lychee 2>/dev/null || echo "  ! install lychee manually: https://github.com/lycheeverse/lychee/releases"
fi

echo ""
echo "Done. Run 'npm run check' for the npm-only gate, or the 'security:*' scripts for the binary-backed scans."
