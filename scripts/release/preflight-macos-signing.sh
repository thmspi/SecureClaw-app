#!/usr/bin/env bash
set -euo pipefail

PREFIX="[preflight-macos-signing]"

fail() {
  echo "${PREFIX} ERROR: $1" >&2
  exit 1
}

echo "${PREFIX} Checking for Developer ID Application identity..."
if ! command -v security >/dev/null 2>&1; then
  fail "The macOS 'security' CLI is not available. Run this release flow on macOS with Xcode Command Line Tools installed."
fi

echo "${PREFIX} Checking APPLE_KEYCHAIN_PROFILE..."
if [[ -z "${APPLE_KEYCHAIN_PROFILE:-}" ]]; then
  fail "APPLE_KEYCHAIN_PROFILE is required. Run: xcrun notarytool store-credentials <profile-name> ... and export APPLE_KEYCHAIN_PROFILE=<profile-name>."
fi

IDENTITIES_OUTPUT="$(security find-identity -v -p codesigning 2>/dev/null || true)"
if ! printf "%s\n" "${IDENTITIES_OUTPUT}" | grep -q "Developer ID Application"; then
  echo "${PREFIX} Current code-signing identities:" >&2
  echo "${IDENTITIES_OUTPUT}" >&2
  fail "No 'Developer ID Application' identity found. Install your Apple Developer certificate in login keychain, then retry."
fi

echo "${PREFIX} PASS: signing identity and APPLE_KEYCHAIN_PROFILE are configured."
