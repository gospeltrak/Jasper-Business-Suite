# Development Rules — Jasper Business Suite

> **Status:** Mandatory
> **Applies to:** All contributors — human developers and AI assistants (Claude, Copilot, Cursor, etc.)
> **System type:** Live production, multi-tenant ERP/POS

These rules exist because Jasper Business Suite serves real businesses with real
money and real inventory. A broken deploy is not a bug — it is a business outage
for every tenant on the platform.

---

## Table of Contents

1. [Absolute Rules](#1-absolute-rules)
2. [Scope Control](#2-scope-control)
3. [Inspect First](#3-inspect-first)
4. [Safe Development Workflow](#4-safe-development-workflow)
5. [Git Rules](#5-git-rules)
6. [Testing Rules](#6-testing-rules)
7. [Production Protection](#7-production-protection)
8. [When Something Is Unclear](#8-when-something-is-unclear)
9. [Finish Rule](#9-finish-rule)
10. [Quick Reference](#10-quick-reference)

---

## 1. Absolute Rules

- This is a **live production multi-tenant system**. There is no "safe" change.
- No file is modified before a plan is approved.
- No code reaches `main` or production without explicit user approval.
- When in doubt: **stop and ask**.

---

## 2. Scope Control

Only perform the task explicitly requested by the user.

### Forbidden without explicit approval

| Action | Rule |
|---|---|
| Modify unrelated code | Never |
| Redesign unrelated UI | Never |
| Optimize unrequested code | Never |
| Rename files | Requires approval |
| Delete "unused" code | Never |
| Change APIs | Only if requested |
| Change database schema | Requires approval |
| Install packages | Requires approval |
| Update dependencies | Requires approval |
| Modify business logic outside the requested module | Never |

### Discovering other issues

If a separate bug, security issue, or code smell is found while working:

1. **Report it** to the user, clearly and specifically.
2. **Do not fix it.**
3. Continue with the originally requested task only.

---

## 3. Inspect First

**No file may be modified before the user approves a plan.**

Required sequence:

1. **Inspect architecture** — understand how the affected module fits into the system.
2. **Find the root cause** — not the symptom. No patching over unknown behaviour.
3. **List affected files** — every file that will be touched, explicitly.
4. **Explain the implementation plan** — what changes, why, and the risk to other modules.
5. **Wait for user approval.**

A plan that cannot name its affected files is not a plan.

---

## 4. Safe Development Workflow

Once the plan is approved:

1. **Implement one stage only.** Multi-stage work is delivered stage by stage.
2. **Test locally** against the full testing checklist (Section 6).
3. **Verify nothing else broke** — related modules, shared components, tenant isolation.
4. **Show the working result on `localhost`.**
5. **Wait for user verification** before the next stage.

### Hard stop — requires explicit approval

- `git push`
- Merge to `main`
- Deploy to Vercel
- Deploy to any other environment

---

## 5. Git Rules

**Never, without explicit user approval:**

- `git push`
- Merge to `main`
- Deploy anything, anywhere

**Always:**

- Work on the **current development branch**.
- Keep commits small and scoped to the approved task.
- Write commit messages that describe the actual change, not the intention.

---

## 6. Testing Rules

Every change must be tested before it is presented. No exceptions.

### Required checklist

**Build & code health**
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] No runtime errors

**Responsive**
- [ ] Desktop tested
- [ ] Tablet tested
- [ ] Mobile tested

**Theming**
- [ ] Dark mode verified
- [ ] Light mode verified

### After testing

1. Present the result on `localhost`.
2. Wait for user approval.
3. **Only then** may the code be committed or pushed.

---

## 7. Production Protection

Treat every task as if thousands of customers are using the system right now —
because they are.

- Use the **smallest possible change** that solves the problem.
- **Never** perform large refactors.
- **Never** touch unrelated modules.
- Multi-tenant safety: any change touching data access must preserve tenant
  isolation. Verify it explicitly.

---

## 8. When Something Is Unclear

**Do not guess.**

1. Stop.
2. Ask a specific question.
3. Wait for the answer.

Guessing on a production ERP/POS system is a business risk, not a productivity gain.

---

## 9. Finish Rule

After completing the requested task:

- **Stop immediately.**
- Do not continue to another improvement.
- Do not "clean up" nearby code.
- Do not "improve" anything else.
- Wait for the next instruction.

---

## 10. Quick Reference

```
BEFORE CODING     →  Inspect → Root cause → List files → Plan → WAIT for approval
WHILE CODING      →  One stage → Smallest change → Nothing unrelated
AFTER CODING      →  Build ✓ TS ✓ Console ✓ Runtime ✓
                     Desktop ✓ Tablet ✓ Mobile ✓ Dark ✓ Light ✓
                     → Show on localhost → WAIT for approval
NEVER WITHOUT OK  →  push · merge to main · deploy · schema change
                     · new package · dependency update
FOUND ANOTHER BUG →  Report it. Do not fix it.
UNCLEAR           →  Stop. Ask. Wait.
DONE              →  Stop. Wait for the next instruction.
```
