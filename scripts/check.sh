#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

FAILED=0
PASSED=0
RESULTS=()

run_step() {
  local label="$1"
  shift
  printf "${BLUE}▶${NC} ${BOLD}%s${NC}..." "$label"
  if output=$("$@" 2>&1); then
    printf " ${GREEN}✓${NC}\n"
    PASSED=$((PASSED + 1))
    RESULTS+=("${GREEN}✓${NC} $label")
  else
    printf " ${RED}✗${NC}\n"
    echo "$output"
    FAILED=$((FAILED + 1))
    RESULTS+=("${RED}✗${NC} $label")
  fi
}

echo ""
printf "${BOLD}Running all checks...${NC}\n\n"

# Lint
run_step "ESLint"              pnpm lint
run_step "Prettier"            pnpm format:check
run_step "TypeScript"          npx tsc --noEmit
run_step "Rust fmt"            cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
run_step "Rust clippy"         cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# Tests
run_step "Frontend tests"     pnpm test -- --run
run_step "E2E tests"          pnpm test:e2e
run_step "Rust tests"         cargo test --manifest-path src-tauri/Cargo.toml

# Summary
echo ""
printf "${BOLD}─── Summary ───${NC}\n"
for r in "${RESULTS[@]}"; do
  printf "  %b\n" "$r"
done
echo ""

if [ "$FAILED" -gt 0 ]; then
  printf "${RED}${BOLD}%d failed${NC}, ${GREEN}%d passed${NC}\n" "$FAILED" "$PASSED"
  exit 1
else
  printf "${GREEN}${BOLD}All %d checks passed${NC}\n" "$PASSED"
fi
