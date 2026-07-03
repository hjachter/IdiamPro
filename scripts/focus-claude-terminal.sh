#!/bin/bash
#
# focus-claude-terminal.sh
#
# Bring the SPECIFIC Terminal window running Claude Code to the front.
#
# Problem: `osascript -e 'tell application "Terminal" to activate'` only raises
# the Terminal *app* — it lands on whichever Terminal window was last active,
# which after a Playwright/Electron run is often the WRONG window. Howard has
# multiple Terminal windows open (e.g. ttys000 and ttys001); Claude Code runs
# in one of them.
#
# Fix: find the tty that the `claude` process is attached to, then tell Terminal
# to select that exact tab and raise its window before activating.

# Find the tty of the `claude` process that has a real controlling terminal
# (background node/electron processes have no ttys* tty, so they're skipped).
dev="$(ps -e -o tty=,command= | awk '$1 ~ /^ttys/ && /claude/ {print $1; exit}')"
[ -z "$dev" ] && { osascript -e 'tell application "Terminal" to activate' 2>/dev/null; exit 0; }

# Bring Terminal forward FIRST, then explicitly raise the target window.
# (Doing it the other way round lets `activate` restore whatever Terminal
# window was last active — often the wrong one — after the target was set.)
osascript <<OSA 2>/dev/null || true
tell application "Terminal"
  activate
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is "/dev/$dev" then
        set selected tab of w to t
        set frontmost of w to true
        return
      end if
    end repeat
  end repeat
end tell
OSA
