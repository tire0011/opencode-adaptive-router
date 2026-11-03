# Adaptive Router — OpenCode v2 technical spike

This directory contains a **proof of concept**, not a production-ready plugin. Tested: deterministic selector unit tests, `tsc --strict` against `@opencode/plugin` 2.2.5, and an end-to-end run in OpenCode v2.2.5 (see below).

OpenCode v2 provides native model discovery (`ctx.model.list()`), session model switching (`ctx.session.switchModel()`), prompt admission hooks and command transforms. Unlike the v1 `opencode-auto-jev` example, v2 uses `Plugin.define({ setup(ctx) })` and `plugins`, not the old `chat.message` hook or singular `plugin` config.

## What works in code

- Native connected-model inventory (no manual task/model table)
- Deterministic selection of a tool-capable, enabled model with the lowest **known** listed cost
- Default restriction to the current provider; cross-provider routing requires an explicit provider allowlist
- Session-scoped enable/disable commands\n- Experimental `Auto (Adaptive Router)` virtual entry in `/models`
- No local GPU, LLM, remote router or extra API key
- Safe fallback to the current model when no candidate qualifies

This simple selector is deliberately **not** a quality predictor. It does not classify task complexity or learn yet.

## Try in OpenCode v2.2.3

In a local clone of this repository, add the plugin path to your project `opencode.jsonc` (merge with existing config):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["./router_mvp"]
}
```

Run `opencode`, then select `Auto (Adaptive Router)` in `/models` **(experimental; E2E not yet verified)**, or execute `/adaptive-auto-on` once per session. Subsequent user prompts should be routed using the available model list. Use `/adaptive-auto-off` to stop. Inspect the OpenCode server log for `[adaptive-router] selected ...`.

**Note:** `opencode run "/adaptive-auto-on"` does **not** execute the plugin command; the text is sent to the model as an ordinary prompt. Use the interactive UI or the server API (`session.command`) instead.

**Safety:** The virtual model uses an intentionally unreachable loopback endpoint. Its prompt hook must redirect to a real eligible model before dispatch; otherwise prompt admission should fail. Do not use this virtual option with confidential code until its behavior is verified.\n\n## End-to-end verification (OpenCode v2.2.5, 2026-11-02)

Setup: local OpenAI-compatible mock provider with two models, `pricey` (cost 10) and `cheap` (cost 1); session started on `mock/pricey`; driven via `@opencode/client` against `opencode serve`.

- After `session.command("adaptive-auto-on")`, model requests went to `cheap`, the session model switched to `mock/cheap`, and the log showed `[adaptive-router] selected mock/cheap`.
- Control run without enabling: requests stayed on `pricey`.

This confirms that the `prompt` hook fires, `switchModel` works during admission, and `ModelInfo.id` is the correct value for `switchModel`. Not tested: the interactive TUI.

**Enterprise caution:** By default, only the current provider is considered. Cross-provider routing requires explicit plugin options `{ "package": "./router_mvp", "options": { "crossProvider": true, "allowedProviders": ["siemens"] } }` and must only be used when every candidate is approved for the current repository. Do not try this against confidential code until routing and policy enforcement have been verified.

If no eligible candidate has usable price metadata, the selector keeps the current model rather than guessing. Context and image-capability filtering are implemented in the selector; determining these requirements from actual user prompts remains future work.\n\n## Important limitations / next verification\n\n- **New experimental feature:** verify the virtual model appears in `/models`, redirects before any provider HTTP call, persists Auto mode across turns, and respects later manual model selection. The earlier E2E covered only the slash-command mode.\n- Model-menu selection may display the real model after routing because `switchModel` updates the active session model.

1. A global virtual `Auto` model in `/models` is **not implemented**. It requires proving the v2 virtual-provider lifecycle and avoiding a broken fallback model.
2. We must distinguish explicit user model changes from plugin selection and avoid overriding intentional manual choice.
3. Measure real model outcomes before adding learning; a cheapest-first baseline is not equivalent to an intelligent auto-router.

Unit tests: `npm test` (Node.js 20+; no dependencies required for the selector).
