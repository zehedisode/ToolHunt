#!/usr/bin/env bash
set -euo pipefail

echo "🎣 Installing ToolHunt..."

echo "→ Installing dependencies..."
if ! npm install; then
  echo "❌ Setup failed at step: dependency installation"
  exit 1
fi

echo "→ Building MCP server..."
if ! npm run build; then
  echo "❌ Setup failed at step: MCP server build"
  exit 1
fi

echo "→ Building Web UI..."
if ! npm run build:ui; then
  echo "❌ Setup failed at step: Web UI build"
  exit 1
fi

echo "✅ ToolHunt installed. Run: npm start"
echo "📋 Open http://localhost:3847 to connect your agent"
