#!/bin/bash

# IdiamPro Development Launcher
# Starts dev server and Electron app in development mode

PROJECT_DIR="/Users/howardjachter/Library/Mobile Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro"

cd "$PROJECT_DIR"

# Check if dev server is already running
if ! lsof -ti:9002 > /dev/null 2>&1; then
    echo "Starting dev server..."
    npm run dev > /tmp/idiampro-dev.log 2>&1 &
    # Wait for server to start
    sleep 3
fi

# Launch Electron in development mode
echo "Launching IdiamPro Desktop in development mode..."
npm run electron:dev
