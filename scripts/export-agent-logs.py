#!/usr/bin/env python3
"""Export Claude Code JSONL transcripts for this project to readable Markdown.

Reads   ~/.claude/projects/<encoded-project-path>/*.jsonl  (read-only)
        ~/.claude/projects/<encoded-project-path>/<session>/subagents/agent-*.jsonl
Writes  docs/agent-logs/session-NNN.md, docs/agent-logs/README.md,
        docs/agent-logs/manifest.json (keeps session numbering stable across runs)

Usage:  python3 scripts/export-agent-logs.py [--source DIR] [--out DIR]

Standard library only. Nothing is redacted: review the output manually before
publishing it.
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Record types that carry client bookkeeping, not conversation content.
# They are counted and reported as skipped, never silently dropped.
METADATA_TYPES = {
    "mode": "UI mode state",
    "permission-mode": "permission mode state",
    "file-history-snapshot": "file backup bookkeeping",
    "file-history-delta": "file backup bookkeeping",
    "atis-latch": "client internal flag",
    "last-prompt": "resume pointer",
    "ai-title": "session title (used as heading)",
    "cost-state": "cost/usage counters",
    "session-owner": "account identifiers",
    "queue-operation": "input queue bookkeeping",
    "api-request": "raw API request (duplicates messages)",
    "api-request-blob": "raw API request (duplicates messages)",
    "api-request-shape": "raw API request (duplicates messages)",
    "tools-used": "tool usage summary",
}

SECRET_PATTERNS = {
    "Anthropic key": r"sk-ant-[A-Za-z0-9_\-]{20,}",
    "OpenAI-style key": r"\bsk-[A-Za-z0-9]{32,}",
    "GitHub token": r"\bgh[pousr]_[A-Za-z0-9]{30,}",
    "AWS access key": r"\bAKIA[0-9A-Z]{16}\b",
    "Private key": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "JWT": r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}",
    "Password/secret assignment": r"(?i)\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['\"]?[^\s'\"]{8,}",
    "Email address": r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}",
    "DB connection URL": r"\b(postgres|postgresql|mysql|mongodb(\+srv)?)://[^\s]+:[^\s]+@",
}


def default_source_dir():
    encoded = re.sub(r"[^A-Za-z0-9]", "-", str(PROJECT_ROOT))
    return Path.home() / ".claude" / "projects" / encoded


def fence(text, lang=""):
    """Wrap text in a code fence longer than any backtick run inside it."""
    longest = max((len(m) for m in re.findall(r"`+", text)), default=0)
    ticks = "`" * max(3, longest + 1)
    return f"{ticks}{lang}\n{text}\n{ticks}"


def details(summary, body):
    return f"<details>\n<summary>{summary}</summary>\n\n{body}\n\n</details>"


def read_jsonl(path, stats):
    records = []
    with path.open("r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as err:
                stats["problems"].append(f"{path.name}:{line_no} invalid JSON ({err}) - record not exported")
    return records


class SessionRenderer:
    """Turns one JSONL file into Markdown lines, tracking what it rendered."""

    def __init__(self, stats, heading_level=3):
        self.stats = stats
        self.h = "#" * heading_level
        self.out = []
        self.expected_snippets = []  # text that must appear in the output (verification)
        self.seen_uuids = set()
        self.seen_blocks = set()
        self.current_speaker = None

    def emit(self, text):
        self.out.append(text)

    def speaker(self, key, title, timestamp):
        if self.current_speaker != key:
            self.emit(f"{self.h} {title}" + (f" · {timestamp}" if timestamp else ""))
            self.current_speaker = key

    def render_records(self, records, subagent_anchors=None):
        subagent_anchors = subagent_anchors or {}
        for record in records:
            rtype = record.get("type", "<missing>")
            self.stats["records"][rtype] += 1
            uuid = record.get("uuid")
            if uuid and uuid in self.seen_uuids:
                self.stats["duplicates"] += 1
                continue
            if uuid:
                self.seen_uuids.add(uuid)

            if rtype in METADATA_TYPES:
                self.stats["skipped"][rtype] += 1
            elif rtype == "user":
                self.render_user(record)
            elif rtype == "assistant":
                self.render_assistant(record, subagent_anchors)
            elif rtype == "system":
                self.render_system(record)
            elif rtype == "attachment":
                self.render_attachment(record)
            else:
                self.stats["unsupported"][rtype] += 1
                self.current_speaker = None
                self.emit(details(f"Unsupported record type <code>{rtype}</code> (raw JSON)",
                                  fence(json.dumps(record, indent=2, ensure_ascii=False), "json")))

    def render_user(self, record):
        message = record.get("message", {})
        content = message.get("content")
        ts = record.get("timestamp", "")
        is_meta = record.get("isMeta") or record.get("isCompactSummary")
        label = "Injected context (meta)" if record.get("isMeta") else "User"
        if record.get("isCompactSummary"):
            label = "Compaction summary"

        if isinstance(content, str):
            self.speaker(("user", record.get("uuid")), label, ts)
            self.add_text_block(content, as_code=True)
            self.stats["rendered"]["meta_or_summary" if is_meta else "user_prompt"] += 1
            return

        for block in content or []:
            btype = block.get("type")
            if btype == "tool_result":
                self.render_tool_result(block, ts)
            elif btype == "text":
                self.speaker(("user", record.get("uuid")), label, ts)
                self.add_text_block(block.get("text", ""), as_code=True)
                self.stats["rendered"]["meta_or_summary" if is_meta else "user_prompt"] += 1
            else:
                self.speaker(("user", record.get("uuid")), label, ts)
                self.render_other_block(block)

    def render_assistant(self, record, subagent_anchors):
        message = record.get("message", {})
        msg_id = message.get("id") or record.get("uuid")
        model = message.get("model", "")
        for block in message.get("content") or []:
            block_key = (msg_id, json.dumps(block, sort_keys=True))
            if block_key in self.seen_blocks:
                self.stats["duplicates"] += 1
                continue
            self.seen_blocks.add(block_key)
            self.speaker(("assistant", msg_id), f"Assistant ({model})" if model else "Assistant",
                         record.get("timestamp", ""))
            btype = block.get("type")
            if btype == "text":
                self.add_text_block(block.get("text", ""), as_code=False)
                self.stats["rendered"]["assistant_text"] += 1
            elif btype == "thinking":
                thinking = block.get("thinking", "")
                if thinking:
                    self.emit(details("Thinking", fence(thinking)))
                    self.expected_snippets.append(thinking)
                else:
                    self.emit("_[Thinking block: content not stored in transcript (signature only)]_")
                    self.stats["incomplete"]["thinking without stored text"] += 1
                self.stats["rendered"]["thinking"] += 1
            elif btype == "redacted_thinking":
                self.emit("_[Redacted thinking block: encrypted by the API, not readable]_")
                self.stats["incomplete"]["redacted thinking"] += 1
            elif btype == "tool_use":
                self.render_tool_use(block, subagent_anchors)
            else:
                self.render_other_block(block)

    def render_tool_use(self, block, subagent_anchors):
        tool_id = block.get("id", "")
        name = block.get("name", "?")
        input_json = json.dumps(block.get("input", {}), indent=2, ensure_ascii=False)
        self.emit(f"**Tool call: `{name}`** (`{tool_id}`)")
        self.emit(fence(input_json, "json"))
        if tool_id in subagent_anchors:
            self.emit(f"→ Subagent transcript: [{subagent_anchors[tool_id]}](#{subagent_anchors[tool_id]})")
        self.expected_snippets.append(tool_id)
        self.stats["rendered"]["tool_use"] += 1

    def render_tool_result(self, block, ts):
        self.current_speaker = None
        tool_id = block.get("tool_use_id", "")
        content = block.get("content", "")
        parts = []
        if isinstance(content, str):
            parts.append(fence(content))
            self.expected_snippets.append(content)
        else:
            for item in content or []:
                if item.get("type") == "text":
                    parts.append(fence(item.get("text", "")))
                    self.expected_snippets.append(item.get("text", ""))
                else:
                    parts.append(self.binary_placeholder(item))
        status = " — ERROR" if block.get("is_error") else ""
        self.emit(details(f"Tool result <code>{tool_id}</code>{status} · {ts}", "\n\n".join(parts)))
        self.stats["rendered"]["tool_result"] += 1

    def render_system(self, record):
        self.current_speaker = None
        subtype = record.get("subtype", "")
        content = record.get("content")
        if content is None:
            extra = {k: v for k, v in record.items()
                     if k not in {"parentUuid", "isSidechain", "userType", "cwd", "sessionId",
                                  "version", "gitBranch", "entrypoint", "uuid", "type", "timestamp"}}
            body = json.dumps(extra, ensure_ascii=False)
        else:
            body = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
        self.emit(f"> ⚙️ **System** (`{subtype}`) · {record.get('timestamp', '')}: {body}".replace("\n", "\n> "))
        self.stats["rendered"]["system"] += 1

    def render_attachment(self, record):
        attachment = record.get("attachment", {})
        atype = attachment.get("type", "?")
        rendered = record.get("rendered")
        if not rendered:
            self.stats["skipped"][f"attachment:{atype} (no model-visible content)"] += 1
            return
        self.current_speaker = None
        texts = []
        for item in rendered:
            value = item.get("content") if isinstance(item, dict) else item
            if isinstance(value, list):
                for sub in value:
                    if isinstance(sub, dict) and sub.get("type") == "text":
                        texts.append(sub.get("text", ""))
                    elif isinstance(sub, dict):
                        texts.append(self.binary_placeholder(sub))
                    else:
                        texts.append(str(sub))
            else:
                texts.append(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False))
        body = "\n\n".join(fence(t) for t in texts)
        role = record.get("renderedRole") or "context"
        self.emit(details(f"Context attachment: <code>{atype}</code> (shown to model as {role}) · "
                          f"{record.get('timestamp', '')}", body))
        self.stats["rendered"]["attachment"] += 1

    def render_other_block(self, block):
        btype = block.get("type", "?")
        if btype in ("image", "document"):
            self.emit(self.binary_placeholder(block))
        else:
            self.stats["unsupported"][f"content block:{btype}"] += 1
            self.emit(details(f"Unsupported content block <code>{btype}</code> (raw JSON)",
                              fence(json.dumps(block, indent=2, ensure_ascii=False), "json")))

    def binary_placeholder(self, block):
        btype = block.get("type", "?")
        source = block.get("source", {}) or {}
        media = source.get("media_type", "unknown")
        size = len(source.get("data", "") or "")
        self.stats["incomplete"][f"binary {btype} ({media}) not embedded"] += 1
        return f"_[{btype}: {media}, {size} base64 chars — binary content not embedded in Markdown]_"

    def add_text_block(self, text, as_code):
        self.emit(fence(text) if as_code else text)
        self.expected_snippets.append(text)


def new_stats():
    return {
        "records": Counter(), "skipped": Counter(), "unsupported": Counter(),
        "incomplete": Counter(), "rendered": Counter(), "duplicates": 0, "problems": [],
    }


def session_info(path, records):
    timestamps = [r["timestamp"] for r in records if r.get("timestamp")]
    titles = [r.get("aiTitle") for r in records if r.get("type") == "ai-title" and r.get("aiTitle")]
    return {
        "start": min(timestamps) if timestamps else "",
        "end": max(timestamps) if timestamps else "",
        "title": titles[-1] if titles else "(untitled)",
    }


def load_subagents(session_dir, stats):
    """Return list of (meta, records, file) for subagent transcripts of a session."""
    sub_dir = session_dir / "subagents"
    found = []
    if not sub_dir.is_dir():
        return found
    for path in sorted(sub_dir.glob("agent-*.jsonl")):
        meta_path = path.with_suffix(".meta.json")
        meta = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                stats["problems"].append(f"{meta_path.name}: invalid JSON metadata")
        found.append((meta, read_jsonl(path, stats), path))
    return found


def export_session(path, number, out_dir):
    stats = new_stats()
    records = read_jsonl(path, stats)
    info = session_info(path, records)
    session_id = path.stem
    subagents = load_subagents(path.parent / session_id, stats)

    anchors = {}
    for meta, _, sub_path in subagents:
        if meta.get("toolUseId"):
            anchors[meta["toolUseId"]] = f"subagent-{sub_path.stem.removeprefix('agent-')}"

    main = SessionRenderer(stats)
    main.render_records(records, anchors)

    lines = [
        f"# Session {number:03d}: {info['title']}",
        "",
        f"- Session ID: `{session_id}`",
        f"- Source: `{path.name}`",
        f"- Started: {info['start']}",
        f"- Last record: {info['end']}",
        f"- Subagent transcripts: {len(subagents)}",
        "",
        "> ⚠️ Exported verbatim and **not redacted**. Review for secrets and personal data before publishing.",
        "",
        "---",
        "",
        "\n\n".join(main.out),
    ]

    expected = list(main.expected_snippets)
    for meta, sub_records, sub_path in subagents:
        anchor = f"subagent-{sub_path.stem.removeprefix('agent-')}"
        sub = SessionRenderer(stats, heading_level=4)
        sub.render_records(sub_records)
        expected.extend(sub.expected_snippets)
        lines += [
            "", "---", "",
            f'<a id="{anchor}"></a>',
            f"## Subagent `{sub_path.stem}`: {meta.get('description', '(no description)')}",
            "",
            f"- Agent type: {meta.get('agentType', '?')} · Model: {meta.get('model', '?')} · "
            f"Spawned by tool call: `{meta.get('toolUseId', '?')}`",
            "",
            "\n\n".join(sub.out),
        ]

    text = "\n".join(lines) + "\n"
    out_path = out_dir / f"session-{number:03d}.md"
    out_path.write_text(text, encoding="utf-8")

    missing = sum(1 for snippet in expected if snippet and snippet not in text)
    if missing:
        stats["problems"].append(f"verification: {missing} source text blocks not found verbatim in output")
    secrets = scan_secrets(text)
    return {"id": session_id, "number": number, "file": out_path.name, "info": info,
            "stats": stats, "subagents": len(subagents), "verified": len(expected) - missing,
            "expected": len(expected), "secrets": secrets}


def scan_secrets(text):
    hits = {}
    for label, pattern in SECRET_PATTERNS.items():
        lines = sorted({text.count("\n", 0, m.start()) + 1 for m in re.finditer(pattern, text)})
        if lines:
            hits[label] = lines
    return hits


def assign_numbers(sessions, manifest_path):
    """Keep existing numbers; append new sessions in chronological order."""
    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    next_number = max(manifest.values(), default=0) + 1
    for path, start in sorted(sessions, key=lambda item: item[1]):
        if path.stem not in manifest:
            manifest[path.stem] = next_number
            next_number += 1
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def write_index(results, out_dir):
    rows = [
        "# Agent conversation logs",
        "",
        "Generated by `scripts/export-agent-logs.py` from the original Claude Code JSONL transcripts",
        "(the JSONL files remain the source of truth).",
        "",
        "> ⚠️ **Manual security review required before submission.** Nothing is redacted automatically.",
        "> The exporter only flags likely secrets/personal data below; check every flagged line.",
        "",
        "| # | Title | Started | Subagents | Verified blocks | Flags for review |",
        "|---|-------|---------|-----------|-----------------|------------------|",
    ]
    for r in results:
        flags = ", ".join(f"{k} ({len(v)})" for k, v in r["secrets"].items()) or "none"
        rows.append(f"| [{r['number']:03d}]({r['file']}) | {r['info']['title']} | {r['info']['start']} | "
                    f"{r['subagents']} | {r['verified']}/{r['expected']} | {flags} |")
    (out_dir / "README.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


def print_report(results):
    totals_problem = False
    for r in results:
        s = r["stats"]
        print(f"\n== session-{r['number']:03d}.md  ({r['id']})  {r['info']['title']}")
        print(f"   records read: {sum(s['records'].values())}  " + ", ".join(f"{k}={v}" for k, v in sorted(s['records'].items())))
        print(f"   rendered: " + ", ".join(f"{k}={v}" for k, v in sorted(s['rendered'].items())))
        print(f"   duplicate records/blocks merged: {s['duplicates']}")
        print(f"   skipped (metadata): " + (", ".join(f"{k}={v}" for k, v in sorted(s['skipped'].items())) or "none"))
        if s["unsupported"]:
            print("   UNSUPPORTED (raw JSON included): " + ", ".join(f"{k}={v}" for k, v in s['unsupported'].items()))
        if s["incomplete"]:
            print("   INCOMPLETE content: " + ", ".join(f"{k}={v}" for k, v in s['incomplete'].items()))
        print(f"   verification: {r['verified']}/{r['expected']} source text blocks found verbatim in output")
        for problem in s["problems"]:
            totals_problem = True
            print(f"   PROBLEM: {problem}")
        for label, lines in r["secrets"].items():
            shown = ", ".join(map(str, lines[:10])) + (" ..." if len(lines) > 10 else "")
            print(f"   REVIEW: possible {label} at lines {shown}")
    print("\nWARNING: exported logs are NOT redacted. Manually review docs/agent-logs/ for secrets and "
          "personal data before submission.")
    print("NOTE: a session that is still running is exported only up to its last written record; re-run later.")
    return 1 if totals_problem else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=default_source_dir(), help="Claude Code project transcript dir")
    parser.add_argument("--out", type=Path, default=PROJECT_ROOT / "docs" / "agent-logs", help="output dir")
    args = parser.parse_args()

    if not args.source.is_dir():
        sys.exit(f"Transcript directory not found: {args.source}")
    args.out.mkdir(parents=True, exist_ok=True)

    sessions = []
    for path in sorted(args.source.glob("*.jsonl")):
        start = session_info(path, read_jsonl(path, new_stats()))["start"]
        sessions.append((path, start))
    if not sessions:
        sys.exit(f"No .jsonl transcripts in {args.source}")

    manifest = assign_numbers(sessions, args.out / "manifest.json")
    stale = [sid for sid in manifest if not (args.source / f"{sid}.jsonl").exists()]

    print(f"Source: {args.source}\nOutput: {args.out}\nSessions found: {len(sessions)}")
    results = [export_session(path, manifest[path.stem], args.out)
               for path, _ in sorted(sessions, key=lambda item: manifest[item[0].stem])]
    write_index(results, args.out)
    for sid in stale:
        print(f"WARNING: manifest lists session {sid} (session-{manifest[sid]:03d}.md) but its JSONL is missing; "
              "previous export left untouched")
    sys.exit(print_report(results))


if __name__ == "__main__":
    main()
