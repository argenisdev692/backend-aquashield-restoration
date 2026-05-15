# AGENTS.md

> Shared file between AI assistants (Claude Code, Cursor, Codex, Windsurf). These rules apply to any agent working on this repository.

## Principles

1. **Understand before changing.** Read existing code before proposing modifications.
2. **Minimal changes.** Do not refactor code unrelated to the task.
3. **Do not invent APIs.** If a function/package does not exist, state it explicitly.
4. **Do not break tests.** Run the relevant suite before marking a task as complete.
5. **Ask if there is ambiguity.** Better a question than an incorrect assumption.

## Response Format

- English by default for code comments and commit messages.
- English for identifiers (variable names, function names, class names).
- Commits follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.

## Git

- Feature branch: `feat/<module>-<short-description>`
- Fix branch: `fix/<issue-id>-<description>`
- DO NOT amend published commits.
- DO NOT use `--no-verify` unless explicitly requested.

## Security

- Validate ALL external input (body, query, params, headers).
- Sanitize output when applicable (XSS, injection).
- Never log secrets, tokens, passwords, or PII.
- Secrets only via environment variables or secret manager.
