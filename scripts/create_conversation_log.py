#!/usr/bin/env python3
"""
Regenerate the ClaudeCode Conversation Logs outline from JSONL transcripts and git history.
Outputs to ~/Documents/IDM Outlines/ClaudeCode Conversation Logs.idm
"""

import json
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

JSONL_DIR = os.path.expanduser(
    "~/.claude/projects/-Users-howardjachter-Developer-IdiamPro"
)
OUTPUT_FILE = os.path.expanduser("~/Documents/IDM Outlines/ClaudeCode Conversation Logs.idm")
PROJECT_DIR = os.path.expanduser("~/Developer/IdiamPro")


def get_git_commits():
    """Get git commits since project start."""
    try:
        result = subprocess.run(
            ["git", "log", "--format=%H|%aI|%s", "--since=2025-12-01"],
            capture_output=True, text=True, cwd=PROJECT_DIR
        )
        commits = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|", 2)
            if len(parts) == 3:
                commits.append({
                    "hash": parts[0],
                    "date": parts[1],
                    "message": parts[2],
                    "timestamp": datetime.fromisoformat(parts[1])
                })
        return commits
    except Exception as e:
        print(f"Warning: Could not get git commits: {e}")
        return []


def parse_jsonl_files():
    """Parse all non-agent JSONL files and extract sessions."""
    sessions = []
    jsonl_dir = Path(JSONL_DIR)

    if not jsonl_dir.exists():
        print(f"JSONL directory not found: {JSONL_DIR}")
        return sessions

    for jsonl_file in sorted(jsonl_dir.glob("*.jsonl")):
        try:
            messages = []
            session_id = jsonl_file.stem
            first_timestamp = None
            is_agent = False

            with open(jsonl_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    msg_type = obj.get("type", "")

                    # Skip agent/subagent transcripts (userType != 'external')
                    if msg_type == "user" and obj.get("userType") and obj.get("userType") != "external":
                        is_agent = True
                        break

                    if msg_type in ("user", "assistant"):
                        ts = obj.get("timestamp", "")
                        if ts and not first_timestamp:
                            first_timestamp = ts

                        role = msg_type
                        message = obj.get("message", "")

                        # Extract text content
                        text = ""
                        if isinstance(message, str):
                            text = message
                        elif isinstance(message, dict):
                            content = message.get("content", "")
                            if isinstance(content, str):
                                text = content
                            elif isinstance(content, list):
                                text_parts = []
                                for block in content:
                                    if isinstance(block, dict):
                                        if block.get("type") == "text":
                                            text_parts.append(block.get("text", ""))
                                        elif block.get("type") == "tool_use":
                                            tool = block.get("name", "unknown")
                                            text_parts.append(f"[Tool: {tool}]")
                                    elif isinstance(block, str):
                                        text_parts.append(block)
                                text = " ".join(text_parts)

                            # For user messages, content might be at message.content
                            if not text and isinstance(message, dict):
                                role_val = message.get("role", "")
                                if role_val == "user":
                                    c = message.get("content", "")
                                    if isinstance(c, str):
                                        text = c
                                    elif isinstance(c, list):
                                        for block in c:
                                            if isinstance(block, dict) and block.get("type") == "text":
                                                text = block.get("text", "")
                                                break

                        if text:
                            # Truncate very long messages
                            if len(text) > 500:
                                text = text[:500] + "..."
                            messages.append({
                                "role": role,
                                "text": text,
                                "timestamp": ts
                            })

            if is_agent or not messages or not first_timestamp:
                continue

            try:
                session_dt = datetime.fromisoformat(first_timestamp.replace("Z", "+00:00"))
            except ValueError:
                continue

            sessions.append({
                "id": session_id,
                "date": session_dt,
                "messages": messages,
            })

        except Exception as e:
            print(f"Warning: Could not parse {jsonl_file.name}: {e}")

    return sessions


def match_commits_to_sessions(commits, sessions):
    """Match git commits to the closest session by timestamp."""
    session_commits = defaultdict(list)

    for commit in commits:
        commit_ts = commit["timestamp"]
        if commit_ts.tzinfo is None:
            commit_ts = commit_ts.replace(tzinfo=timezone.utc)

        best_session = None
        best_diff = None

        for session in sessions:
            session_ts = session["date"]
            if session_ts.tzinfo is None:
                session_ts = session_ts.replace(tzinfo=timezone.utc)

            # Commit should be during or after session start
            diff = abs((commit_ts - session_ts).total_seconds())
            # Only match within 12 hours
            if diff < 43200:
                if best_diff is None or diff < best_diff:
                    best_diff = diff
                    best_session = session["id"]

        if best_session:
            session_commits[best_session].append(commit)

    return session_commits


def make_node(name, content="", node_type="chapter", parent_id=None, children=None):
    """Create an outline node."""
    node_id = str(uuid.uuid4())
    return {
        "id": node_id,
        "name": name,
        "type": node_type,
        "content": content,
        "parentId": parent_id,
        "childrenIds": children or [],
        "collapsed": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def build_session_node(session, session_commits, parent_id, session_name):
    """Build a single session node dict."""
    content_parts = []

    # Add commits if any
    commits = session_commits.get(session["id"], [])
    if commits:
        content_parts.append("<p><strong>Changes Made:</strong></p><ul>")
        for commit in commits:
            msg = commit["message"]
            short_hash = commit["hash"][:7]
            content_parts.append(f"<li><code>{short_hash}</code> {msg}</li>")
        content_parts.append("</ul>")

    # Add conversation messages
    content_parts.append("<p><strong>Conversation:</strong></p>")
    for msg in session["messages"]:
        role_label = "User" if msg["role"] == "user" else "Claude"
        text = msg["text"].replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
        # Remove system reminders and tool content from display
        if "system-reminder" in text or "[Tool:" in text:
            continue
        if len(text) > 300:
            text = text[:300] + "..."
        content_parts.append(f"<p><strong>{role_label}:</strong> {text}</p>")

    session_content = "\n".join(content_parts)
    return make_node(session_name, content=session_content, parent_id=parent_id)


def load_existing_outline():
    """Load the existing .idm outline if present, else return None."""
    if not os.path.exists(OUTPUT_FILE):
        return None
    try:
        with open(OUTPUT_FILE, "r") as f:
            data = json.load(f)
        if isinstance(data, dict) and "nodes" in data and data.get("rootNodeId"):
            return data
    except Exception as e:
        print(f"Warning: Could not read existing outline: {e}")
    return None


def build_outline(sessions, session_commits, existing=None):
    """Build (or merge into) the outline structure.

    If `existing` is provided, only NEW date nodes (by name) and their
    sessions are appended; all existing nodes are preserved untouched.
    Reruns are idempotent \u2014 a date already present is skipped entirely.
    """
    # Group sessions by date
    sessions_by_date = defaultdict(list)
    for session in sorted(sessions, key=lambda s: s["date"]):
        date_key = session["date"].strftime("%Y-%m-%d")
        sessions_by_date[date_key].append(session)

    if existing:
        nodes = existing["nodes"]
        root_id = existing["rootNodeId"]
        root = nodes[root_id]
        outline = existing
    else:
        nodes = {}
        root_id = str(uuid.uuid4())
        root = {
            "id": root_id,
            "name": "ClaudeCode Conversation Logs",
            "type": "root",
            "content": "",
            "parentId": None,
            "childrenIds": [],
            "collapsed": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        nodes[root_id] = root
        outline = {
            "id": str(uuid.uuid4()),
            "name": "ClaudeCode Conversation Logs",
            "rootNodeId": root_id,
            "nodes": nodes,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "version": 2,
        }

    # Names of date nodes already present under the root (merge dedup key)
    existing_date_names = set()
    for cid in root.get("childrenIds", []):
        n = nodes.get(cid)
        if n:
            existing_date_names.add(n.get("name", ""))

    added_dates = 0
    added_sessions = 0

    # Create date nodes for dates not already present.
    # Newest first so they land at the top of the root's children.
    for date_key in sorted(sessions_by_date.keys(), reverse=True):
        date_dt = datetime.strptime(date_key, "%Y-%m-%d")
        date_name = date_dt.strftime("%A, %B %d, %Y")

        if date_name in existing_date_names:
            # Already logged \u2014 leave untouched (idempotent rerun).
            continue

        date_sessions = sessions_by_date[date_key]
        date_node = make_node(date_name, parent_id=root_id)
        date_node_id = date_node["id"]
        nodes[date_node_id] = date_node
        # Insert new date at the top of the list (newest-first ordering)
        root["childrenIds"].insert(0, date_node_id)
        added_dates += 1

        for idx, session in enumerate(date_sessions, 1):
            session_time = session["date"].strftime("%H:%M")
            if len(date_sessions) > 1:
                session_name = f"Session {idx} \u2014 {session_time}"
            else:
                session_name = f"Session \u2014 {session_time}"

            session_node = build_session_node(session, session_commits, date_node_id, session_name)
            nodes[session_node["id"]] = session_node
            date_node["childrenIds"].append(session_node["id"])
            added_sessions += 1

    outline["updatedAt"] = datetime.now(timezone.utc).isoformat()
    outline["_added_dates"] = added_dates
    outline["_added_sessions"] = added_sessions
    return outline


def main():
    print("Parsing JSONL conversation files...")
    sessions = parse_jsonl_files()
    print(f"Found {len(sessions)} sessions")

    # HARD SAFETY GUARD #1: never write with zero sessions.
    # A zero-session run means the transcript folder is wrong/empty; writing
    # would wipe the log. Abort without touching the output file.
    if not sessions:
        print("ABORT: 0 sessions parsed. Refusing to write — this would wipe the log.")
        print("Check that JSONL_DIR points at the current transcript folder.")
        return

    print("Getting git commits...")
    commits = get_git_commits()
    print(f"Found {len(commits)} commits")

    print("Matching commits to sessions...")
    session_commits = match_commits_to_sessions(commits, sessions)

    existing = load_existing_outline()
    existing_count = len(existing["nodes"]) if existing else 0
    print(f"Existing outline node count: {existing_count}")

    print("Building outline (safe merge)...")
    outline = build_outline(sessions, session_commits, existing=existing)

    added_dates = outline.pop("_added_dates", 0)
    added_sessions = outline.pop("_added_sessions", 0)
    node_count = len(outline["nodes"])

    # HARD SAFETY GUARD #2: never shrink the log below what already exists.
    if node_count < existing_count:
        print(
            f"ABORT: merge would reduce node count "
            f"({existing_count} -> {node_count}). Refusing to write."
        )
        return

    print(f"Added {added_dates} new date(s), {added_sessions} new session(s).")
    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w") as f:
        json.dump(outline, f, indent=2)

    print(f"Done! {node_count} nodes written (was {existing_count}).")
    print("Reload the 'ClaudeCode Conversation Logs' outline in IdiamPro to see the updated version.")


if __name__ == "__main__":
    main()
