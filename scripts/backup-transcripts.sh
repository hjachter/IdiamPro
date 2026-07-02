#!/bin/bash
#
# backup-transcripts.sh
#
# Backs up Claude Code conversation transcripts (the raw *.jsonl session files
# the conversation log is built from) into the iCloud-synced Documents folder,
# so they survive a project move / local wipe. These transcripts live in a
# hidden app folder that is NOT in iCloud and NOT in git — this is their only
# off-machine backup.
#
# SAFETY: this is an ADDITIVE mirror. rsync runs WITHOUT --delete, so the
# backup only ever ACCUMULATES. If the source folder is emptied (exactly what
# happened when the project moved off iCloud on 2026-07-01), the backup keeps
# every file it already has. Transcript files are append-only, so a plain
# rsync -a never shrinks a backed-up file.
#
# Covers every Claude project folder whose name references IdiamPro, so a
# future project-path change is still captured.

set -u

DEST="$HOME/Documents/ClaudeCode Transcripts Backup"
SRC_ROOT="$HOME/.claude/projects"
mkdir -p "$DEST"

stamp="$(date '+%Y-%m-%d %H:%M:%S')"
count=0

for dir in "$SRC_ROOT"/*IdiamPro*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  mkdir -p "$DEST/$name"
  # -a preserve attrs/recurse; NO --delete (additive only).
  rsync -a "$dir" "$DEST/$name/" 2>/dev/null
  n="$(find "$DEST/$name" -name '*.jsonl' | wc -l | tr -d ' ')"
  count=$((count + n))
done

echo "[$stamp] transcript backup complete → $DEST ($count jsonl files present)"
