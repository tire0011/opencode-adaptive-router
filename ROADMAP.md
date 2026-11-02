# Roadmap

| Phase | Deliverable | Success criterion |
| --- | --- | --- |
| 0 — Research | Hook/API and reuse audit | Reproducible compatibility spike |
| 1 — Plugin MVP | Auto entry, live discovery, policy-safe deterministic routing | Two approved models work, manual mode unaffected |
| 2 — CPU support | Optional small local task classifier, metadata profiles | Runs with CPU only and degrades gracefully without LLM |
| 3 — Adaptive learning | Local outcome store and bandit policy | Measured benefit over fixed-model baseline |
| 4 — Advanced | Fallback, independent checks, multi-stage routing | Demonstrable reliability without excessive cost |
| 5 — Upstream | Minimal OpenCode enhancement proposal | Maintainers review tested, scoped PR |

## Open questions for the community

- Is a first-class `chat.model` selection hook planned? Can it expose the eligible connected model catalog and active session model safely?
- Is there an official way to identify organization-approved providers per workspace?
- How should per-turn switching interact with prompt caching and session continuations?
- Which neutral, verifiable outcome signals could OpenCode expose to plugins?
- Would maintainers prefer an independent plugin until performance and reliability are proven?

The roadmap is intentionally experimental: a reliable deterministic router is useful even if adaptive learning never beats a simpler baseline.
