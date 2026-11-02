# Adaptive Router — OpenCode v2 technical spike

This directory contains a **proof of concept**, not a production-ready plugin. Tested: deterministic selector unit tests. **Not yet smoke-tested inside a running OpenCode v2.2.3 instance.**

OpenCode v2 provides native model discovery (`ctx.model.list()`), session model switching (`ctx.session.switchModel()`), prompt admission hooks and command transforms. Unlike the v1 `opencode-auto-jev` example, v2 uses `Plugin.define({ setup(ctx) })` and `plugins`, not the old `chat.message` hook or singular `plugin` config.

## What works in code

- Native connected-model inventory (no manual task/model table)
- Deterministic selection of a tool-capable, enabled model with the lowest **known** listed cost
- Default restriction to the current provider; cross-provider routing is explicit opt-in
- Session-scoped enable/disable commands
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

Run `opencode`, then execute `/adaptive-auto-on` once per session. Subsequent user prompts should be routed using the available model list. Use `/adaptive-auto-off` to stop. Inspect the OpenCode server log for `[adaptive-router] selected ...`.

**Enterprise caution:** By default, only the current provider is considered. Cross-provider routing requires an explicit plugin option `{ "package": "./router_mvp", "options": { "crossProvider": true } }` and must only be used when every candidate is approved for the current repository. Do not try this against confidential code until routing and policy enforcement have been verified.

## Important limitations / next verification

1. Verify v2.2.3 actually invokes the `prompt` hook and permits `switchModel` during admission; test model dispatch, not only the logged choice.
2. Verify `Session.Info.model` and the model registry result types against installed SDK declarations; adjust before shipping.
3. A global virtual `Auto` model in `/models` is **not implemented**. It requires proving the v2 virtual-provider lifecycle and avoiding a broken fallback model.
4. We must distinguish explicit user model changes from plugin selection and avoid overriding intentional manual choice.
5. Measure real model outcomes before adding learning; a cheapest-first baseline is not equivalent to an intelligent auto-router.

Unit tests: `npm test` (Node.js 20+; no dependencies required for the selector).
