#!/usr/bin/env python3
"""Export Claude Code JSONL transcripts for this project to Markdown.

Reads   ~/.claude/projects/<encoded-project-path>/*.jsonl  (read-only)
        ~/.claude/projects/<encoded-project-path>/<session>/subagents/agent-*.jsonl
Writes  docs/agent-logs/readable/session-NNN.md  user prompts + Claude's visible replies
        docs/agent-logs/full/session-NNN.md      everything: tools, results, context, subagents
        docs/agent-logs/README.md                index of all sessions
        docs/agent-logs/manifest.json            keeps session numbering stable across runs

Usage:  python3 scripts/export-agent-logs.py [--source DIR] [--out DIR]

Standard library only. The JSONL originals are never modified. Both Markdown views
are verified against the originals, then sanitized: high-confidence secrets and
personal email addresses are replaced with [REDACTED:<kind>] and counted in the
report. Lower-confidence matches are flagged for manual review, not changed.
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

SUBAGENT_TOOLS = {"Agent", "Task"}
QUESTION_TOOL = "AskUserQuestion"
INTERRUPT_PREFIX = "[Request interrupted by user"


# ---------------------------------------------------------------------------
# Sanitization
# ---------------------------------------------------------------------------

# Email domains that are fixtures, tooling or public addresses, not personal data.
EMAIL_ALLOWED_DOMAIN = re.compile(
    r"(?i)^(anthropic\.com|laravel\.com|x\.com|b\.com|case\.com|host\.docker\.internal"
    r"|example\.[a-z]+|.*\.(test|invalid|local|example|md))$"
)
LOCAL_DB_HOSTS = re.compile(r"(?i)^(127\.0\.0\.1|localhost|host\.docker\.internal|[a-z0-9-]+-db|.*\.invalid)$")
EMAIL_PATTERN = r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"
DB_URL_PATTERN = r"\b((?:postgres(?:ql)?|pgsql|mysql|mongodb(?:\+srv)?)://)([^\s:/@'\"`]+):([^\s@/'\"`]+)@([^\s/:'\"`?]+)"

# Replaced in every export. Replacement strings must not match any pattern here.
REDACTIONS = {
    "private-key": r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----",
    "anthropic-key": r"sk-ant-[A-Za-z0-9_\-]{20,}",
    "openai-key": r"\bsk-[A-Za-z0-9]{32,}",
    "github-token": r"\bgh[pousr]_[A-Za-z0-9]{30,}",
    "aws-access-key": r"\bAKIA[0-9A-Z]{16}\b",
    "jwt": r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}",
    "sanctum-token": r"\b\d+\|[A-Za-z0-9]{40,}",  # Sanctum 4: id|40 random + optional 8-hex checksum
    "neon-password": r"\bnpg_[A-Za-z0-9]{8,}",
    "vercel-token": r"\bvc[kp]_[A-Za-z0-9]{20,}",
    "laravel-app-key": r"base64:[A-Za-z0-9+/]{40,}={0,2}",
    "password-hash": r"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}",
    # Vercel's default team slug is "<account>-<digits>s-projects": a personal identifier.
    "vercel-preview-url": r"\b[a-z0-9-]+-\d{3,}s-projects\.vercel\.app",
    "vercel-account": r"\b[a-z0-9]+-\d{3,}s-projects\b",
    "vercel-team-id": r"\bteam_[A-Za-z0-9]{20,}\b",
}

# Exact values to redact that no pattern can recognize (smoke-test passwords, account handles).
# Kept in a private, gitignored file so the values are never committed with this script.
# Format: one "kind<TAB>literal" per line; lines starting with # are comments.
DEFAULT_TERMS_FILE = PROJECT_ROOT / ".agent-logs-redact.tsv"
PRIVATE_TERMS = []  # filled by load_private_terms()

# Flagged for a human to look at; too noisy (mostly code) to change automatically.
REVIEW_PATTERNS = {
    "secret-like assignment": r"(?i)\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['\"]?[^\s'\"]{8,}",
}


def load_private_terms(path):
    if not path.exists():
        sys.exit(f"Private redaction terms file not found: {path}\n"
                 "Without it, known credentials would be exported unredacted. "
                 "Create it, or pass --terms /dev/null to export without private terms.")
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        kind, _, literal = line.partition("\t")
        if not literal:
            sys.exit(f"{path}: expected 'kind<TAB>literal', got: {line[:20]}...")
        PRIVATE_TERMS.append((kind.strip(), literal))
    PRIVATE_TERMS.sort(key=lambda term: -len(term[1]))  # longest first, so no partial overlap


def home_path_patterns():
    """The exporting user's home directory, plain (/Users/name) and dash-encoded (-Users-name-)."""
    home = Path.home()
    plain = re.escape(str(home))
    encoded = re.escape(re.sub(r"[^A-Za-z0-9]", "-", str(home)))
    placeholder = str(home.parent / "[REDACTED:user]")
    return [
        (rf"{plain}(?![A-Za-z0-9_-])", placeholder),
        (rf"{encoded}-", re.sub(r"[^A-Za-z0-9\[\]:]", "-", placeholder) + "-"),
        # The bare login name, e.g. the owner column of `ls -l` or `lsof` output. Case-sensitive,
        # so a capitalised personal name in author lines is left alone.
        (rf"(?<![A-Za-z0-9_]){re.escape(home.name)}(?![A-Za-z0-9_])", "[REDACTED:user]"),
    ]


def redact_email(match, counts):
    domain = match.group(0).rsplit("@", 1)[1]
    if EMAIL_ALLOWED_DOMAIN.match(domain) or match.group(0).lower() == "noreply@anthropic.com":
        return match.group(0)
    counts["email"] += 1
    return "[REDACTED:email]"


def redact_db_url(match, counts):
    scheme, user, password, host = match.groups()
    if LOCAL_DB_HOSTS.match(host) or password.startswith("$"):
        return match.group(0)
    counts["db-credentials"] += 1
    return f"{scheme}[REDACTED:db-credentials]@{host}"


def sanitize(text):
    """Return (sanitized_text, Counter of redactions by kind)."""
    counts = Counter()
    for kind, pattern in REDACTIONS.items():
        text, n = re.subn(pattern, f"[REDACTED:{kind}]", text)
        counts[kind] += n
    text = re.sub(DB_URL_PATTERN, lambda m: redact_db_url(m, counts), text)
    # Emails first: the rules below match parts of addresses and would leave the rest exposed.
    text = re.sub(EMAIL_PATTERN, lambda m: redact_email(m, counts), text)
    for pattern, placeholder in home_path_patterns():
        text, n = re.subn(pattern, placeholder.replace("\\", "\\\\"), text)
        counts["home-path"] += n
    for kind, literal in PRIVATE_TERMS:
        counts[kind] += text.count(literal)
        text = text.replace(literal, f"[REDACTED:{kind}]")
    return text, +counts


def leftover_secrets(text):
    """Kinds of redaction patterns that still match after sanitizing (should be none)."""
    left = [kind for kind, pattern in REDACTIONS.items() if re.search(pattern, text)]
    if any(not EMAIL_ALLOWED_DOMAIN.match(m.rsplit("@", 1)[1]) and m.lower() != "noreply@anthropic.com"
           for m in re.findall(EMAIL_PATTERN, text)):
        left.append("email")
    left += sorted({kind for kind, literal in PRIVATE_TERMS if literal in text})
    if any(re.search(pattern, text) for pattern, _ in home_path_patterns()):
        left.append("home-path")
    return left


def review_flags(text):
    hits = {}
    for label, pattern in REVIEW_PATTERNS.items():
        lines = sorted({text.count("\n", 0, m.start()) + 1 for m in re.finditer(pattern, text)})
        if lines:
            hits[label] = lines
    return hits


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

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


def short_time(timestamp):
    """2026-11-11T15:04:26.294Z -> 2026-11-11 15:04 UTC"""
    match = re.match(r"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})", timestamp or "")
    return f"{match.group(1)} {match.group(2)} UTC" if match else (timestamp or "")


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


def unique_records(records):
    """Drop repeated records (same uuid), keeping the first. Both views use this."""
    seen, result = set(), []
    for record in records:
        uuid = record.get("uuid")
        if uuid and uuid in seen:
            continue
        if uuid:
            seen.add(uuid)
        result.append(record)
    return result


def content_blocks(record):
    content = (record.get("message") or {}).get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return content or []


def classify_user(record):
    """Decide what a `user` record is. Only 'prompt', 'command' and 'local_command' are the human.

    prompt         text the developer typed or pasted (origin human, or untagged plain text)
    command        a slash command the developer typed, e.g. /develop <args>
    local_command  a client-only command (/clear, /context); Claude never sees or answers it
    interrupt      the developer pressed Esc during a response
    automated      task notifications and subagent hand-backs that wake Claude up
    compaction     the summary written when context was compacted
    injected       skill bodies, caveats, image notes and other harness context
    tool_result    a record that only returns tool output
    """
    if record.get("isCompactSummary"):
        return "compaction"
    origin = (record.get("origin") or {}).get("kind")
    if record.get("isMeta"):
        return "automated" if origin not in (None, "human") else "injected"
    blocks = content_blocks(record)
    texts = [b.get("text", "") for b in blocks if b.get("type") == "text"]
    if not texts and not any(b.get("type") in ("image", "document") for b in blocks):
        return "tool_result"
    if origin not in (None, "human"):
        return "automated"
    joined = "\n".join(texts).lstrip()
    if joined.startswith(INTERRUPT_PREFIX):
        return "interrupt"
    if re.match(r"<command-(name|message)>", joined):
        return "command" if origin == "human" else "local_command"
    if re.match(r"<(local-command-stdout|local-command-caveat)>", joined):
        return "injected"
    return "prompt"


def strip_injected(text, stats):
    """Remove editor/harness wrappers from a prompt; everything the developer wrote is kept."""
    text, ide = re.subn(r"<ide_([a-z_]+)>.*?</ide_\1>", "", text, flags=re.S)
    stats["readable"]["IDE context blocks omitted"] += ide
    text = re.sub(r'<pasted_content id="[^"]*">\n?', "", text)
    text = re.sub(r'\n?</pasted_content id="[^"]*">', "", text)
    return text.strip()


def parse_command(text):
    name = re.search(r"<command-name>(.*?)</command-name>", text, re.S)
    args = re.search(r"<command-args>(.*?)</command-args>", text, re.S)
    return (name.group(1).strip() if name else "?"), (args.group(1) if args else "")


def markdown_or_fence(text):
    """Render as Markdown unless that would hide or break text (raw tags, unbalanced fences)."""
    outside_code = re.sub(r"(?ms)^\s*(`{3,}|~{3,}).*?^\s*\1[`~]*\s*$", "", text)
    outside_code = re.sub(r"`+[^`\n]*`+", "", outside_code)
    unbalanced = len(re.findall(r"(?m)^\s*(```|~~~)", text)) % 2 == 1
    if unbalanced or re.search(r"<[A-Za-z/!][^>\n]*>", outside_code):
        return fence(text)
    return text


def quote(text):
    return "\n".join(f"> {line}" if line else ">" for line in text.split("\n"))


# ---------------------------------------------------------------------------
# Full technical transcript
# ---------------------------------------------------------------------------

class FullRenderer:
    """Turns one JSONL file into detailed Markdown lines, tracking what it rendered."""

    def __init__(self, stats, heading_level=3):
        self.stats = stats
        self.h = "#" * heading_level
        self.out = []
        self.expected_snippets = []  # text that must appear in the output (verification)
        self.seen_blocks = set()
        self.current_speaker = None
        self.prompt_number = 0

    def emit(self, text):
        self.out.append(text)

    def speaker(self, key, title, timestamp):
        if self.current_speaker != key:
            self.emit(f"{self.h} {title}" + (f" · {timestamp}" if timestamp else ""))
            self.current_speaker = key

    def render_records(self, records, subagent_anchors=None, anchor_prompts=False):
        subagent_anchors = subagent_anchors or {}
        for record in records:
            rtype = record.get("type", "<missing>")
            self.stats["records"][rtype] += 1
            if rtype in METADATA_TYPES:
                self.stats["skipped"][rtype] += 1
            elif rtype == "user":
                if anchor_prompts and classify_user(record) in ("prompt", "command"):
                    self.prompt_number += 1
                    self.current_speaker = None
                    self.emit(f'<a id="prompt-{self.prompt_number}"></a>')
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
        if record.get("isAbortedMidStream"):
            self.emit("_[Response aborted mid-stream: the text above is all that was recorded]_")
            self.stats["incomplete"]["response aborted mid-stream"] += 1

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
                elif item.get("type") == "tool_reference":
                    parts.append(f"_[tool reference: `{item.get('tool_name', '?')}`]_")
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


# ---------------------------------------------------------------------------
# Readable conversation view
# ---------------------------------------------------------------------------

class ReadableRenderer:
    """USER prompts and CLAUDE's visible replies, in order. Tool work appears only as short markers."""

    def __init__(self, stats, full_link):
        self.stats = stats
        self.full_link = full_link
        self.out = []
        self.expected_snippets = []
        self.seen_blocks = set()
        self.tools = {}          # tool_use_id -> name
        self.questions = {}      # AskUserQuestion tool_use_id -> questions, shown once answered
        self.pending_tools = []  # tool names called since the last thing shown
        self.prompt_number = 0
        self.claude_open = False  # a CLAUDE heading is open for the current exchange
        self.claude_headed = set()  # exchange numbers that already have a CLAUDE heading

    def emit(self, text):
        self.out.append(text)

    def render_records(self, records):
        for record in records:
            rtype = record.get("type")
            if rtype == "assistant":
                self.render_assistant(record)
            elif rtype == "user":
                self.render_user(record)

    # -- markers -------------------------------------------------------------

    def flush_tools(self):
        if not self.pending_tools:
            return
        counts = Counter(self.pending_tools)
        names = ", ".join(f"{name} ×{n}" if n > 1 else name for name, n in counts.items())
        total = len(self.pending_tools)
        subagents = sum(counts[name] for name in SUBAGENT_TOOLS)
        extra = f" · {subagents} subagent{'s' if subagents > 1 else ''}" if subagents else ""
        self.emit(f"*[{total} tool call{'s' if total > 1 else ''}: {names}{extra}]*")
        self.stats["readable"]["tool calls summarized"] += total
        self.pending_tools = []

    def open_claude(self):
        if not self.claude_open:
            number = f" · {self.prompt_number}" if self.prompt_number else ""
            continued = " (continued)" if self.prompt_number in self.claude_headed else ""
            self.emit(f"## CLAUDE{number}{continued}")
            self.claude_headed.add(self.prompt_number)
            self.claude_open = True

    def marker(self, text):
        self.flush_tools()
        self.emit(f"_{text}_")

    # -- assistant -----------------------------------------------------------

    def render_assistant(self, record):
        message = record.get("message", {})
        msg_id = message.get("id") or record.get("uuid")
        for block in message.get("content") or []:
            block_key = (msg_id, json.dumps(block, sort_keys=True))
            if block_key in self.seen_blocks:
                continue
            self.seen_blocks.add(block_key)
            btype = block.get("type")
            if btype == "text":
                self.open_claude()
                self.flush_tools()
                text = block.get("text", "")
                if message.get("model") == "<synthetic>":
                    self.emit("_[Message generated by the Claude Code client, not by the model:]_")
                self.emit(markdown_or_fence(text))
                self.expected_snippets.append(text)
                self.stats["readable"]["Claude text blocks"] += 1
            elif btype == "tool_use":
                self.tools[block.get("id", "")] = block.get("name", "?")
                if block.get("name") == QUESTION_TOOL:
                    self.questions[block.get("id", "")] = block.get("input", {}).get("questions", [])
                else:
                    self.pending_tools.append(block.get("name", "?"))
            elif btype in ("thinking", "redacted_thinking"):
                self.stats["readable"]["thinking blocks omitted"] += 1
        if record.get("isAbortedMidStream"):
            self.open_claude()
            self.marker("[Response aborted mid-stream: the reply above is all that was recorded]")

    def render_question(self, question):
        header = question.get("header", "")
        kind = "select any" if question.get("multiSelect") else "select one"
        self.emit(f"**Claude asked{' — ' + header if header else ''}** ({kind}):")
        lines = [question.get("question", "")]
        for option in question.get("options", []):
            desc = option.get("description", "")
            lines.append(f"- **{option.get('label', '')}**" + (f" — {desc}" if desc else ""))
        self.emit(quote("\n".join(lines)))
        self.stats["readable"]["questions asked"] += 1

    def flush_unanswered_questions(self):
        for questions in self.questions.values():
            self.open_claude()
            self.flush_tools()
            for question in questions:
                self.render_question(question)
                self.emit("_(No answer recorded in the transcript.)_")
                self.stats["incomplete"]["questions without a recorded answer"] += 1
        self.questions = {}

    # -- user ----------------------------------------------------------------

    def render_user(self, record):
        kind = classify_user(record)
        self.stats["readable"][f"user records: {kind}"] += 1
        for block in content_blocks(record):
            if block.get("type") == "tool_result":
                self.render_tool_result(block, record)

        if kind in ("prompt", "command"):
            self.render_prompt(record, kind)
        elif kind == "local_command":
            text = "\n".join(b.get("text", "") for b in content_blocks(record) if b.get("type") == "text")
            name, args = parse_command(text)
            self.close_exchange()
            self.emit(f"_The developer ran the local command `{(name + ' ' + args).strip()}` "
                      f"(handled by the client; Claude does not see or answer it)._")
        elif kind == "interrupt":
            self.open_claude()
            self.marker("⏹ Interrupted by the developer.")
            self.stats["incomplete"]["responses interrupted by the developer"] += 1
        elif kind == "automated":
            origin = (record.get("origin") or {}).get("kind") or "event"
            self.close_exchange()
            self.emit(f"_⚙ Automated `{origin}` message (not written by the developer; "
                      f"content is in the full transcript)._")
        elif kind == "compaction":
            self.close_exchange()
            self.emit("_🗜 Context was compacted here. The generated summary is in the full transcript._")

    def render_tool_result(self, block, record):
        text = block.get("content")
        text = text if isinstance(text, str) else "\n".join(
            item.get("text", "") for item in text or [] if isinstance(item, dict))
        if self.tools.get(block.get("tool_use_id")) == QUESTION_TOOL:
            self.render_answer(block, record, text)
        elif INTERRUPT_PREFIX in text:
            self.open_claude()
            self.marker("⏹ Interrupted by the developer during a tool call.")
            self.stats["incomplete"]["responses interrupted by the developer"] += 1

    def render_answer(self, block, record, raw_text):
        self.open_claude()
        self.flush_tools()
        questions = self.questions.pop(block.get("tool_use_id"), [])
        result = record.get("toolUseResult")
        if block.get("is_error") or not isinstance(result, dict) or "answers" not in result:
            for question in questions:
                self.render_question(question)
            self.emit("**USER's response** (the question was not answered normally):")
            self.emit(fence(raw_text))
            self.expected_snippets.append(raw_text)
            return
        answers = dict(result["answers"])
        for question in questions:
            self.render_question(question)
            answer = answers.pop(question.get("question", ""), None)
            if answer is None:
                self.emit("_(No answer recorded for this question.)_")
                self.stats["incomplete"]["questions without a recorded answer"] += 1
                continue
            self.emit_answer(answer)
        for question, answer in answers.items():  # answers whose question text was not matched
            self.emit(f"**USER answered** “{question}”:")
            self.emit_answer(answer, labelled=False)
        for question, note in (result.get("annotations") or {}).items():
            if isinstance(note, dict) and note.get("notes"):
                self.emit(f"**USER's note** on “{question}”:")
                self.emit(markdown_or_fence(note["notes"]))
                self.expected_snippets.append(note["notes"])

    def emit_answer(self, answer, labelled=True):
        answer = answer if isinstance(answer, str) else json.dumps(answer, ensure_ascii=False)
        if labelled:
            self.emit("**USER answered:**")
        self.emit(markdown_or_fence(answer))
        self.expected_snippets.append(answer)
        self.stats["readable"]["answers"] += 1

    def render_prompt(self, record, kind):
        self.close_exchange()
        self.prompt_number += 1
        blocks = content_blocks(record)
        raw = "\n\n".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        if kind == "command":
            name, args = parse_command(raw)
            args = strip_injected(args, self.stats)
            body = f"`{name}`" + (f"\n\n{markdown_or_fence(args)}" if args else "")
            self.expected_snippets.append(args)
        else:
            text = strip_injected(raw, self.stats)
            body = markdown_or_fence(text)
            self.expected_snippets.append(text)
        for block in blocks:
            if block.get("type") in ("image", "document"):
                media = (block.get("source") or {}).get("media_type", "unknown")
                body += f"\n\n_[{block['type']} attached ({media}): not embedded, see the full transcript]_"
                self.stats["incomplete"][f"{block['type']} in prompt not embedded"] += 1

        if self.out:
            self.emit("---")
        self.emit(f"## USER · {self.prompt_number}")
        self.emit(f"<sub>{short_time(record.get('timestamp'))} · "
                  f"[open in full transcript]({self.full_link}#prompt-{self.prompt_number}) · "
                  f"record `{record.get('uuid', '?')}`</sub>")
        self.emit(body)
        self.stats["readable"]["prompts"] += 1

    def close_exchange(self):
        self.flush_unanswered_questions()
        self.flush_tools()
        self.claude_open = False

    def finish(self):
        self.close_exchange()


# ---------------------------------------------------------------------------
# Session export
# ---------------------------------------------------------------------------

def new_stats():
    return {
        "records": Counter(), "skipped": Counter(), "unsupported": Counter(), "incomplete": Counter(),
        "rendered": Counter(), "readable": Counter(), "duplicates": 0, "problems": [],
    }


def session_info(records):
    timestamps = [r["timestamp"] for r in records if r.get("timestamp")]
    titles = [r.get("aiTitle") for r in records if r.get("type") == "ai-title" and r.get("aiTitle")]
    return {
        "start": min(timestamps) if timestamps else "",
        "end": max(timestamps) if timestamps else "",
        "title": titles[-1] if titles else None,
    }


def fallback_title(readable_lines):
    """Untitled sessions are labelled with the start of their first prompt (clearly marked)."""
    for i, line in enumerate(readable_lines):
        if line.startswith("## USER") and i + 2 < len(readable_lines):
            first = next((ln for ln in readable_lines[i + 2].splitlines() if ln.strip() and not ln.startswith("```")), "")
            first = re.sub(r"[`*_#>|\[\]]", "", first).strip()
            return f"(untitled) “{first[:70]}{'…' if len(first) > 70 else ''}”"
    return "(untitled, no prompts)"


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
        found.append((meta, unique_records(read_jsonl(path, stats)), path))
    return found


def count_source_text_blocks(records):
    """Distinct assistant text blocks in the source, for an exact count check of the readable view."""
    seen = set()
    for record in records:
        if record.get("type") != "assistant":
            continue
        msg_id = (record.get("message") or {}).get("id") or record.get("uuid")
        for block in (record.get("message") or {}).get("content") or []:
            if block.get("type") == "text":
                seen.add((msg_id, json.dumps(block, sort_keys=True)))
    return len(seen)


def verify(text, snippets, stats, view):
    missing = sum(1 for snippet in snippets if snippet and snippet not in text)
    if missing:
        stats["problems"].append(f"{view} view: {missing} source text blocks not found verbatim")
    return len(snippets) - missing, len(snippets)


def write_view(path, text, stats, view):
    sanitized, redactions = sanitize(text)
    left = leftover_secrets(sanitized)
    if left:
        stats["problems"].append(f"{view} view: secret patterns still present after sanitizing: {left}")
    path.write_text(sanitized, encoding="utf-8")
    return redactions, review_flags(sanitized)


def export_session(path, number, out_dir):
    stats = new_stats()
    raw_records = read_jsonl(path, stats)
    records = unique_records(raw_records)
    stats["duplicates"] += len(raw_records) - len(records)
    info = session_info(records)
    session_id = path.stem
    subagents = load_subagents(path.parent / session_id, stats)
    name = f"session-{number:03d}.md"

    readable = ReadableRenderer(stats, f"../full/{name}")
    readable.render_records(records)
    readable.finish()
    title = info["title"] or fallback_title(readable.out)

    anchors = {}
    for meta, _, sub_path in subagents:
        if meta.get("toolUseId"):
            anchors[meta["toolUseId"]] = f"subagent-{sub_path.stem.removeprefix('agent-')}"

    full = FullRenderer(stats)
    full.render_records(records, anchors, anchor_prompts=True)

    if full.prompt_number != readable.prompt_number:
        stats["problems"].append(f"prompt count mismatch: full {full.prompt_number}, readable {readable.prompt_number}")
    source_texts = count_source_text_blocks(records)
    if stats["readable"]["Claude text blocks"] != source_texts:
        stats["problems"].append(f"readable view shows {stats['readable']['Claude text blocks']} of "
                                 f"{source_texts} Claude text blocks")

    meta_lines = [
        f"- Session ID: `{session_id}`",
        f"- Source: `{path.name}` (original JSONL, kept private and unmodified)",
        f"- Date: {short_time(info['start'])} → {short_time(info['end'])}",
    ]

    readable_text = "\n".join([
        f"# Session {number:03d}: {title}", "", *meta_lines,
        f"- Prompts: {readable.prompt_number}",
        f"- Full technical transcript: [full/{name}](../full/{name})",
        "",
        "> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.",
        "> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short",
        "> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.",
        "",
        "---",
        "",
        "\n\n".join(readable.out) if readable.out else "_No prompts or replies in this session._",
    ]) + "\n"

    full_lines = [
        f"# Session {number:03d}: {title}", "", *meta_lines,
        f"- Subagent transcripts: {len(subagents)}",
        f"- Readable conversation: [readable/{name}](../readable/{name})",
        "",
        "> Complete technical transcript: messages, tool calls, tool results, thinking, injected context and",
        "> subagents. Sensitive values are shown as `[REDACTED:kind]`.",
        "",
        "---",
        "",
        "\n\n".join(full.out),
    ]
    expected_full = list(full.expected_snippets)
    for meta, sub_records, sub_path in subagents:
        anchor = f"subagent-{sub_path.stem.removeprefix('agent-')}"
        sub = FullRenderer(stats, heading_level=4)
        sub.render_records(sub_records)
        expected_full.extend(sub.expected_snippets)
        full_lines += [
            "", "---", "",
            f'<a id="{anchor}"></a>',
            f"## Subagent `{sub_path.stem}`: {meta.get('description', '(no description)')}",
            "",
            f"- Agent type: {meta.get('agentType', '?')} · Model: {meta.get('model', '?')} · "
            f"Spawned by tool call: `{meta.get('toolUseId', '?')}` · Source: `{sub_path.name}`",
            "",
            "\n\n".join(sub.out),
        ]
    full_text = "\n".join(full_lines) + "\n"

    verified = {
        "readable": verify(readable_text, readable.expected_snippets, stats, "readable"),
        "full": verify(full_text, expected_full, stats, "full"),
    }
    redactions, flags = Counter(), {}
    for view, text in (("readable", readable_text), ("full", full_text)):
        counts, view_flags = write_view(out_dir / view / name, text, stats, view)
        redactions.update(counts)
        flags.update({f"{view}: {k}": v for k, v in view_flags.items()})

    return {"id": session_id, "number": number, "file": name, "info": info, "title": title,
            "stats": stats, "subagents": len(subagents), "prompts": readable.prompt_number,
            "verified": verified, "redactions": redactions, "flags": flags}


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
    total_redactions = sum((r["redactions"] for r in results), Counter())
    redaction_summary = ", ".join(f"{k} ×{v}" for k, v in sorted(total_redactions.items())) or "none"
    rows = [
        "# Agent conversation logs",
        "",
        f"{len(results)} Claude Code sessions, numbered in chronological order of their first record.",
        "Each session has two views, generated by `scripts/export-agent-logs.py` from the original JSONL",
        "transcripts (the source of truth, kept private and unmodified):",
        "",
        "- **Readable**: every prompt the developer wrote and every visible reply from Claude, verbatim.",
        "  Questions Claude asked and the developer's answers are included. Tool work appears as short markers.",
        "- **Full**: the complete technical transcript, with tool calls, tool results, thinking blocks,",
        "  injected context and subagent transcripts.",
        "",
        f"Sanitized before publication: {redaction_summary}. Redacted values read `[REDACTED:kind]`.",
        "",
        "| # | Title | Date (UTC) | Prompts | Readable | Full |",
        "|---|-------|------------|---------|----------|------|",
    ]
    for r in results:
        title = r["title"].replace("|", "\\|")
        sanitized_title, _ = sanitize(title)
        rows.append(f"| {r['number']:03d} | {sanitized_title} | {short_time(r['info']['start'])} | {r['prompts']} | "
                    f"[conversation](readable/{r['file']}) | [technical](full/{r['file']}) |")
    text, _ = sanitize("\n".join(rows) + "\n")
    (out_dir / "README.md").write_text(text, encoding="utf-8")


def print_report(results, out_dir):
    has_problem = False
    for r in results:
        s = r["stats"]
        print(f"\n== session-{r['number']:03d}.md  ({r['id']})  {r['title']}")
        print(f"   records read: {sum(s['records'].values())}  "
              + ", ".join(f"{k}={v}" for k, v in sorted(s['records'].items())))
        print("   readable: " + ", ".join(f"{k}={v}" for k, v in sorted(s['readable'].items())))
        print("   full rendered: " + ", ".join(f"{k}={v}" for k, v in sorted(s['rendered'].items())))
        print(f"   duplicate records/blocks merged: {s['duplicates']}")
        print("   skipped (metadata): " + (", ".join(f"{k}={v}" for k, v in sorted(s['skipped'].items())) or "none"))
        if s["unsupported"]:
            print("   UNSUPPORTED (raw JSON included in full view): "
                  + ", ".join(f"{k}={v}" for k, v in s['unsupported'].items()))
        if s["incomplete"]:
            print("   NOT FULLY RECONSTRUCTABLE: " + ", ".join(f"{k}={v}" for k, v in s['incomplete'].items()))
        for view, (ok, total) in r["verified"].items():
            print(f"   verified {view}: {ok}/{total} source text blocks found verbatim (before sanitizing)")
        if r["redactions"]:
            print("   redacted: " + ", ".join(f"{k}={v}" for k, v in sorted(r['redactions'].items())))
        for problem in s["problems"]:
            has_problem = True
            print(f"   PROBLEM: {problem}")
        for label, lines in r["flags"].items():
            shown = ", ".join(map(str, lines[:10])) + (" ..." if len(lines) > 10 else "")
            print(f"   REVIEW: {label} at lines {shown}")
    legacy = sorted(out_dir.glob("session-*.md"))
    if legacy:
        print(f"\nNOTE: {len(legacy)} flat session-NNN.md files from the previous exporter are still in {out_dir}; "
              "they are superseded by full/ and are NOT sanitized.")
    print("\nSanitized: high-confidence secrets and personal emails. Still review REVIEW lines before publishing.")
    print("NOTE: a session that is still running is exported only up to its last written record; re-run later.")
    return 1 if has_problem else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=default_source_dir(), help="Claude Code project transcript dir")
    parser.add_argument("--out", type=Path, default=PROJECT_ROOT / "docs" / "agent-logs", help="output dir")
    parser.add_argument("--terms", type=Path, default=DEFAULT_TERMS_FILE, help="private redaction terms (TSV)")
    args = parser.parse_args()
    load_private_terms(args.terms)

    if not args.source.is_dir():
        sys.exit(f"Transcript directory not found: {args.source}")
    for view in ("readable", "full"):
        (args.out / view).mkdir(parents=True, exist_ok=True)

    sessions = []
    for path in sorted(args.source.glob("*.jsonl")):
        start = session_info(read_jsonl(path, new_stats()))["start"]
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
    sys.exit(print_report(results, args.out))


if __name__ == "__main__":
    main()
