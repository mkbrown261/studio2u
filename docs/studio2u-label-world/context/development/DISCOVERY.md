# Instruction discovery — 2026-10-13
Codex CLI 0.160.1 is installed. Its local `codex debug prompt-input` included the actual root entry text and router pointer; no model request was made. Prompt dump remains outside Git because it includes environment instructions. Initial restricted invocation failed with OS permission error; permitted local diagnostic succeeded.

Codex convention: https://learn.chatgpt.com/docs/agent-configuration/agents-md . Root AGENTS.md is automatically discovered from repository root to working directory.
Claude convention: https://code.claude.com/docs/en/memory . CLAUDE.md imports @AGENTS.md so rules are shared. Claude Code binary is not installed here; actual Claude loading is NOT_TESTED. Other tools can start with: “Read AGENTS.md, follow the context router, then perform read-only pickup.” No tool discovery beyond Codex is claimed.
