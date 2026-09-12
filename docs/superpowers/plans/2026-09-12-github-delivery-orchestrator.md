# GitHub Delivery Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically turn a GitHub Project card approved by a human into a guarded, reviewed, auto-merged pull request.

**Architecture:** A GitHub Actions workflow dispatches a Node.js orchestrator. The orchestrator claims a Project V2 item, requests strict JSON plans/patches/verdicts from OpenAI, applies only guarded diffs, and makes all GitHub state transitions itself.

**Tech Stack:** GitHub Actions, GitHub GraphQL API, Node.js built-in modules and test runner, OpenAI Responses API.

**Spec:** `docs/superpowers/specs/2026-09-12-github-delivery-orchestrator-design.md`

## Global Constraints

- Do not modify `trex-cockpit.html` or `app.html`.
- Add no runtime package dependency; use Node.js built-ins and `fetch`.
- Never place API keys or tokens in source, prompts, logs, artifacts, commits, or PR text.
- Only `Approved for delivery` cards may be claimed; every other transition is deterministic code.
- Only allowlisted test commands may run; model-provided shell commands are data, never executable instructions.
- Branches use `codex/delivery-<project-item-id>` and must never push to `main`.

---

### Task 1: Define policy, contracts, and test fixtures

**Files:**
- Create: `delivery/policy.json`
- Create: `delivery/schemas.mjs`
- Create: `test/delivery/schemas.test.mjs`

**Interfaces:**
- Produces: `validatePlan(value)`, `validatePatch(value)`, `validateCritic(value)`, `isProtectedPath(path)`, and `isAllowedTest(command)`.

- [ ] **Step 1: Write failing tests for accepted/rejected plan, patch, critic, protected path, and allowlisted command cases.**
- [ ] **Step 2: Run `node --test test/delivery/schemas.test.mjs`; confirm failure because modules do not exist.**
- [ ] **Step 3: Add `policy.json` with allowed commands (`node --check`, `node --test`) and protected globs from the spec.**
- [ ] **Step 4: Implement validators with explicit property/type/length checks and no external validator dependency.**
- [ ] **Step 5: Run `node --test test/delivery/schemas.test.mjs`; confirm PASS.**
- [ ] **Step 6: Commit only Task 1 files with `feat: add delivery policy contracts`.**

### Task 2: Implement guarded OpenAI client and patch executor

**Files:**
- Create: `delivery/openai.mjs`
- Create: `delivery/patch.mjs`
- Create: `test/delivery/patch.test.mjs`

**Interfaces:**
- Consumes: Task 1 validators and policy.
- Produces: `requestStructuredOutput({name, schema, instructions, input})` and `validateAndApplyPatch(patch, policy)`.

- [ ] **Step 1: Write failing patch tests for absolute paths, protected files, binary markers, over-limit diffs, invalid `git apply --check`, and valid patch.**
- [ ] **Step 2: Run `node --test test/delivery/patch.test.mjs`; confirm failure.**
- [ ] **Step 3: Implement Responses API requests with `OPENAI_API_KEY` read only from `process.env`; request strict JSON Schema output and set `store: false`.**
- [ ] **Step 4: Implement patch inspection and invoke `git apply --check` before `git apply`; never execute model text as a shell command.**
- [ ] **Step 5: Run `node --test test/delivery/patch.test.mjs`; confirm PASS.**
- [ ] **Step 6: Commit only Task 2 files with `feat: add guarded OpenAI patch executor`.**

### Task 3: Implement Project V2 claim and state transitions

**Files:**
- Create: `delivery/project.mjs`
- Create: `test/delivery/project.test.mjs`

**Interfaces:**
- Consumes: `PROJECTS_TOKEN`, project ID, item ID, and `Status` option names.
- Produces: `listApprovedItems()`, `claimItem(item)`, `markDelivered(item, url)`, and `markException(item, status, message)`.

- [ ] **Step 1: Write failing mocked-fetch tests proving only `Approved for delivery` is claimable and a second claim is rejected.**
- [ ] **Step 2: Run `node --test test/delivery/project.test.mjs`; confirm failure.**
- [ ] **Step 3: Implement GraphQL field/option discovery and `updateProjectV2ItemFieldValue` mutations.**
- [ ] **Step 4: Include `Delivery run` URL and status transition in the claim mutation sequence; re-read status immediately before the update.**
- [ ] **Step 5: Run `node --test test/delivery/project.test.mjs`; confirm PASS.**
- [ ] **Step 6: Commit only Task 3 files with `feat: add project delivery state machine`.**

### Task 4: Implement orchestration and critic repair loop

**Files:**
- Create: `delivery/run.mjs`
- Create: `test/delivery/run.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: `runDelivery(item, {dryRun})`, which returns `merged`, `review_required`, or `failed`.

- [ ] **Step 1: Write failing tests for planner escalation, builder escalation, test failure, critic approval, one repair, and second critic rejection.**
- [ ] **Step 2: Run `node --test test/delivery/run.test.mjs`; confirm failure.**
- [ ] **Step 3: Implement planner, builder, and critic prompts from the spec; pass card/plan/diff/test data only.**
- [ ] **Step 4: Create the branch, apply patch, run only policy commands, create a PR, and attach non-secret artifacts.**
- [ ] **Step 5: Enforce one repair maximum and map every outcome to the named Project statuses.**
- [ ] **Step 6: Run `node --test test/delivery/run.test.mjs`; confirm PASS.**
- [ ] **Step 7: Commit only Task 4 files with `feat: orchestrate guarded AI delivery`.**

### Task 5: Add workflow, permissions, and dry-run demonstration path

**Files:**
- Create: `.github/workflows/delivery-dispatch.yml`
- Modify: `README.md` if it exists; otherwise create it with setup and demo steps.

**Interfaces:**
- Consumes: `delivery/run.mjs`.
- Produces: scheduled and `workflow_dispatch` runs with `dry_run`, `project_id`, and optional `item_id` inputs.

- [ ] **Step 1: Add a workflow test checklist that verifies YAML inputs, least-privilege permissions, concurrency by item ID, and no secret echoing.**
- [ ] **Step 2: Create the workflow with explicit `permissions`, environment variables sourced only from secrets, and `workflow_dispatch` dry-run inputs.**
- [ ] **Step 3: Run `node --test test/delivery/*.test.mjs` and `node --check delivery/run.mjs`; confirm PASS.**
- [ ] **Step 4: Add README instructions for Project statuses, required secrets, branch protection, dry-run, and the expected delivery audit trail.**
- [ ] **Step 5: Manually run a dry-run against a fixture/real disposable card; verify it reaches no write or merge operation.**
- [ ] **Step 6: Commit only Task 5 files with `feat: add GitHub Actions delivery dispatcher`.**

## Self-Review

- Spec coverage: Tasks 1-5 cover deterministic state transitions, strict model contracts, guarded patching, contradictory review, CI/merge policy, credentials, and observability.
- No placeholders: all implementation files, interfaces, allowed test commands, statuses, and state outcomes are named.
- Type consistency: the planner/builder/critic contracts in Task 1 are the contracts consumed by Tasks 2 and 4.
