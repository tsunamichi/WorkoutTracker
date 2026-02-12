#!/bin/bash
# Run all Maestro smoke tests against the iOS Simulator.
#
# Prerequisites:
#   1. iOS Simulator is running with the app installed
#   2. Maestro is installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#   3. App is built and running: npm run ios
#
# Usage:
#   .maestro/run_all.sh           # Run all tests
#   .maestro/run_all.sh 01        # Run a specific test by prefix

set -euo pipefail

# Use the Maestro Mobile binary (not LinkedIn's internal maestro-cli)
export PATH="$HOME/.maestro/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  WorkoutTracker — Maestro Smoke Tests"
echo "============================================"
echo ""

# Collect test files
if [ -n "${1:-}" ]; then
  FILES=("$SCRIPT_DIR/${1}"*.yaml)
else
  FILES=("$SCRIPT_DIR"/[0-9]*.yaml)
fi

TOTAL=${#FILES[@]}
PASSED=0
FAILED=0
SKIPPED=0

for f in "${FILES[@]}"; do
  BASENAME=$(basename "$f" .yaml)
  echo -e "${YELLOW}▶ Running: $BASENAME${NC}"
  
  if maestro test "$f" --output "$RESULTS_DIR/$BASENAME" 2>&1; then
    echo -e "${GREEN}  ✓ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}  ✗ FAILED${NC}"
    ((FAILED++))
  fi
  echo ""
done

echo "============================================"
echo -e "  Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC} / $TOTAL total"
echo "  Screenshots: $RESULTS_DIR/"
echo "============================================"

exit $FAILED
