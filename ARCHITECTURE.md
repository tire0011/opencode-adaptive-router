# Architecture (proposed)

## Components

1. **OpenCode adapter** — registers a virtual Auto selection and intercepts only Auto-mode turns.
2. **Discovery** — reads current provider/model availability and capabilities through supported interfaces.
3. **Policy filter** — enforces configured destinations, workspace and organization restrictions, privacy rules, modality/tools/context requirements, and spend limits.
4. **Task features** — lightweight local deterministic features; optional CPU-only LLM classifier with schema-validated output.
5. **Selector** — ranks eligible models under uncertainty, with cold-start priors and explicit exploration budgets.
6. **Dispatcher** — changes the selected model for the current user turn, without misrepresenting persistent session state.
7. **Outcomes** — records timing, rate-limit and tool results, and verified signals (tests/builds) when safely attributable.
8. **Learning store** — local, versioned, compact metrics and adaptive parameter estimates.

## Proposed request path

`Auto selected → discover → enforce policy → extract task features → score candidates → dispatch → collect observable outcomes → update estimates`.

The policy filter runs **before** any optional classifier request or model dispatch. A classifier using a connected provider must itself be in the approved destination set; no automatic external classifier fallback.

## What does not need an LLM

Provider discovery, config validation, policy enforcement, feature extraction from non-sensitive metadata, scoring, bandit parameter updates, success-rate estimation, test-result parsing and statistics.

An optional small CPU model can improve ambiguous natural-language task classification. Initial candidates should be tested for memory footprint and latency; no specific model is guaranteed suitable before benchmarking. Keep prompts short, and use a timeout + deterministic fallback.

## Cold start and learning

- No fixed `coding → model X` mapping. Start with observable capabilities and modest priors.
- Eligibility is a hard filter; quality, latency and cost are weighted preferences.
- Explore only among approved candidates, with bounded frequency and cost.
- Track model identity *and revision*, task features, sample counts and uncertainty.
- Distinguish signals: compilation succeeds, tests pass, requested behavior verified, model self-reports success, user accepts result. They are not equivalent.
- Avoid feedback loops: a model generating its own tests cannot alone establish correctness.
- Evaluate adaptive selection against fixed-model and random-eligible baselines on a held-out task set.

## Privacy and security

- Default: no persistent prompt text, source code, filenames, secrets or raw tool output.
- Local metrics store with retention, export and deletion controls.
- Network egress only to the connected model selected for an allowed OpenCode task; optional classifiers and profiling require explicit consent.
- Do not mix personal credentials with enterprise repositories where policy prohibits them.
- Never infer that a connected provider is authorized for every project.
- Treat model metadata and plugin inputs as untrusted; validate IDs and errors.
- Plugin is opt-in and leaves manual model selection unchanged.

## Integration risk

The community [opencode-auto-jev](https://github.com/jorgefspereira/opencode-auto-jev) demonstrates a virtual model via the `config` hook and a per-turn `chat.message` model override. Its external routing is not part of this design. Current hooks might not persist a model switch or update the UI's active model; test explicitly, avoid relying on undocumented state mutation, and discuss a native model-routing hook upstream if necessary.

### Reuse policy

Copy only code verified against current upstream APIs. Keep required MIT copyright/license notices and cite the original project. A clean, minimal adapter may be simpler than importing an external router or inheriting its service dependency.
