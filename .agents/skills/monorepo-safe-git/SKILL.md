---
name: monorepo-safe-git
description: >-
  Safety protocol and mandatory workflow for Git commits and pushes across this monorepo:
  segregates changes between Landing Page (landing/), CRM Admin (crm-admin/), and POS System (src/),
  strictly forbids blind 'git add .', requires active user confirmation of target scope,
  and verifies unpushed commits before executing 'git push'.
---

# Monorepo Safe Git Workflow & Security Protocol

This skill enforces strict safety boundaries when performing Git operations (stage, commit, push) within this monorepo codebase.

---

## 1. Monorepo Structural Zones

The repository contains three distinct, independent applications plus root infrastructure:

| Zone | Path | Description | Deploy Target |
| :--- | :--- | :--- | :--- |
| **Landing** | `landing/` | Public marketing website & lead capture | Independent deploy |
| **CRM Admin** | `crm-admin/` | Management panel & tenant administration | Independent deploy |
| **POS System** | `src/`, `index.html` | Core Point of Sale SaaS application | Main system deploy |
| **Infra/Shared** | `supabase/`, `docs/`, root configs | Database schemas, edge functions, shared config | Shared |

---

## 2. Mandatory Rules for Antigravity

Whenever a user requests to commit, push, or save progress to GitHub, Antigravity **MUST** adhere to the following protocol without exception:

### Rule 1: Never Execute Blind Global Commands
* **PROHIBITED:** `git add .`, `git add -A`, `git commit -a`, `git commit -am "..."`.
* Running global adds risks accidentally committing unfinished, broken, or sensitive work from another application in the monorepo.

### Rule 2: Zone Inspection & Active Inquiry
1. Always run `git status -s` first to inspect modified, untracked, and deleted files.
2. Group the pending changes by Zone (`Landing`, `CRM`, `POS`, `Infra`).
3. If changes span more than one zone, **explicitly ask the user**:
   > *"Detecté cambios en múltiples áreas. ¿De cuál de ellas deseas hacer el commit?*
   > * *1. 🌐 Landing Page (`landing/`)*
   > * *2. 📊 CRM Admin (`crm-admin/`)*
   > * *3. 💻 Sistema POS (`src/`)*
   > * *4. 📦 Todo el repositorio (solo si es necesario)*

### Rule 3: Selective Staging (`git add <path>`)
Only stage files matching the confirmed zone:
```bash
# Example for Landing only:
git add landing/

# Example for CRM only:
git add crm-admin/

# Example for POS only:
git add src/
```

### Rule 4: Conventional Commit Formatting
Commits must clearly specify the affected zone in their prefix:
* `feat(landing): ...` / `fix(landing): ...`
* `feat(crm): ...` / `fix(crm): ...`
* `feat(pos): ...` / `fix(pos): ...`
* `feat(infra): ...` / `chore(repo): ...`

### Rule 5: Double-Check Push Verification
Before executing `git push`:
1. Check which commits will be sent to the remote:
   ```bash
   git log @{u}..HEAD --oneline
   ```
   *(or check unpushed commits with `git status`)*
2. Display the commits and the target branch to the user.
3. Prompt for final confirmation before executing the push to GitHub:
   > *"Se enviarán al repositorio remoto los siguientes commits en la rama `<rama>`:*
   > * `[commit hash] feat(landing): ...`
   > *¿Deseas proceder con el git push?"*

---

## 3. Step-by-Step Execution Checklist

- [ ] Ran `git status -s` to review all pending files.
- [ ] Confirmed the specific zone with the user (Landing, CRM, or POS).
- [ ] Staged ONLY files for the chosen zone using specific paths (`git add <folder>/`).
- [ ] Created commit with zone prefix (`feat(landing): ...`, etc.).
- [ ] Verified remaining files from other zones are untouched in working directory.
- [ ] Checked unpushed commits (`git log @{u}..HEAD --oneline`).
- [ ] Obtained user confirmation before running `git push`.
