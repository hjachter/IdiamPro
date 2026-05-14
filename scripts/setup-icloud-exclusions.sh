#!/usr/bin/env bash
# Re-establish .nosync exclusions for heavy build folders.
# Run this after `npm install` or anytime npm/build tools regenerate the folders
# as real directories, breaking the symlink trick.
#
# iCloud Drive treats anything with a .nosync suffix as excluded from sync.
# We rename the heavy folders and symlink the expected name back to them so
# build tools work transparently.

set -e
cd "$(dirname "$0")/.."

exclude_folder() {
  local target="$1"
  if [ -L "$target" ]; then
    echo "$target: already a symlink, skipping"
    return
  fi
  if [ ! -e "$target" ]; then
    echo "$target: does not exist, skipping"
    return
  fi
  if [ -d "$target" ] && [ ! -d "$target.nosync" ]; then
    echo "$target -> $target.nosync (renaming + symlinking)"
    mv "$target" "$target.nosync"
    ln -s "$(basename "$target.nosync")" "$target"
  elif [ -d "$target.nosync" ]; then
    echo "$target: removing duplicate, re-symlinking"
    rm -rf "$target"
    ln -s "$(basename "$target.nosync")" "$target"
  fi
}

exclude_folder node_modules
exclude_folder .next
exclude_folder test-screenshots
exclude_folder mcp-server/node_modules

echo "Done. Verify with: ls -la node_modules .next test-screenshots"
