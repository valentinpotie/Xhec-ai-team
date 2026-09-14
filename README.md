# T-REX Product Agent

Built at the AI Tinkerers Paris hackathon, 12 September 2026 — theme "Agents, Everywhere".

A Product Manager agent that lives **inside** the product. T-REX is CMA CGM's freight-rate
cockpit, sold to brokers and shippers.

1. A customer sends feedback from the cockpit. A card appears immediately on the company's
   GitHub Project, first column.
2. The agent re-reads that feedback against what the customer actually **does** (usage
   telemetry nobody typed) and the business context (August board review, quarterly
   objectives, capacity, policies). It scores value, tech effort and a priority out of 100,
   then rewrites the card: imperative title, real need, quantified evidence, recommendation.
   The card moves to the second column.
3. A human decides on the board. Delivery agents take over from there.

What a chatbot cannot do: spot the broker who has asked seven times for a document module
but opens that screen twice a month, or the 43 accounts who abandon the Filters drawer 61%
of the time and never complain.

## Running it

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# then open http://127.0.0.1:8765/trex-cockpit.html
```

A static file server is required: `context/` is loaded over `fetch`, which is blocked on
`file://`. Opened as a local file the app still runs, on an embedded fallback context, and
says so in the operator view. Leaflet and the fonts come from a CDN. There is no build step.

`trex-cockpit.html` is the whole deliverable — vanilla HTML/CSS/JS, no dependencies.

### Keys

The agent needs an OpenAI key, a GitHub token with the `project` scope, and optionally an
Airtable read token. Paste them in the operator view (gear icon in the sidebar, or
`Cmd/Ctrl + .`, or `#ops` in the URL); they stay in tab memory only.

To avoid retyping them, copy `secrets.local.example.json` to `secrets.local.json` at the
repository root and fill it in. That file is gitignored and must never be committed.

### Business context

`context/` holds the business input as real documents — board review, quarterly objectives,
ADR, capacity, audit policy, account sheet. The agent quotes them word for word, and a
validator rejects any quote that is not literally present in the source.

The same two tables can be read live from Airtable (`Accounts`, `Decisions`), which takes
priority over `context/` when a token is set.

## Autonomous delivery

`delivery/` is a GitHub Project delivery dispatcher, deliberately separate from the cockpit
and free of credentials. The cockpit never talks to it: they meet only on the board.

> [!NOTE]
> The scheduled workflow is **disabled** since the end of the hackathon, and the repository
> secrets it used have been deleted. Re-adding `OPENAI_API_KEY` and `PROJECTS_TOKEN` and
> re-enabling `.github/workflows/delivery-dispatch.yml` is enough to bring it back.

### Project contract

A Project V2 single-select `Status` field with these values:

- `Approved for delivery`
- `In delivery`
- `Delivered`
- `Needs human review`
- `Delivery failed`

The dispatcher must claim a card by changing it from `Approved for delivery` to
`In delivery` before calling OpenAI. A second worker must then leave it untouched.

### Secrets and permissions

Store these only as GitHub Actions secrets:

- `OPENAI_API_KEY`: server-side OpenAI Responses API key.
- `PROJECTS_TOKEN`: fine-grained GitHub token with Project read/write access.

The workflow also needs explicit `contents: write`, `pull-requests: write` and
`issues: write` permissions to open a delivery PR. Never put credentials in a Project card,
prompt, HTML file, local file, commit, or log.

### Safety model

- Models produce structured plan, patch and critic outputs; deterministic code validates them.
- Generated shell commands are never executed. Only the policy allowlist may run.
- A patch is checked before it is applied and cannot touch workflow, deployment, environment,
  lockfile, or `CLAUDE.md` paths.
- A separate critic must approve the final diff and test output before auto-merge is enabled.

### Local checks

```bash
node --test test/delivery/*.test.mjs
node --check delivery/schemas.mjs
node --check delivery/patch.mjs
node --check delivery/project.mjs
```

The design and implementation sequence are in `docs/superpowers/`.

## Repository map

| Path | Role |
|---|---|
| `trex-cockpit.html` | The deliverable: cockpit + injected product agent module |
| `context/` | Business context as markdown documents, quoted verbatim by the agent |
| `delivery/`, `.github/workflows/` | Delivery dispatcher (currently disabled) |
| `video/workflow.html` | Standalone explainer used for the demo video |
| `app.html` | Early morning prototype, superseded |
