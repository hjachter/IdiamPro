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

            # Convert to the LOCAL system timezone so date bucketing and
            # displayed times reflect the wall-clock day the work happened
            # (a late-evening PDT session must NOT roll into the next UTC day).
            session_dt = session_dt.astimezone()

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

    # Build a set of session-identity fingerprints ALREADY present in the
    # outline, so a rerun never re-adds a session that's already logged even
    # if it was previously bucketed under a UTC-shifted (wrong) date name.
    # Newer nodes carry an explicit sourceSessionId; older/legacy nodes are
    # fingerprinted by their FIRST user-message text (normalized) so we can
    # still recognize a UTC-mis-dated duplicate (e.g. a stray "July 01" of
    # today). Message counts are NOT used — stored content filters out
    # system reminders/tool calls, so counts drift and can't be matched.
    import html as _html
    import re as _re

    def _norm_first_user(text):
        # Un-escape HTML entities FIRST (so &lt;tag&gt; becomes <tag>), THEN
        # strip tags, collapse whitespace, lowercase, take a stable prefix.
        # Order matters: unescaping before stripping makes an escaped-in-node
        # copy and a raw-transcript copy of the same message compare equal.
        t = _html.unescape(text or "")
        t = _re.sub(r"<[^>]+>", " ", t)
        t = _re.sub(r"\s+", " ", t).strip().lower()
        return t[:80]

    def session_fingerprint_from_session(sess):
        first_user = ""
        for msg in sess["messages"]:
            if msg["role"] == "user":
                first_user = msg["text"] or ""
                break
        return _norm_first_user(first_user)

    def session_fingerprint_from_node(node):
        sid = node.get("sourceSessionId")
        content = node.get("content", "")
        # First stored user message text (best-effort).
        mu = _re.search(r"<strong>User:</strong>\s*(.*?)</p>", content, _re.S)
        first_user = mu.group(1) if mu else ""
        return sid, _norm_first_user(first_user)

    existing_source_ids = set()
    existing_fingerprints = set()
    for nid, n in nodes.items():
        if n.get("type") == "root" or n.get("parentId") == root_id:
            continue  # skip root + date nodes; only look at session leaves
        if "<strong>Conversation:" in n.get("content", "") or "<strong>Changes Made" in n.get("content", ""):
            sid, fp = session_fingerprint_from_node(n)
            if sid:
                existing_source_ids.add(sid)
            existing_fingerprints.add(fp)

    added_dates = 0
    added_sessions = 0

    # Create/append sessions not already present, keyed by session identity
    # (NOT by date name) so UTC-vs-local date drift can't cause duplicates.
    existing_date_name_to_id = {}
    for cid in root.get("childrenIds", []):
        n = nodes.get(cid)
        if n:
            existing_date_name_to_id[n.get("name", "")] = cid

    for date_key in sorted(sessions_by_date.keys(), reverse=True):
        date_dt = datetime.strptime(date_key, "%Y-%m-%d")
        date_name = date_dt.strftime("%A, %B %d, %Y")
        date_sessions = sessions_by_date[date_key]

        # Filter out sessions already logged anywhere in the outline.
        new_sessions = []
        for sess in date_sessions:
            if sess["id"] in existing_source_ids:
                continue
            if session_fingerprint_from_session(sess) in existing_fingerprints:
                continue
            new_sessions.append(sess)

        if not new_sessions:
            continue  # all of this day's sessions already logged

        # Reuse an existing date node of the same name if present, else make one.
        if date_name in existing_date_name_to_id:
            date_node_id = existing_date_name_to_id[date_name]
            date_node = nodes[date_node_id]
        else:
            date_node = make_node(date_name, parent_id=root_id)
            date_node_id = date_node["id"]
            nodes[date_node_id] = date_node
            root["childrenIds"].insert(0, date_node_id)
            existing_date_name_to_id[date_name] = date_node_id
            added_dates += 1

        for idx, session in enumerate(new_sessions, 1):
            session_time = session["date"].strftime("%H:%M")
            if len(date_sessions) > 1:
                session_name = f"Session {idx} \u2014 {session_time}"
            else:
                session_name = f"Session \u2014 {session_time}"

            session_node = build_session_node(session, session_commits, date_node_id, session_name)
            session_node["sourceSessionId"] = session["id"]
            nodes[session_node["id"]] = session_node
            date_node["childrenIds"].append(session_node["id"])
            existing_source_ids.add(session["id"])
            existing_fingerprints.add(session_fingerprint_from_session(session))
            added_sessions += 1

    outline["updatedAt"] = datetime.now(timezone.utc).isoformat()
    outline["_added_dates"] = added_dates
    outline["_added_sessions"] = added_sessions
    return outline


def _parse_date_name(name):
    """Parse a date-node name like 'Tuesday, June 30, 2026' -> datetime, else None."""
    try:
        return datetime.strptime(name, "%A, %B %d, %Y")
    except ValueError:
        return None


def _parse_session_minutes(name):
    """Parse a session name's trailing 'HH:MM' -> minutes since midnight, else big."""
    import re
    m = re.search(r"(\d{1,2}):(\d{2})", name or "")
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    return 10 ** 9


def normalize_and_sort(outline, relabel_map=None):
    """Post-merge cleanup on the root's date-nodes, preserving ALL sessions.

    0. Relabel any date-node whose current name is a known UTC-mis-dated
       artifact to its correct LOCAL date name (relabel_map: old_name->new_name).
       This fixes a stray node (e.g. 'July 01') that was created under an
       earlier UTC-bucketing bug before the local-tz fix landed.
    1. Merge any date-nodes that share the same parsed calendar date
       (folds a stray UTC-mis-dated duplicate into the correct day; its
       session sub-nodes are moved, never dropped).
    2. Sort date-nodes into strict ascending chronological order.
    3. Sort session sub-nodes within each day by time.
    Any child the date parser cannot understand is left in place (never lost).
    The root's own content (stats) is untouched; there is no separate stats node.
    """
    nodes = outline["nodes"]
    root = nodes[outline["rootNodeId"]]

    # 0. Relabel known mis-dated nodes to their correct local date name.
    if relabel_map:
        for cid in list(root.get("childrenIds", [])):
            n = nodes.get(cid)
            if n and n.get("name") in relabel_map:
                n["name"] = relabel_map[n["name"]]

    child_ids = list(root.get("childrenIds", []))

    date_nodes = []      # (datetime, node_id)
    unparseable = []     # node_ids we couldn't date — keep, don't lose
    for cid in child_ids:
        n = nodes.get(cid)
        if not n:
            continue
        dt = _parse_date_name(n.get("name", ""))
        if dt is None:
            unparseable.append(cid)
        else:
            date_nodes.append((dt, cid))

    # 1. Merge same-calendar-date nodes.
    by_date = {}
    for dt, cid in date_nodes:
        key = dt.strftime("%Y-%m-%d")
        if key not in by_date:
            by_date[key] = (dt, cid)
        else:
            # Fold this node's sessions into the keeper, then drop the empty shell.
            keeper_dt, keeper_id = by_date[key]
            keeper = nodes[keeper_id]
            dup = nodes[cid]
            for sess_id in dup.get("childrenIds", []):
                nodes[sess_id]["parentId"] = keeper_id
                keeper["childrenIds"].append(sess_id)
            # Prefer the correctly-formatted name for the keeper.
            keeper["name"] = keeper_dt.strftime("%A, %B %d, %Y")
            del nodes[cid]

    # 2. Sort date-nodes ascending (oldest at top).
    ordered = sorted(by_date.values(), key=lambda t: t[0])
    ordered_ids = [cid for _, cid in ordered]

    # Ensure every kept date-node carries its canonical name.
    for dt, cid in ordered:
        nodes[cid]["name"] = dt.strftime("%A, %B %d, %Y")

    # 3. Sort session sub-nodes within each day by time.
    for _, cid in ordered:
        day = nodes[cid]
        day_children = list(day.get("childrenIds", []))
        day_children.sort(key=lambda sid: _parse_session_minutes(nodes.get(sid, {}).get("name", "")))
        # If a day has >1 real session, renumber their positional labels.
        real = [sid for sid in day_children]
        if len(real) > 1:
            for i, sid in enumerate(real, 1):
                sn = nodes[sid]
                mins = _parse_session_minutes(sn.get("name", ""))
                if mins < 10 ** 9:
                    hh, mm = divmod(mins, 60)
                    sn["name"] = f"Session {i} — {hh:02d}:{mm:02d}"
        day["childrenIds"] = day_children

    # Unparseable children (if any) kept pinned after the dated ones.
    root["childrenIds"] = ordered_ids + unparseable
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

    # Count session (leaf conversation) nodes BEFORE, so we can prove the
    # cleanup below never drops a real session even when it deletes an empty
    # date-shell during same-day dedup.
    def _count_session_nodes(nds, root_id):
        root = nds[root_id]
        c = 0
        for cid in root.get("childrenIds", []):
            n = nds.get(cid)
            if n:
                c += len(n.get("childrenIds", []))
        return c

    existing_sessions = 0
    if existing:
        existing_sessions = _count_session_nodes(existing["nodes"], existing["rootNodeId"])

    print("Building outline (safe merge)...")
    outline = build_outline(sessions, session_commits, existing=existing)

    added_dates = outline.pop("_added_dates", 0)
    added_sessions = outline.pop("_added_sessions", 0)

    # Build a relabel map: any date-node still carrying an OLD UTC-bucketed
    # name gets renamed to the correct LOCAL date name. For each transcript
    # session, compare its UTC calendar day (what the old bug produced) to its
    # local calendar day (correct). Only add an entry when they actually differ.
    from datetime import timezone as _tz
    relabel_map = {}
    for sess in sessions:
        local_dt = sess["date"]  # already local (astimezone in parse)
        utc_dt = local_dt.astimezone(_tz.utc)
        utc_name = utc_dt.strftime("%A, %B %d, %Y")
        local_name = local_dt.strftime("%A, %B %d, %Y")
        if utc_name != local_name:
            relabel_map[utc_name] = local_name

    # Chronological cleanup: relabel mis-dated days, merge duplicates, sort
    # ascending, order sessions within each day. Sessions are never dropped.
    print("Normalizing order (relabel + chronological sort + dedup)...")
    outline = normalize_and_sort(outline, relabel_map=relabel_map)

    node_count = len(outline["nodes"])
    final_sessions = _count_session_nodes(outline["nodes"], outline["rootNodeId"])

    # HARD SAFETY GUARD #2 (session-preserving): never lose a conversation
    # session. Raw node count may legitimately dip by empty date-shells folded
    # during dedup, but the number of session nodes must never shrink.
    if final_sessions < existing_sessions:
        print(
            f"ABORT: cleanup would lose sessions "
            f"({existing_sessions} -> {final_sessions}). Refusing to write."
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
