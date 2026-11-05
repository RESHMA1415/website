---
name: project-hub
description: Updates the SHOPME Project Hub artifact (overview, status board by phase, screens, decisions, Git state) from the committed work on the development branch. It first commits any finished, uncommitted work on development, then refreshes the board, republishes the artifact at its fixed URL, and commits the hub files. Use it whenever the owner asks for progress, status, the project board or the hub, and run it on your own after finishing a task, fix, feature or phase that you committed to development.
when_to_use: Run automatically, without being asked, after every task that ends with a commit on development (feature, fix, owner request, phase checkpoint or phase completion). Also run it when the owner says "update the hub/board/artifact", "project status" or "what's the progress".
argument-hint: "[optional note about what just changed]"
---

# Project Hub update

The Project Hub is the owner's single view of SHOPME: business overview, a card board (Planned → Not started → In development → Ready for test → Completed) filterable by phase, every screen, the decisions waiting for the owner, and the Git state of `development` vs `production`.

- **Data you edit:** `tools/project-hub/hub-data.json` (cards, screens, decisions, phases, artifact URL)
- **Page design:** `tools/project-hub/template.html` (don't change it for a status update)
- **Builder:** `npm run hub` (or `node tools/project-hub/build.mjs`) adds live Git state and the ✅/⏭ phase lines from `CLAUDE.md`, then writes `tools/project-hub/project-hub.html`
- **Published at:** the `artifactUrl` in `hub-data.json` (https://claude.ai/artifact/J8KvrshBbuSUQTPeudf5vY). Always update that same artifact, never create a new one.

Git on this machine: `C:\Program Files\Git\cmd\git.exe` (it may not be on PATH in PowerShell). Follow the Git rules in `CLAUDE.md` at every step.

## Steps

### 1. Check where you are
- `git status --short --branch`. You must be on **development**.
- If you are on `production` or any other branch, **stop**: don't commit anything. Tell the owner, and switch back with `git switch development` only if the working tree is clean.

### 2. Commit the work done up to this point (on development only)
The hub follows **committed** work. Anything finished but unsaved is committed first, so the board matches what is saved:
- `git status --porcelain` and `git diff --stat`. If nothing changed, go to step 3.
- Review what will be committed. **Never** commit `.env` files, secrets, `node_modules`, build output (`dist/`) or scratch/test files from outside the project. `.gitignore` handles most of this; check anyway.
- If an app's source changed, run its build once (`npm run build --prefix frontend|admin`). If it fails, fix it first, or ask the owner whether to commit the work in progress anyway. Never commit broken work silently.
- Commit everything else with one clear message describing the change in plain terms, ending with the attribution line required by the session. **Never use `--no-verify`**: the hooks protect production.

### 3. Read the current state
- `git log --oneline -30 development` and `git log --oneline production..development`: what is built, and what is still waiting to go to production.
- Find the last hub update with `git log -1 --format=%H --grep="^Update Project Hub" development`, then read the commits since it (`git log <that-hash>..development --stat`). These are the changes the board must now reflect.
- `CLAUDE.md` → **Progress** (✅ built, ⏭ next) and phase notes. `PRD.md` §21 (phases), §24 (decisions).
- Only count what is **committed on development**. Talk in chat or plans for later doesn't move a card.

### 4. Update `tools/project-hub/hub-data.json`
Edit the JSON (keep it valid). Statuses:

| status | Meaning | Use when |
|---|---|---|
| `planned` | Scheduled for a later phase | Phases after the next one |
| `notstarted` | Next up, not begun | Cards in the ⏭ next phase with no commits yet |
| `dev` | In development | Work has commits, but the feature isn't finished |
| `test` | Ready for test | Built and checked, but waiting on the owner (their check, keys, accounts, decisions); always fill `waitingOn` |
| `done` | Completed | Built, verified and nothing pending from the owner |

- **Move cards** to match the commits since the last hub update. When a phase starts, its cards go `notstarted` → `dev` as work begins. When a phase finishes, mark them `done`, or `test` if they wait on the owner. The next phase's cards move from `planned` to `notstarted`.
- **Add cards** for new work: the owner's extra requests use `"phase": "x"`. Use `area` values that already exist where possible (Store, Admin, Server, Payments, Messages, Legal, Launch, Design, Setup, Your task).
- **Screens:** update `status` and `note` when a screen gains or finishes functionality.
- **Decisions:** set `state` to `done` when the owner confirms or provides something, `needed` when only they can provide it, `confirm` when it's an assumption to confirm. Add new PRD §24 items as they appear.
- Set `statusDate` to today (YYYY-MM-DD). Don't invent progress: if unsure whether something is finished, leave it where it is and mention it in the report.

### 5. Build and publish
- `npm run hub`. It prints card counts and the Git summary; check they look right.
- Publish with the **Artifact** tool: `file_path` = `tools/project-hub/project-hub.html` and `url` = the `artifactUrl` from `hub-data.json`. If this conversation hasn't read or published that artifact yet, the publish is refused and returns the live version. That counts as the read, so publish again. Never publish without `url`, because that would create a separate artifact.

### 6. Commit the hub update
- `git add tools/project-hub` and commit on development with a message that starts **`Update Project Hub`** (step 3 relies on this prefix to find the last update), e.g. `Update Project Hub: Phase 5 orders screen in development`. Add the session's attribution line.
- Never push to or merge into `production`.

### 7. Tell the owner (plain language)
One short message:
- what moved on the board (e.g. "Orders screen → In development");
- anything now waiting on them;
- how many changes are waiting to go to production;
- the hub link.

If you ran this on your own after another task, keep it to a line or two at the end of that task's report.
