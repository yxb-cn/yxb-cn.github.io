#!/bin/bash

set -u
cd "$(dirname "$0")" || exit 1

PNPM_VERSION="11.9.0"

pause_before_exit() {
  printf "\nPress Return to close this window."
  read -r _
}

show_error() {
  printf "\n%s\n" "$1"
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display dialog \"$1\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true
  fi
}

if ! command -v node >/dev/null 2>&1; then
  show_error "Node.js was not found. Install Node.js 22.13 or newer, then open this file again."
  printf "Download: https://nodejs.org/\n"
  pause_before_exit
  exit 1
fi

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
  elif command -v npx >/dev/null 2>&1; then
    npx --yes "pnpm@${PNPM_VERSION}" "$@"
  else
    return 127
  fi
}

if ! command -v pnpm >/dev/null 2>&1 &&
  ! command -v corepack >/dev/null 2>&1 &&
  ! command -v npx >/dev/null 2>&1; then
  show_error "npm and pnpm were not found. Reinstall Node.js 22.13 or newer, then try again."
  pause_before_exit
  exit 1
fi

if [ ! -x "node_modules/.bin/vinext" ]; then
  printf "\nFirst-time setup: installing the editor dependencies...\n"
  printf "This normally takes a few minutes and only needs to run once.\n\n"
  if ! run_pnpm install --frozen-lockfile; then
    show_error "Setup could not finish. Check your internet connection and try again."
    pause_before_exit
    exit 1
  fi
fi

printf "\nStarting the homepage editor.\n"
printf "ScholarCanvas will identify this folder and choose an available local port.\n"
printf "Keep this window open. Close it or press Control-C to stop the local site.\n\n"

run_pnpm editor
status=$?

printf "\nThe local site has stopped.\n"
pause_before_exit
exit "$status"
