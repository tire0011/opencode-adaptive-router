# OpenCode Adaptive Router

**Local-first, self-configuring model selection for OpenCode.**

> Status: **experimental alpha prototype** in [router_mvp](router_mvp/README.md), verified against OpenCode v2.2.5 with 35 passing unit tests, a local fake-provider E2E suite, and manual Windows CLI/TUI routing and feedback tests. Not validated for production or confidential workloads.

OpenCode supports many providers, but selecting the best connected model is still largely a manual decision. This project explores an opt-in **Auto** model that discovers eligible models, evaluates their capabilities, routes tasks, and improves its choices using real outcome signals.

## Try the alpha (OpenCode v2.2.5)

The tagged GitHub plugin was installed and exercised successfully on a fresh Windows VM process, without publishing to npm. In PowerShell:

```powershell
opencode plugin add 'github:tire0011/opencode-adaptive-router#v0.1.0-alpha.1::path:router_mvp'
opencode run --standalone --model adaptive-router/auto "Reply with exactly OK."
```

The `plugin add` command registers the GitHub package in your global `opencode.json`. Configure your real model provider separately. For enterprise use, restrict the plugin with an explicit `allowedModels` list (example in [router_mvp/README.md](router_mvp/README.md)); never assume automatic routing is an organizational policy boundary. Use `--standalone` for the verified CLI path; background-service mode has not yet been validated.

This is a **source-only GitHub pre-release**, not an npm package. Known limitations include uncalibrated task classification, provisional unpriced-model profiles and no automatic retry of the same failed request. See the [alpha release](https://github.com/tire0011/opencode-adaptive-router/releases/tag/v0.1.0-alpha.1) for details.

## Principles

- **Prefer measured model strengths.** Discover available models; temporary profiles for three approved unpriced Siemens models are explicitly experimental until comparative evidence replaces them.
- **CPU-first.** No GPU is required. A quantized small local language model may help classify ambiguous tasks, but the router must also run without any local LLM.
- **Local-first and private.** Discovery, metrics, policy checks and learning stay local. Never send prompts or source code to a third-party routing service by default.
- **Respect provider boundaries.** Only route to connected and explicitly allowed providers. Enterprise restrictions must override adaptive decisions.
- **Evidence over guesses.** Prefer verified builds/tests and observed outcomes; treat public benchmarks and LLM judgments as uncertain priors.
- **Opt-in and explainable.** Changing the active model should only occur in Auto mode. Explain why a candidate was selected and provide a simple manual override.
- **Low overhead.** Fast, deterministic selection for ordinary tasks; optional lightweight CPU classification only when useful.
- **No hidden spending.** Routing experiments, profiling calls and optional provider inference require budgets/consent.

## Proposed operation

1. Select `Adaptive Auto` in OpenCode.
2. Discover connected models and capability metadata.
3. Filter by permissions, modality, tool requirements, context size, provider health and budget.
4. Estimate task characteristics locally.
5. Choose among eligible models using an uncertainty-aware adaptive policy.
6. Record outcome signals, without retaining prompts or source files by default.
7. Update local estimates and show the selected model and reason.

The first milestone targets **one model per user turn**. Within-task routing, multi-model verification, and retry-based escalation are later research milestones.

## Project documents

- [PLAN.md](PLAN.md) — implementation sequence, acceptance criteria and task backlog.
- [ARCHITECTURE.md](ARCHITECTURE.md) — plugin mechanics, data flows, security and learning design.
- [ROADMAP.md](ROADMAP.md) — phased milestones and upstream integration.
- [CONTRIBUTING.md](CONTRIBUTING.md) — collaboration and research guidelines.

## Related work

- [opencode-auto-jev](https://github.com/jorgefspereira/opencode-auto-jev): MIT-licensed virtual Auto provider and per-turn `chat.message` routing. We intend to review and potentially adapt its **plugin mechanics** with attribution, not its external TypeSafe AI routing dependency.
- [OpenCode issue #8456](https://github.com/anomalyco/opencode/issues/8456): model selection by task type (closed as duplicate).
- [OpenCode issue #32736](https://github.com/anomalyco/opencode/issues/32736): automatic model selection (closed as duplicate of #8456).
- [OpenCode issue #51362](https://github.com/anomalyco/opencode/issues/51362): OpenCode Go auto model selector (closed).
- [OpenCode issue #22043](https://github.com/anomalyco/opencode/issues/22043): model-switching API proposal.

We welcome discussion about OpenCode plugin hooks, model discovery, outcome measurement, privacy, and whether a well-tested prototype could eventually be integrated upstream.

## License

MIT; see [LICENSE](LICENSE). Third-party code, if adopted, must retain its own copyright and license notices.

## OpenCode v2 integration update (2026-11-02)

[PR #49194](https://github.com/anomalyco/opencode/pull/49194) is merged: OpenCode v2 offers `opencode.models()` for searchable connected model metadata and an optional `model` parameter on the subagent tool. Explicit subagent model selection overrides the agent's configured model and the parent model. [Issue #6651](https://github.com/anomalyco/opencode/issues/6651) is closed.

**We will reuse these native facilities rather than reimplement subagent model selection.** The remaining research is whether a local adaptive policy can improve choice quality, cost and latency from measured outcomes, and how a first-class `Auto` option should select the *primary* model. Built-in discovery and model selection do not themselves establish outcome-based learning.
