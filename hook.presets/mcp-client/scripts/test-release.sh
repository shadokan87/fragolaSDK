#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME=$(node -p "require('./package.json').name")
TESTS_DIR="tests"
TESTS_PACKAGE_JSON="$TESTS_DIR/package.json"
TESTS_PACKAGE_JSON_BACKUP="$TESTS_DIR/package.json.bak"

cleanup() {
  if [[ -f "$TESTS_PACKAGE_JSON_BACKUP" ]]; then
    mv "$TESTS_PACKAGE_JSON_BACKUP" "$TESTS_PACKAGE_JSON"
  fi
}

trap cleanup EXIT

echo -e "\n🔢 \033[1;36mBumping version...\033[0m"
npm version prerelease --preid alpha --no-git-tag-version

echo -e "\n🏗️  \033[1;33mBuilding package...\033[0m"
bun run build

echo -e "\n📦 \033[1;35mPublishing to local registry...\033[0m"
bun run publish:local

echo -e "\n🔎 \033[1;34mChecking published versions...\033[0m"
npm view "$PACKAGE_NAME" versions --registry http://localhost:4873

VERSION=$(node -p "require('./package.json').version")

echo -e "\n🧹 \033[1;32mPreparing tests folder...\033[0m"
cp "$TESTS_PACKAGE_JSON" "$TESTS_PACKAGE_JSON_BACKUP"

cd "$TESTS_DIR"
rm -rf node_modules bun.lock
bun i
bun add "$PACKAGE_NAME@$VERSION" --exact --registry http://localhost:4873

echo -e "\n🧪 \033[1;31mRunning tests...\033[0m"
TESTS_ARG=""
for arg in "$@"; do
  case "$arg" in
    --tests=*)
      TESTS_ARG="${arg#--tests=}"
      TESTS_ARG="${TESTS_ARG//,/ }"
      ;;
  esac
done

bunx vitest --run $TESTS_ARG