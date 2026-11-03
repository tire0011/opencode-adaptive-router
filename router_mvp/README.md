# Adaptive Router — OpenCode v2 technical spike

This directory contains a **proof of concept**, not a production-ready plugin. Verified against OpenCode **v2.2.5**, including a local fake-provider end-to-end test.

OpenCode v2 provides native model discovery (`ctx.model.list()`), session model switching (`ctx.session.switchModel()`), prompt admission hooks and command transforms. Unlike the v1 `opencode-auto-jev` example, v2 uses `Plugin.define({ setup(ctx) })` and `plugins`, not the old `chat.message` hook or singular `plugin` config.

## What works in code

- Native connected-model inventory (no manual task/model table)
- CPU-only offline multinomial Naive Bayes task classifier (small embedded examples, zero inference API calls)
- Task-aware, deterministic selection among enabled tool-capable models with **known** listed costs: simple → cheapest; medium → middle price; complex → highest price
- Optional **explicit user-feedback learning**: `/adaptive-rate-good` or `/adaptive-rate-bad` rates the last routed answer once. Aggregated model/tier ratings remain in local plugin storage; no prompt/source content is retained. Automatic preference changes require at least three ratings **per candidate model** in the same task tier, with all compared candidates rated.
- Local transport telemetry for Auto-routed primary model requests: response count, HTTP error count, and aggregate request latency; **no prompt, URL, headers, or response content**. This is observational only and does not influence model ranking yet.
- Default restriction to the current provider; cross-provider routing requires an explicit provider allowlist
- Session-scoped enable/disable commands
- No local GPU, LLM, remote router or extra API key
- Safe fallback to the current model when no candidate qualifies

**Experimental:** This classifier uses a tiny built-in English/German training set. Its probability is **not calibrated**, and price is **not a validated measure of model quality**. Unrecognized tasks fall back to the cheapest suitable model. The classifier is not retrained from outcomes, and a higher price does not establish better results. A future version should consume empirical per-model evaluations and use task requirements and measured success rates instead of price for escalation.
Feedback is user-reported usefulness, **not automatically verified correctness**. A successful model response alone is never counted as success. Feedback currently updates stored aggregates (a small Beta-smoothed success ratio) rather than retraining the classifier. It is a proof of concept, not a robust bandit or statistically reliable benchmark.
HTTP status/latency metrics are likewise **not build/test outcomes**. The current `http.response` hook can only measure replies actually observed; timeouts and network failures without an HTTP response are not included. Concurrency of multiple OpenCode processes writing the same plugin storage and TUI feedback commands still need final integration verification.

## Try in OpenCode v2.2.5

In a local clone of this repository, add the plugin path to your project `opencode.jsonc` (merge with existing config):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["./router_mvp"]
}
```

Run `opencode`, open `/models`, and choose **Auto (Adaptive Router)** (`adaptive-router/auto`). The prompt hook routes subsequent requests to an eligible real model. Alternatively, `/adaptive-auto-on` enables session routing without selecting the virtual model. Use `/adaptive-auto-off` to stop command-enabled routing. Inspect logs for `[adaptive-router] selected ...`. The TUI model picker has not yet been manually E2E-tested; CLI `--model adaptive-router/auto` works.

**Enterprise caution:** By default, only the current provider is considered. Cross-provider routing requires explicit plugin options, for example `{ "package": "./router_mvp", "options": { "crossProvider": true, "allowedProviders": ["siemens"] } }`. Only list providers approved for the current repository. Do not try this against confidential code until routing and policy enforcement have been verified.

If no eligible candidate has usable price metadata, the selector keeps the current model rather than guessing. Image attachments and required context can also filter models; full modality and prompt-size detection remain future work.

## Reproducible local E2E

From `router_mvp`, run `npm install` and `npm run test:e2e` (Node.js 22+). The suite starts a local fake OpenAI-compatible provider, launches OpenCode v2.2.5 in standalone mode, and uses a disposable configuration. It does **not** call external model APIs. It checks:

- `Auto` routes simple tasks to `ultra`, medium tasks to `cheap`, and complex tasks to `pricey` among `pricey`, `cheap`, `ultra`, `notools`, and `unknown` (the intentionally cheaper `notools` must be rejected).
- The configured default stays unchanged unless Auto is explicitly selected.
- A manual model selection wins and persists in the same session.
- Auto fails closed when no tool-capable model is available, with no requests reaching the provider (currently surfaced by OpenCode CLI as `UnexpectedStatus: 500`).

The test suite uses local ports 18083 and a temporary OpenCode session store. It is a functional integration test, not a quality/complexity benchmark.

## Important limitations / next verification

1. Manually test TUI `/models` selection and switching on Windows and Unix.
2. Improve the no-eligible-model error exposed by OpenCode CLI; the virtual provider must never receive requests.
3. Test cross-provider allowlists and policy enforcement with connected enterprise providers before using confidential code.
4. Test feedback slash commands and transport telemetry through TUI/session API, include failed network requests without HTTP responses, and guard simultaneous feedback writes across processes.
5. Replace cost-tier escalation with model capability/quality evidence, diversify the task-classifier training set, calibrate confidence, and evaluate multilingual ambiguous prompts.

Unit tests: `npm test` (Node.js 20+; no dependencies required for the selector).
