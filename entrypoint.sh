#!/bin/sh
set -e

echo "Installing dependencies..."
# This is now the standard way to install in a workspace
pnpm install

echo "Starting Playground..."
pnpm run playground