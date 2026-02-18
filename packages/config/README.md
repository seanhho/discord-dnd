# @discord-bot/config

## Overview

Environment configuration workspace with runtime validation.

## Public API

- Package entrypoint: `@discord-bot/config`
- `main`: `./dist/index.js`
- `types`: `./dist/index.d.ts`
- `exports`:
  - `.` → `import: ./dist/index.js`, `types: ./dist/index.d.ts`

## Design Notes

- Designed to centralize environment and configuration validation concerns for the monorepo.
- Built as an internal workspace package (`private: true`).

## Usage

```bash
npm run build -w @discord-bot/config
```

Import from the package root entrypoint:

```ts
import { /* exported members */ } from '@discord-bot/config';
```

## Development

- Build: `npm run build -w @discord-bot/config`
- Clean: `npm run clean -w @discord-bot/config`

## Change History

- 2026-02-18: Standardized README created.
