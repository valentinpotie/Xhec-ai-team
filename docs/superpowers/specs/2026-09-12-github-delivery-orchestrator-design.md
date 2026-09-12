# GitHub Delivery Orchestrator — Design

## Goal

Turn a human-approved GitHub Project card into a tested, independently reviewed, automatically merged pull request. The visible Project status is the governing control plane; no model may merge or change a status directly.

## Scope

The hackathon version targets this repository only. The dispatcher considers only Project V2 items whose `Status` single-select value is `Approved for delivery` and whose content is a draft issue created by T-REX. It creates a branch and a PR, not a deployment.

Out of scope: multi-repository routing, external webhook infrastructure, production deployment, data migrations, and changing `trex-cockpit.html`.

## Architecture

```text
Project V2 item (Approved for delivery)
  -> GitHub Actions dispatcher (scheduled or manual)
  -> atomically records In delivery + delivery-run id
  -> planner (OpenAI Responses API, strict JSON)
  -> builder (OpenAI Responses API, strict JSON patch)
  -> local apply + allowlisted tests + PR
  -> critic (separate OpenAI call, strict JSON)
  -> one bounded repair attempt, if requested
  -> CI checks + merge controller
  -> Delivered | Needs human review | Delivery failed
```

The Action owns all side effects. The OpenAI calls may only return schema-validated data: plans, unified diffs, test commands selected from a repository allowlist, and review verdicts. The runner, never an agent, applies patches, starts commands, writes Project fields, creates PRs, and enables auto-merge.

## GitHub Project Contract

Required Project V2 single-select values are:

`Approved for delivery` -> `In delivery` -> `Delivered`

Terminal exception values are `Needs human review` and `Delivery failed`. The dispatcher queries the Project through GraphQL, resolves its `Status` field and option IDs at runtime, and changes a selected card to `In delivery` before invoking OpenAI. It also adds a `Delivery run` text field containing the GitHub Actions run URL. A fresh query before processing plus a per-item concurrency group makes reruns idempotent.

## Agent Contracts

### Planner

Input: card title/body, repository file tree, policy, and relevant source excerpts. Output is strict JSON:

```json
{
  "decision": "proceed|escalate",
  "summary": "string",
  "files": ["relative/path"],
  "steps": ["string"],
  "test_commands": ["npm test"],
  "risks": ["string"]
}
```

`escalate` transitions the card to `Needs human review`. Paths must exist and test commands must exactly match the repository allowlist.

### Builder

Input: card, accepted plan, source excerpts for planned files, and policy. Output is strict JSON:

```json
{ "decision": "patch|escalate", "summary": "string", "patch": "unified diff" }
```

The runner rejects diffs that add binary data, use absolute paths, touch protected paths, create more than 15 files, or exceed 600 changed lines. It performs `git apply --check` before applying the patch. The builder never receives credentials.

### Critic

Input: original card, plan, final `git diff`, test output, and policy; it does not receive the builder prompt or response. Output is strict JSON:

```json
{ "verdict": "approve|changes_required|escalate", "findings": [{"severity":"blocker|major|minor","file":"path","reason":"string"}], "repair_instruction":"string|null" }
```

Any `blocker`, `escalate`, invalid JSON, API failure, or test failure blocks merging. `changes_required` permits exactly one repair call, followed by a new test run and critic call.

## Safety and Credentials

`OPENAI_API_KEY` is a GitHub Actions secret and is passed only as an environment variable to the process that calls the OpenAI API. It is never interpolated into model input, written into an artifact, or echoed. The GitHub token uses explicit minimum permissions: `contents: write`, `pull-requests: write`, `issues: write`, and `actions: read`; Project V2 writes use a separately scoped `PROJECTS_TOKEN` secret, with only Project read/write access.

The following paths force `Needs human review`: `.github/workflows/**`, any `.env*`, secret/config files, lockfiles, deployment or infrastructure directories, and `CLAUDE.md`. The executor accepts only read-only inspection commands plus an explicit test-command allowlist. It never runs generated shell commands from a model.

## Merge Policy and Observability

The merge controller enables squash auto-merge only when: a PR exists, `git diff --check` passes, allowlisted tests pass, the final critic verdict is `approve`, the diff is not protected, and GitHub branch protection/required CI checks are green. It writes links to the Action run and PR into the Project item, posts a concise audit comment, and moves the card to `Delivered` only after GitHub confirms merge.

Every run uploads plan JSON, builder metadata (not secrets), critic verdict, test output, and a state-transition log as a retention-limited Actions artifact. A failure is loud: the card is moved to an exception status with an actionable summary.

## Testing

Unit tests use Node's built-in test runner for Project-status parsing, idempotent claiming, protected-path detection, diff guardrails, JSON schema validation, and merge eligibility. Workflow testing uses `workflow_dispatch` with a fixture card/dry-run option. End-to-end validation requires a disposable GitHub Project and branch, a scoped Projects token, and an OpenAI key.
