#!/bin/bash

# IdiamPro Development Launcher
# One-click start for dev server + Electron

# Load shell environment (for npm/node paths)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
source ~/.zshrc 2>/dev/null || source ~/.bash_profile 2>/dev/null || true

PROJECT_DIR="/Users/howardjachter/Library/Mobile Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro"
LOG_FILE="/tmp/idiampro-dev.log"

echo "=== IdiamPro Dev Starting $(date) ===" > "$LOG_FILE"

cd "$PROJECT_DIR" || exit 1

# Check if dev server is already running on port 9002
if ! lsof -ti:9002 > /dev/null 2>&1; then
    echo "Starting dev server..." >> "$LOG_FILE"
    # Start dev server in background
    npm run dev >> "$LOG_FILE" 2>&1 &

    # Wait for server to be ready (max 30 seconds)
    echo "Waiting for dev server to start..." >> "$LOG_FILE"
    for i in {1..30}; do
        if curl -s http://localhost:9002 > /dev/null 2>&1; then
            echo "Dev server ready!" >> "$LOG_FILE"
            break
        fi
        sleep 1
    done
else
    echo "Dev server already running" >> "$LOG_FILE"
fi

# Launch Electron in development mode
echo "Launching Electron..." >> "$LOG_FILE"
NODE_ENV=development npx electron . >> "$LOG_FILE" 2>&1
