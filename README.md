# T-REX Product Agent

`trex-cockpit.html` is the hackathon deliverable. Open it directly in a browser; no build step is required.

## Autonomous delivery (in progress)

The `delivery/` directory is the safe core of a GitHub Project delivery dispatcher. It is deliberately separate from the cockpit and does not contain credentials.

### Project contract

Create a Project V2 single-select `Status` field with these values:

- `Approved for delivery`
- `In delivery`
- `Delivered`
- `Needs human review`
- `Delivery failed`

The dispatcher must claim a card by changing it from `Approved for delivery` to `In delivery` before calling OpenAI. A second worker must then leave it untouched.

### Secrets and permissions

Store these only as GitHub Actions secrets:

- `OPENAI_API_KEY`: server-side OpenAI Responses API key.
- `PROJECTS_TOKEN`: fine-grained GitHub token with Project read/write access.

The repository workflow will also need explicit `contents: write`, `pull-requests: write`, and `issues: write` permissions to create a delivery PR. Never put credentials in a Project card, prompt, HTML, local file, commit, or log.

### Safety model

- Models produce structured plan, patch, and critic outputs; deterministic code validates them.
- Generated shell commands are never executed. Only the policy allowlist may run.
- A patch is checked before it is applied and cannot touch workflow, deployment, environment, lockfile, or `CLAUDE.md` paths.
- A separate critic must approve the final diff and test output before auto-merge is enabled.

### Local checks

```bash
node --test test/delivery/*.test.mjs
node --check delivery/schemas.mjs
node --check delivery/patch.mjs
node --check delivery/project.mjs
```

The design and implementation sequence are in `docs/superpowers/`.
