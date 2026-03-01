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
    "~/.claude/projects/-Users-howardjachter-Library-Mobile-Documents-com-apple-CloudDocs-ClaudeProjects-IdiamPro"
)
OUTPUT_FILE = os.path.expanduser("~/Documents/IDM Outlines/ClaudeCode Conversation Logs.idm")
PROJECT_DIR = os.path.expanduser(
    "~/Library/Mobile Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro"
)


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


def build_outline(sessions, session_commits):
    """Build the outline structure."""
    nodes = {}
    root_id = str(uuid.uuid4())

    # Group sessions by date
    sessions_by_date = defaultdict(list)
    for session in sorted(sessions, key=lambda s: s["date"]):
        date_key = session["date"].strftime("%Y-%m-%d")
        sessions_by_date[date_key].append(session)

    total_sessions = len(sessions)
    total_messages = sum(len(s["messages"]) for s in sessions)
    total_commits = sum(len(c) for c in session_commits.values())
    total_days = len(sessions_by_date)

    # Root node
    root = {
        "id": root_id,
        "name": "ClaudeCode Conversation Logs",
        "type": "root",
        "content": f"<p><strong>Total:</strong> {total_sessions} sessions, {total_messages} messages, {total_commits} commits across {total_days} days</p>",
        "parentId": None,
        "childrenIds": [],
        "collapsed": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    nodes[root_id] = root

    # Create date nodes (sorted chronologically, newest first for easy access)
    for date_key in sorted(sessions_by_date.keys(), reverse=True):
        date_sessions = sessions_by_date[date_key]
        date_dt = datetime.strptime(date_key, "%Y-%m-%d")
        date_name = date_dt.strftime("%A, %B %d, %Y")

        date_node = make_node(date_name, parent_id=root_id)
        date_node_id = date_node["id"]
        nodes[date_node_id] = date_node
        root["childrenIds"].append(date_node_id)

        # Create session nodes
        for idx, session in enumerate(date_sessions, 1):
            session_time = session["date"].strftime("%H:%M")
            if len(date_sessions) > 1:
                session_name = f"Session {idx} \u2014 {session_time}"
            else:
                session_name = f"Session \u2014 {session_time}"

            # Build session content
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
            session_node = make_node(session_name, content=session_content, parent_id=date_node_id)
            session_node_id = session_node["id"]
            nodes[session_node_id] = session_node
            date_node["childrenIds"].append(session_node_id)

    return {
        "id": str(uuid.uuid4()),
        "name": "ClaudeCode Conversation Logs",
        "rootNodeId": root_id,
        "nodes": nodes,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "version": 2,
    }


def main():
    print("Parsing JSONL conversation files...")
    sessions = parse_jsonl_files()
    print(f"Found {len(sessions)} sessions")

    print("Getting git commits...")
    commits = get_git_commits()
    print(f"Found {len(commits)} commits")

    print("Matching commits to sessions...")
    session_commits = match_commits_to_sessions(commits, sessions)

    print("Building outline...")
    outline = build_outline(sessions, session_commits)

    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w") as f:
        json.dump(outline, f, indent=2)

    node_count = len(outline["nodes"])
    print(f"Done! {node_count} nodes written.")
    print("Reload the 'ClaudeCode Conversation Logs' outline in IdiamPro to see the updated version.")


if __name__ == "__main__":
    main()
