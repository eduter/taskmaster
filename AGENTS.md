# Working notes for agents on this repo

## Context

This file was copied from another repo and not yet adapted.
Everything project-specific below is incorrect and needs to be corrected/removed,
but the code conventions are good.
Same for ./biome.json

## Tech and conventions

- **TypeScript everywhere.** Run directly via Node (>=22.18); type
  stripping is the default for `.ts` files — no flag, no build step,
  no bundler. Node only strips types from files ending in `.ts`, so
  scripts are named accordingly. A thin extensionless `bin/svtcode`
  bash shim is provided so users don't have to type the extension.
- **Type checking.** Node strips types but doesn't check them. Run
  `npm run typecheck` (`tsc --noEmit`) before committing. The root
  `tsconfig.json` covers both `bin/` and `gateway/src/`.
- **Tests.** `npm test` runs typecheck, lint, and both test suites
  (gateway + bin). Lint and format are Biome (`npm run lint`,
  `npm run format`); see "Code style" below.
- **One logical change per commit.** Commits are reviewable and
  bisectable in isolation. Each commit must build, typecheck, and
  pass tests on its own — no "fixup the previous one" commits.
  Unrelated cleanups, refactors, and bug fixes that happen to land
  in the same working tree get split into separate commits, even
  when it'd be faster to mash them together. If you find yourself
  writing a commit message with "and" in it, that's two commits.
  See [`docs/roadmap.md`](./docs/roadmap.md) for what's queued up.
- **Never push.** Agents commit; the human pushes. This rule covers
  every push variant (`git push`, `--force`, `--force-with-lease`,
  pushing to a non-`main` branch, pushing tags) and every remote.
  Inside the svtcode sandbox push happens to be blocked three ways
  (no `ssh` binary, no DNS for internal hosts, gateway denies
  `git.svt.se`), but the rule doesn't rely on that — the protection
  is incidental and could go away if egress is later widened for an
  unrelated reason. The rule also applies when an agent is working
  on this repo outside the sandbox (host-side sessions, future tool
  migrations). If a change needs to ship, leave it as a local
  commit and tell the user in the response.
- **Solve problems in code, not in docs.** A problem detected and
  explained at the moment of failure beats the same problem
  documented in the README. Code hints stay accurate as the code
  changes; README troubleshooting sections rot. Reserve the README
  for things the user genuinely needs *before* the tool runs (how
  to install, prerequisites, where to put secrets). Everything
  else — failure modes, platform quirks, "if you see X try Y" —
  belongs in a runtime check that points at the fix, not in a
  static doc the user has to read first.
- **Roadmap is for open work only.** Don't add completed items or
  `[x]` checkboxes — history is in git. When you finish a roadmap
  item, remove it. If the work reveals follow-up tasks, add those as
  new items. If something is worth documenting permanently, it belongs
  in code comments, architecture docs, or this file — not the roadmap.
- **Scripts:** prefer absolute paths; if you need to run something in a
  specific directory, use the Shell tool's `working_directory` parameter
  rather than `cd`.

## Layout

| Path | Purpose |
|---|---|
| `bin/svtcode` | TS wrapper — brings up the network, gateway, and sandbox; cleans up on exit |
| `images/sandbox/Dockerfile` | Sandbox container image |
| `images/gateway/Dockerfile` | Gateway container image |
| `gateway/` | Host-side gateway source (TS) |
| `skills/trello/` | Generic Trello skill (URL-based fetch + create) |
| `presets/opencode/` | OpenCode config + AGENTS.md mounted into the sandbox |
| `config/` | Example configs (real configs live in `~/.config/svtcode/`, gitignored) |
| `docs/` | Vision, roadmap, architecture deep-dives, non-goals — see [`docs/vision.md`](./docs/vision.md) |

## Trust model

| Entity | Trusted? |
|---|---|
| OpenCode binary | Yes — official build, treated like any installed CLI |
| The LLM (the agent) | **No** — could be jailbroken, prompt-injected, or wrong |
| What the LLM tells OpenCode to do | **No** — same as running arbitrary code |
| Docker container runtime | Yes — standard isolation |

The sandbox boundary = the container + the network policy. Untrusted
things happen inside that boundary; the boundary is mechanical.

## Code style

Formatting and the mechanical lint rules are Biome's job
(`npm run lint`). The rules below are the things Biome can't enforce,
plus the structural conventions a reader should be able to count on.
New code matches existing code; if you want to deviate, change this
list first.

### File layout

Top-down by importance. The headline export comes first; helpers
follow in roughly the order the headline reaches them. Both `function`
and `interface` / `type` declarations hoist, so nothing has to come
first for the compiler — order for the reader, not the parser.

Types aren't a separate category. A type belongs next to the function
that produces it (the one whose return shape it is), not at the top of
the file. Inputs that aren't produced anywhere in the file sit next to
their consumer.

Module-level `const`s sit near the top with the imports.

### Functions, types, exports

- **`function` declarations for module-level functions.** Arrow
  functions are for callbacks and one-expression locals, not the main
  API of a module.
- **`interface` for object shapes; `type` for unions, intersections,
  and aliases.** Reach for `type` when `interface` can't express it,
  not by default.
- **Explicit return types on exported functions.** Inferred is fine
  for short locals.
- **Named exports at the bottom of the file**, never inline. Values in
  `export { ... };`, types in a separate `export type { ... };`. The
  split isn't cosmetic: `verbatimModuleSyntax` requires every
  type-only export to be marked, and a separate statement is the
  least error-prone way to do it.
- **No default exports.** They make rename refactors and grep worse.

### Imports

- **`node:` prefix on built-in imports** (`node:fs`, `node:http`).
  Disambiguates from npm packages.

### Function body shape

The shape of a function body is more load-bearing than its
formatting. Across the codebase:

- **Destructure inputs on the first line.** Include a `...rest`
  capture if the function passes through unknown fields.
- **Guard with early returns, one precondition per branch.** Specific
  error messages per branch beat a combined `if`.
- **Split the work into named sections, separated by blank lines.**
  Each section gets a sentence-case comment with no trailing period
  describing the *intent* of the next few lines. A reader should be
  able to skim the comments and understand what the function does;
  if they can't, the function is doing too much. Skip the header on a
  section that's a single self-explanatory line — see "Comments" below.
- **One `return` on the happy path, at the bottom.** Early returns
  are for failure.

### Comments

The rule for every comment: it answers *why*, not *what*. Restating
what the code already says is noise that ages out of sync with the
code; comments that explain a constraint, a workaround, or a
non-obvious decision stay valuable.

- **Workarounds always get a comment.** A `rmSync` before `mkdirSync`
  looks paranoid until the comment explains pid reuse after a crash.
  An empty `catch` reads as a swallowed bug until the comment says
  "lost the race; the next reap retries". One short line at the line
  in question is enough.
- **Non-obvious constraints belong in JSDoc on the function that owns
  them**, not in a file-header block. Future maintainers grep for the
  function they're editing and read its doc; file headers get treated
  as boilerplate and skipped. If a fact is load-bearing for one
  function ("path must live under $HOME because Colima can't bind-
  mount /var/folders"), put it on that function's JSDoc.
- **No file headers.** No "this file does X" preamble — the exports
  and their JSDoc are the file's API. If you find yourself writing a
  header that summarises the file, the summary belongs on the most
  important export's JSDoc instead.
- **Short, where it matters; nothing, where it doesn't.** A 3-line
  helper whose name says everything gets no comment. A 20-line
  function with a single non-obvious branch gets a one-line comment
  at that branch.

### Errors

- **Throw for programmer errors, return / reject for expected
  failures.** Don't use exceptions for control flow.
- **Errors carry context.** `throw new Error(\`failed to resolve
  secret '${path}': ${cause}\`)`, not `throw new Error('failed')`.
  The agent reads error messages too.

### JSDoc

Required on:

- Every exported function (one-line summary, `@param` / `@returns`
  only when not obvious from the types).
- Every exported type or interface (one-line summary).
- Non-exported functions whose invariants aren't obvious from the
  name and signature.

Inline comments inside a function body are the section headers
described under "Function body shape" — not JSDoc.
