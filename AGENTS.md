# HotZone — Agent Rules

## Project overview (mandatory)

- Keep **`PROJECT_OVERVIEW.md`** at the repo root accurate.
- **After every single change** (code, config, docs, schema, router scripts, env example, package scripts, significant git state), **update `PROJECT_OVERVIEW.md` in the same turn** before finishing the response:
  - Bump **Last updated** date
  - Reflect what actually changed (routes, tables, env vars, commands, current state)
  - Append a one-line row under **Change log (overview)** if the change is user-visible or structural
- Do not claim a change is done without having edited the overview to match reality.
- Prefer a small, surgical overview edit over rewriting the whole file.

## Verify before “done”

From `webapp/`:

```bash
npx tsc --noEmit
npm run lint
```

## Git

- Conventional Commits: `type(scope): summary` — `feat` `fix` `docs` `chore` `refactor` `test`
- Do not commit or push unless the user explicitly asks

## Secrets

- Never commit `.env`, keys, or passwords; only `.env.example` placeholders
