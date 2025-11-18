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
bun run pub:local

echo -e "\n⏳ \033[1;34mWaiting for package to be available in registry...\033[0m"
# Wait for package to be available in registry
npm view @fragola-ai/agentic-sdk-core versions --registry http://localhost:4873
sleep 1

# Get the new version
VERSION=$(node -p "require('./package.json').version")

echo -e "\n🧹 \033[1;32mCleaning and reinstalling in tests folder...\033[0m"
# Clean and reinstall in tests folder
cd tests
rm -rf node_modules package-lock.json bun.lockb
bun remove @fragola-ai/agentic-sdk-core
bun add @fragola-ai/agentic-sdk-core@$VERSION

echo -e "\n🧪 \033[1;31mRunning tests...\033[0m"
# Run tests
bunx vitest --run
