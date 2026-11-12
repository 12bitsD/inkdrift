# Security policy

## Supported versions

Inkdrift is at an early development stage. Security fixes are applied to the latest `main` branch and newly produced build artifacts; older builds are not maintained.

## Report a vulnerability

Use [**GitHub private vulnerability reporting**](https://github.com/12bitsD/inkdrift/security/advisories/new) when possible. Do not open a public issue containing exploit details, credentials, private prompts, or user History files.

Include the affected platform and build, a minimal reproduction, the security impact, and any suggested mitigation. You should receive an acknowledgement before maintainers investigate a fix and coordinated disclosure timeline.

## Sensitive boundaries

- API keys are encrypted with Electron `safeStorage`; never attach `settings.json` to a report.
- Renderer content is sandboxed and has no Node integration.
- Model-generated SVG is untrusted and must remain sanitized.
- Provider traffic goes to the configured OpenAI-compatible endpoint; do not submit private provider logs without redacting authorization headers and sensitive prompts.

If private reporting is unavailable, contact the repository owner through GitHub rather than posting sensitive details publicly.
