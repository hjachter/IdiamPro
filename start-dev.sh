#!/bin/bash

# IdiamPro Dev Server Launcher
# This script starts the Next.js dev server

# Navigate to project directory
cd "/Users/howardjachter/Library/Mobile Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro"

# Load NVM and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22

# Start the dev server
npm run dev

# Keep terminal open after server stops
echo ""
echo "Dev server stopped. Press any key to close..."
read -n 1
