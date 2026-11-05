# Adaptive Router — OpenCode v2 technical spike

This directory contains a **proof of concept**, not a production-ready plugin. Verified against OpenCode **v2.2.5**, including a local fake-provider end-to-end test.

OpenCode v2 provides native model discovery (`ctx.model.list()`), session model switching (`ctx.session.switchModel()`), prompt admission hooks and command transforms. Unlike the v1 `opencode-auto-jev` example, v2 uses `Plugin.define({ setup(ctx) })` and `plugins`, not the old `chat.message` hook or singular `plugin` config.

## What works in code

- Native connected-model inventory (no manual task/model table)
- CPU-only offline multinomial Naive Bayes task classifier (small embedded examples, zero inference API calls)
- Task-aware, deterministic selection among enabled tool-capable models with **known** listed costs: simple → cheapest; medium → middle price; complex → highest price
- For the **three specifically approved internal models without price metadata**, provisional per-task profiles choose `small` (simple), `mid` (medium), or `large` (complex). These are **experimental routing hypotheses, not verified model rankings**. Tool support, current-provider restrictions, exact model allowlists, model availability, context/image constraints, and transport health always filter candidates **before** the profile is considered.
- Optional **explicit user-feedback learning**: `/adaptive-rate-good` or `/adaptive-rate-bad` rates the last routed answer once. Aggregated model/tier ratings remain in local plugin storage; no prompt/source content is retained. Automatic preference changes require at least three ratings **per candidate model** in the same task tier, with all compared candidates rated.
- Local transport telemetry for Auto-routed primary model requests: response count, HTTP error count, and aggregate request latency; **no prompt, URL, headers, or response content**. These data inform temporary health exclusion, not model-quality rankings.
- Temporary transport-health fallback: models with at least three observed HTTP responses and a 50%+ error rate are excluded for up to five minutes since their latest error. Never bypasses provider allowlists, tool requirements, or the fail-closed behavior.
- Passive build/test outcome counters from existing `tool.execute.after` hooks: only known shell test/build commands with a structured exit code are counted. The plugin never runs a test or build itself and never stores command text or tool output.
- Default restriction to the current provider; cross-provider routing requires an explicit provider allowlist
- Optional exact `allowedModels` list; when set, Auto never selects models absent from the list even if the provider exposes them later
- If **all** eligible models lack pricing, Auto uses a complete, recognized model-profile group where available; otherwise it uses the configured real default model **only if** it survives every provider/model/tool/health filter. Unknown or mixed inventories are never ranked by guessed quality. A candidate without explicit tool-call capability metadata is excluded.
- Session-scoped enable/disable commands
- No local GPU, LLM, remote router or extra API key
- Safe fallback to the current model when no candidate qualifies

**Experimental:** This classifier uses a tiny built-in English/German training set. Its probability is **not calibrated**, and price is **not a validated measure of model quality**. Unrecognized tasks conservatively fall back to `medium` (not necessarily the most capable model). The classifier is not retrained from outcomes, and a higher price does not establish better results.
The internal start profiles are deliberately low-confidence engineering hypotheses informed by upstream model descriptions, not numbers calibrated across a shared workload or proof that internal serves identical upstream weights: [Mistral model card](https://huggingface.co/), [Qwen model card](https://huggingface.co/), [DeepSeek model card](https://huggingface.co/). Public benchmarks use differing harnesses, so **their scores must not be directly compared**. For each task tier, the configured profile is replaced by local manual-feedback rankings only after **every eligible candidate** has at least three ratings. HTTP success alone does not count as quality.
Feedback is user-reported usefulness, **not automatically verified correctness**. A successful model response alone is never counted as success. Feedback currently updates stored aggregates (a small Beta-smoothed success ratio) rather than retraining the classifier. It is a proof of concept, not a robust bandit or statistically reliable benchmark.
HTTP status/latency metrics are likewise **not build/test outcomes**. The current `http.response` hook can only measure replies actually observed; timeouts and network failures without an HTTP response are not included. Build/test counters are observations, not causal attribution: a failing build could reflect pre-existing problems. They do **not** automatically affect model quality scores. The test/build detector ignores chained commands and outputs without structured exit codes. Concurrency of multiple OpenCode processes writing the same plugin storage and TUI feedback commands still need final integration verification.

## Try in OpenCode v2.2.5

In a local clone of this repository, add the plugin path to your project `opencode.jsonc` (merge with existing config):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["./router_mvp"]
}
```

Run `opencode --standalone`, open `/models`, and choose **Auto (Adaptive Router)** (`adaptive-router/auto`). The prompt hook routes subsequent requests to an eligible real model. Alternatively, `/adaptive-auto-on` enables session routing without selecting the virtual model. Use `/adaptive-auto-off` to stop command-enabled routing. Inspect logs for `[adaptive-router] selected ...`. Windows TUI selection and `/adaptive-rate-good` were manually verified; the regular background-service mode needs separate validation. CLI `run --standalone --model adaptive-router/auto` works.

**Enterprise caution:** By default, only the current provider is considered. Cross-provider routing requires explicit plugin options, for example `{ "package": "./router_mvp", "options": { "crossProvider": true, "allowedProviders": ["local"] } }`. Only list providers approved for the current repository. Do not try this against confidential code until routing and policy enforcement have been verified.

To restrict Auto to **exactly three approved models**, configure the plugin entry as an object:

```jsonc
{
  "model": "local/mid",
  "plugins": [{
    "package": "./router_mvp",
    "options": {
      "allowedModels": [
        "local/large",
        "local/small",
        "local/mid"
      ]
    }
  }]
}
```

The example limits **automatic routing only**. It is not an organizational policy engine and does not prevent a user from manually selecting other connected models. Enforce hard provider restrictions through the organization's OpenCode policies separately.

If no eligible candidate has usable price metadata and no complete built-in profile applies, the selector keeps the approved configured default rather than guessing. Image attachments and required context can also filter models; full modality and prompt-size detection remain future work.

## Reproducible local E2E

From `router_mvp`, run `npm install` and `npm run test:e2e` (Node.js 22+). The suite starts a local fake OpenAI-compatible provider, launches OpenCode v2.2.5 in standalone mode, and uses a disposable configuration. It does **not** call external model APIs. It checks:

- `Auto` routes simple tasks to `ultra`, medium tasks to `cheap`, and complex tasks to `pricey` among `pricey`, `cheap`, `ultra`, `notools`, and `unknown` (the intentionally cheaper `notools` must be rejected).
- An isolated no-price fake provider dispatches to the approved configured default rather than failing.
- An isolated fake internal provider with **three unpriced, tool-capable models** checks simple/medium/complex model-profile dispatch without connecting to internal or sending code outside the machine.
- Unknown prompts conservatively route to the middle price/profile tier.
- The configured default stays unchanged unless Auto is explicitly selected.
- A manual model selection wins and persists in the same session.
- Auto fails closed when no tool-capable model is available, with no requests reaching the provider (currently surfaced by OpenCode CLI as `UnexpectedStatus: 500`).

The test suite uses local ports 18083 and a temporary OpenCode session store. It is a functional integration test, not a quality/complexity benchmark.

### Opt-in local diagnostics

If OpenCode prints only a generic `UnexpectedStatus: 500`, set `ADAPTIVE_ROUTER_DEBUG_LOG` to an absolute writable JSONL file path **before launching OpenCode**. The plugin logs configured allowlists, eligible model metadata, the classification tier and confidence, routing stages, feedback recorded/skipped, and safe block reasons. It does **not** log prompts, source code, HTTP bodies, headers, credentials, or raw exception messages. No file is written unless this environment variable is set.

PowerShell example:

```powershell
$env:ADAPTIVE_ROUTER_DEBUG_LOG = Join-Path $env:TEMP "adaptive-router-debug.jsonl"
opencode run --model adaptive-router/auto "Reply with OK"
Get-Content $env:ADAPTIVE_ROUTER_DEBUG_LOG -Tail 30
```

Remove the environment variable when finished: `Remove-Item Env:ADAPTIVE_ROUTER_DEBUG_LOG`.

Run `npm run eval:classifier` for a separate 12-prompt English/German smoke matrix. This is **small and manually curated**, not a representative held-out corpus or a reliable accuracy estimate; independent real-world labeled examples and calibration are needed.

## Important limitations / next verification

1. Test regular background-service mode, Unix TUI, and session reuse after service reload.
2. Improve the no-eligible-model error exposed by OpenCode CLI; the virtual provider must never receive requests.
3. Test cross-provider allowlists and policy enforcement with connected enterprise providers before using confidential code.
4. Feedback command storage has been smoke-tested on Windows TUI. Further test tool outcome hooks and transport telemetry through TUI/session API, failed network requests without HTTP responses, and simultaneous writes across processes. The current HTTP-error fallback is applied on **subsequent selections**, not as an automatic retry of the failed request.
5. Validate the provisional internal profiles using a shared coding benchmark and local task/quality ratings; diversify the task-classifier training set, calibrate confidence, and evaluate multilingual ambiguous prompts.

Unit tests: `npm test` (Node.js 20+; no dependencies required for the selector).

## Offline routing benchmark

### Experimental structured classifier (not active)

### Local tiny-model benchmark (not active)

Compare a **locally installed** small language model against both offline
classifiers on the 36 synthetic `unseen-task-cases.mjs` tasks. The script uses
only Ollama at `127.0.0.1:11434`, forces structured JSON output, and reports
accuracy and p50/p95 latency. It does not change OpenCode routing or send
code to any external service. Model downloads are separate and optional.

PowerShell (Ollama must already be running):

```powershell
ollama pull qwen3:0.6b
npm run eval:local-llm -- --model=qwen3:0.6b
```

Optionally compare `qwen3:1.7b` or `gemma3:1b`. This first run still needs to
be performed on a machine with Ollama; no model accuracy or latency has been
measured by the repository maintainers yet. The corpus is synthetic and has
already been inspected during rule development; evaluate real-world
generalization on a new permission-safe dataset after choosing a model.

Run `npm run eval:shadow` to compare the production prompt classifier against
an isolated offline prototype that assesses **intent**, **scope**, and **risk**.
Pass `-- --json` to inspect individual disagreements or `-- --holdout` to
evaluate the existing synthetic holdout. `-- --unseen` evaluates 36 newly
authored, balanced synthetic tasks with an asymmetric penalty matrix (where
underestimating complex work costs more than overestimating simple work).
Penalties are illustrative relative units, **not** real costs or success rates.
This script does **not** route any
requests, change model settings, call a provider, or store prompt text.

The first development-set comparison was **94/100** for the current classifier
versus **70/100** for the structured prototype. On the previously examined
30-task holdout, the scores were **17/30** and **22/30** respectively.
The latter is deliberately experimental; its confidence is an uncalibrated heuristic. The original
holdout has already been examined during earlier development, so neither
dataset provides a fresh independent estimate of real-world accuracy.

Before the first `--unseen` run, the 36 examples and reference labels were
fixed without evaluating either classifier on them. The first scores were
**20/36** (current) versus **25/36** (structured), with **9 versus 6**
underestimates and **7 versus 5** overestimates, respectively. Weighted
penalties were **50 versus 35**. This is a one-time synthetic check, not a
representative or externally validated sample; further tuning must use a
different dataset.

From `router_mvp/`, run `npm run eval:benchmark` for a 100-prompt synthetic
benchmark (30 simple / 40 medium / 30 complex). Use
`node eval/benchmark.mjs --json` for a machine-readable report with a confusion
matrix, precision/recall by tier, fallback rate and individual errors.

Run `node eval/benchmark.mjs --holdout` for 30 additional synthetic prompts
(10 per tier) kept separate from the development examples. After classifier
signal tuning, the development score was **98/100 (98%)**, but the first
holdout evaluation reached only **20/30 (66.7%)**, with **30% fallback**.
That was the first evaluation of the #5 classifier, not a lasting guarantee.
Later conservative scope fixes change these scores; do not use the same holdout
as a tuning target or present it as a fresh independent test.

Prompts and reference labels are manually curated, not inferred from router
output. They include English/German phrasing and potentially misleading scope
cues. They are **not** representative samples of production traffic; results
must not be presented as generalized accuracy. Future tuning needs a fresh
evaluation set; reusing the current holdout for fixes would contaminate it.
No provider calls, credentials, or proprietary task data are involved.

