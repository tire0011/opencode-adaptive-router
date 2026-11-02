# Implementation Plan

This is a living plan, not a claim that any feature is implemented. Work should be delivered in small, testable PRs.

## Milestone 0 — Research and contracts

- [ ] Record the supported OpenCode version range and validate actual hook signatures against its source and tests.
- [ ] Review `opencode-auto-jev` source, tests and MIT attribution requirements; identify minimal reusable code.
- [ ] Confirm whether a virtual `adaptive-auto/auto` model is feasible in current OpenCode without changing session state incorrectly.
- [ ] Determine the safe source of **connected** provider/model inventory, including project enablement and enterprise constraints.
- [ ] Establish a threat model: routing prompt leakage, cross-provider data transfer, local file access, secrets, poisoned metadata, telemetry.
- [ ] Define graceful behavior when OpenCode changes plugin APIs.

**Exit:** documented API contracts, compatibility test, license audit and minimal spike.

## Milestone 1 — Minimal usable plugin

- [ ] TypeScript package, formatting, type checking, unit tests and CI.
- [ ] Register `Adaptive Auto` alias in model picker without replacing existing configuration.
- [ ] Route current user turn via documented plugin hook; manually selected models remain untouched.
- [ ] Discover connected eligible models automatically; never invent or assume credentials.
- [ ] Strict policy filter for provider allowlist, tools, modalities, context, availability and known restrictions.
- [ ] A deterministic, explainable baseline selector with no LLM, GPU, model mapping or external router.
- [ ] Visible selected-model notification, reason and manual override.
- [ ] Fallback for discovery failure; never silently route to an unapproved provider.
- [ ] Offline tests for no models, one model, model unavailable, modality mismatch, policy denial, and plugin hook errors.

**Exit:** users can select Auto and get a working, policy-safe single-turn choice with zero manual task-to-model mappings.

## Milestone 2 — Profiling and CPU classification

- [ ] Normalize provider/model metadata; source provenance and freshness for each capability.
- [ ] Optional lightweight CPU GGUF classifier (llama.cpp or a compatible local endpoint); validate model and memory requirements with benchmarks.
- [ ] No-local-LLM mode remains fully functional; optional explicitly authorized connected classifier.
- [ ] Structured classification output with schema validation, timeouts, confidence and deterministic fallback.
- [ ] Opt-in synthetic proficiency probes; avoid customer code, cap call counts and costs.
- [ ] Confidence-aware priors from benchmark/metadata sources, never treated as verified task performance.

**Exit:** task classification works on commodity CPU machines; no GPU or extra cloud account required.

## Milestone 3 — Outcome-based learning

- [ ] Local storage schema (SQLite candidate; assess Node/Bun runtime portability before committing).
- [ ] Record task category, chosen model, latency, cost estimate, errors, timeouts and tool/verification outcomes.
- [ ] Add opt-in integrations for build/test outcomes; explicit attribution of outcome to each attempt.
- [ ] Handle missing, ambiguous, noisy or user-aborted outcomes as unknown — never automatic failure/success.
- [ ] Adaptive policy prototype (e.g., contextual bandit with bounded exploration), calibrated uncertainty and cold-start behavior.
- [ ] Drift handling, model/version changes, data reset/export and retention controls.
- [ ] Compare against fixed-model and simple routing baselines on held-out tasks.

**Exit:** demonstrated improvement on predefined quality/cost/latency metrics without violating configured budgets.

## Milestone 4 — Advanced orchestration

- [ ] Rate-limit-aware fallback with context and cache-cost accounting.
- [ ] Within-task specialist selection and optional independent verification, if upstream APIs allow it.
- [ ] Better local model discovery, feedback UX and policy administration.
- [ ] Cross-project transfer of aggregate metrics only when explicitly permitted.
- [ ] Prepare upstream proposal with data, compatibility evidence and a small core API change request if needed.

## Backlog / candidate GitHub issues

1. Research current OpenCode plugin API and virtual model lifecycle.
2. Audit reusable MIT code from `opencode-auto-jev`.
3. Implement project-scoped connected model discovery.
4. Implement permission and capability filters.
5. Implement deterministic cold-start selector.
6. Build Auto virtual provider and per-turn dispatch.
7. Add offline test harness and CI.
8. Implement privacy-preserving metrics schema.
9. Prototype CPU classifier with benchmark results.
10. Evaluate contextual bandit against baselines.
11. Document model-change semantics and propose upstream compatibility hook.

## Validation strategy

Unit tests for policy and scoring; fixture-based plugin API tests; optional integration tests against a local mock OpenAI-compatible server; manual smoke tests with two real approved providers; benchmark reports showing cost, p50/p95 latency and verified success with confidence intervals.

The project must **never run real provider profiling automatically on install**. All paid or data-bearing probes are opt-in.

## OpenCode v2 discovery — update 2026-11-02

[PR #49194](https://github.com/anomalyco/opencode/pull/49194) has merged into v2. It provides searchable `opencode.models({ query?, provider?, all?, limit?, offset? })` metadata and an optional subagent `model` override; [#6651](https://github.com/anomalyco/opencode/issues/6651) is closed.

The first tasks must therefore change:

- [ ] Verify the `opencode.models()` and `subagent(model)` APIs on a pinned v2 release and determine whether they are exposed directly to plugins or only agent tools.
- [ ] Prototype using native model discovery rather than maintaining a separate provider catalog.
- [ ] Measure how often the primary agent already selects a good subagent model, creating a baseline before implementing another router.
- [ ] Identify the missing *primary-session* Auto model and outcome-learning functionality separately from subagent delegation.
- [ ] Only implement a virtual Auto model or model interception if the existing v2 mechanisms do not cover the MVP.

**Architecture decision:** do not rebuild model discovery or subagent switching. Focus on local evaluation, adaptive ranking and privacy-safe feedback. Preserve the no-GPU/no-local-LLM baseline.
