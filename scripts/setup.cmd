@echo off
echo Installing ToolHunt...

echo - Installing dependencies...
call npm install
if errorlevel 1 (
  echo Setup failed at step: dependency installation
  exit /b 1
)

echo - Building MCP server...
call npm run build
if errorlevel 1 (
  echo Setup failed at step: MCP server build
  exit /b 1
)

echo - Building Web UI...
call npm run build:ui
if errorlevel 1 (
  echo Setup failed at step: Web UI build
  exit /b 1
)

echo ToolHunt installed. Run: npm start
echo Open http://localhost:3847 to connect your agent
