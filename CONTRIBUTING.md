# Contributing to Inkdrift

Thanks for helping improve the visual canary. The project values small, inspectable changes over new frameworks or benchmark machinery.

## Before you start

- Search existing issues before opening a duplicate.
- For a behavior change, describe the user problem and the intended boundary first.
- Keep the product contract intact: no IQ score, automatic degradation verdict, or model ranking.
- Never include API keys, private prompts, or personal History files in an issue or pull request.

## Set up

Requirements: Node.js 22+, pnpm 12.5.1, and Python 3.11.

```bash
pnpm install
python3.11 -m venv .venv
.venv/bin/python -m pip install -e 'worker[dev,build]'
# Windows: .venv/Scripts/python -m pip install -e 'worker[dev,build]'
pnpm dev
```

## Make a change

1. Create a focused branch from `main`.
2. Follow the existing TypeScript, React, and Python idioms. Do not add dependencies for conveniences already available in the project or platform.
3. Preserve the trust boundaries: API keys stay in Electron main, IPC input is validated, and SVG remains sanitized.
4. Update documentation when behavior or setup changes.
5. Exercise the original user scenario, not only imports or compilation.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm peers check
.venv/bin/python -m mypy worker/src
.venv/bin/python -m ruff check worker
.venv/bin/python -m ruff format --check worker
```

Use a loopback mock provider for generation checks. Do not put real credentials in commands, screenshots, fixtures, or logs. Clean up synthetic History records and temporary services when finished.

## Pull requests

Explain the user-visible change, the verification performed, and any remaining limitations. Include before/after screenshots for visual changes. Keep unrelated cleanup out of the patch.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
