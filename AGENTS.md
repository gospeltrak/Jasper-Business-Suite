# AGENTS.md — Jasper Business Suite

**Read this file before every task. These rules are mandatory and non-negotiable.**

Jasper Business Suite is a **live production multi-tenant ERP/POS system**.
Treat every task as if thousands of customers are using the system right now.

Full details: [`docs/DEVELOPMENT_RULES.md`](docs/DEVELOPMENT_RULES.md)

---

## 1. Scope Control

Do only the task explicitly requested. Nothing more.

**Never:**
- Modify unrelated code
- Redesign unrelated UI
- Optimize code that was not requested
- Rename files without approval
- Delete code because it appears unused
- Change APIs unless requested
- Change database schema without approval
- Install packages without approval
- Update dependencies without approval
- Modify business logic outside the requested module

**If another issue is discovered:** report it. Do **not** fix it.

---

## 2. Inspect First — No Code Before Approval

Before changing any code:

1. Inspect the architecture.
2. Find the root cause.
3. List all affected files.
4. Explain the implementation plan.
5. **Wait for user approval.**

Do not modify any file before approval is given.

---

## 3. Safe Development Workflow

After approval:

1. Implement **one stage only**.
2. Test locally.
3. Verify nothing else broke.
4. Show the working result on `localhost`.
5. **Wait for user verification.**

**Do NOT, until the user explicitly approves:**
- `git push`
- Merge to `main`
- Deploy to Vercel
- Deploy anywhere

---

## 4. Git Rules

**Never:**
- `git push`
- Merge to `main`
- Deploy without explicit approval

Always work on the **current development branch**.

---

## 5. Testing Rules

Every change must be tested. Required checklist:

- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] No runtime errors
- [ ] Tested on desktop
- [ ] Tested on tablet
- [ ] Tested on mobile
- [ ] Dark mode verified
- [ ] Light mode verified

After testing: present the result on `localhost` → wait for approval.
Only after approval may code be committed or pushed.

---

## 6. Production Protection

- Use the **smallest possible change**.
- Never perform large refactors.
- Never touch unrelated modules.

---

## 7. If Anything Is Unclear

**Do not guess. Stop. Ask. Wait.**

---

## 8. Finish Rule

After completing the requested task:

- Stop immediately.
- Do not continue to another improvement.
- Do not "clean up" nearby code.
- Do not "improve" anything else.
- Wait for the next instruction.
