#!/usr/bin/env bash
set -e

echo -e "\n🔢 \033[1;36mBumping version...\033[0m"
# Bump version
npm version prerelease --preid alpha --no-git-tag-version

echo -e "\n🏗️  \033[1;33mBuilding package...\033[0m"
# Build the package
bun run build

echo -e "\n📦 \033[1;35mPublishing to local registry...\033[0m"
# Publish to local registry
bun run publish:local

echo -e "\n⏳ \033[1;34mWaiting for package to be available in registry...\033[0m"
# Wait for package to be available in registry
npm view @fragola-ai/agent versions --registry http://localhost:4873
sleep 1

# Get the new version
VERSION=$(node -p "require('./package.json').version")

echo -e "\n🧹 \033[1;32mCleaning and reinstalling in tests folder...\033[0m"
# Clean and reinstall in tests folder
cd tests
bun update @fragola-ai/agent --registry http://localhost:4873

echo -e "\n🧪 \033[1;31mRunning tests...\033[0m"
# Parse optional --tests=<file1,file2> argument
TESTS_ARG=""
for arg in "$@"; do
  case "$arg" in
    --tests=*)
      TESTS_ARG="${arg#--tests=}"
      TESTS_ARG="${TESTS_ARG//,/ }"
      ;;
  esac
done

# Run tests
bunx vitest --run $TESTS_ARG
