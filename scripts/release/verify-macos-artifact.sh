#!/usr/bin/env bash
set -euo pipefail

PREFIX="[verify-macos-artifact]"

pass() {
  echo "${PREFIX} PASS: $1"
}

fail() {
  echo "${PREFIX} FAIL: $1" >&2
  exit 1
}

run_check() {
  local name="$1"
  shift

  if "$@"; then
    pass "${name}"
    return 0
  fi

  fail "${name}"
}

run_with_timeout() {
  local seconds="$1"
  shift

  local log_file
  log_file="$(mktemp)"

  if command -v timeout >/dev/null 2>&1; then
    set +e
    timeout "${seconds}" "$@" >"${log_file}" 2>&1
    local code=$?
    set -e
    if [[ ${code} -eq 0 || ${code} -eq 124 ]]; then
      rm -f "${log_file}"
      return 0
    fi

    cat "${log_file}" >&2
    rm -f "${log_file}"
    return "${code}"
  fi

  if command -v gtimeout >/dev/null 2>&1; then
    set +e
    gtimeout "${seconds}" "$@" >"${log_file}" 2>&1
    local code=$?
    set -e
    if [[ ${code} -eq 0 || ${code} -eq 124 ]]; then
      rm -f "${log_file}"
      return 0
    fi

    cat "${log_file}" >&2
    rm -f "${log_file}"
    return "${code}"
  fi

  "$@" >"${log_file}" 2>&1 &
  local pid=$!

  for ((i = 0; i < seconds; i += 1)); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      set +e
      wait "${pid}"
      local code=$?
      set -e
      if [[ ${code} -eq 0 ]]; then
        rm -f "${log_file}"
        return 0
      fi

      cat "${log_file}" >&2
      rm -f "${log_file}"
      return "${code}"
    fi
    sleep 1
  done

  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  rm -f "${log_file}"
  return 124
}

APP_PATH="${1:-}"
if [[ -z "${APP_PATH}" ]]; then
  fail "Usage: scripts/release/verify-macos-artifact.sh /path/to/SecureClaw.app"
fi

if [[ ! -d "${APP_PATH}" ]]; then
  fail "App path does not exist: ${APP_PATH}"
fi

APP_BINARY="${APP_PATH}/Contents/MacOS/SecureClaw"
if [[ ! -x "${APP_BINARY}" ]]; then
  fail "Launch binary is missing or not executable: ${APP_BINARY}"
fi

run_check "codesign verification" codesign --verify --deep --strict --verbose=2 "${APP_PATH}"
run_check "gatekeeper assessment" spctl --assess --type execute --verbose "${APP_PATH}"
run_check "stapled ticket validation" xcrun stapler validate "${APP_PATH}"

if run_with_timeout 10 "${APP_BINARY}"; then
  pass "launch smoke test (10s timeout)"
else
  fail "launch smoke test (10s timeout)"
fi
