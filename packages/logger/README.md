# @discord-bot/logger

## Overview

Structured logging utilities workspace for the Discord bot monorepo.

## Public API

- Package entrypoint: `@discord-bot/logger`
- `main`: `./dist/index.js`
- `types`: `./dist/index.d.ts`
- `exports`:
  - `.` → `import: ./dist/index.js`, `types: ./dist/index.d.ts`

## Design Notes

- Internal workspace package (`private: true`) for shared logging functionality.
- Distributed as a TypeScript-compiled module via the root export.

## Usage

```bash
npm run build -w @discord-bot/logger
```

Import from the package root entrypoint:

```ts
import { /* exported members */ } from '@discord-bot/logger';
```

## Development

- Build: `npm run build -w @discord-bot/logger`
- Clean: `npm run clean -w @discord-bot/logger`

## Change History

- 2026-02-18: Standardized README created.
