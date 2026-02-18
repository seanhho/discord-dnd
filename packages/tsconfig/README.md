# @discord-bot/tsconfig

## Overview

Shared TypeScript configuration workspace for monorepo packages.

## Public API

- Package: `@discord-bot/tsconfig`
- Published files: `base.json`
- No runtime JavaScript exports (`main`, `types`, `exports`, and `bin` are not defined).

## Design Notes

- Centralizes TypeScript compiler options for consistent configuration across workspaces.
- Internal workspace package (`private: true`).

## Usage

Consume the shared configuration from workspace TypeScript configs.

## Development

- Update `base.json` in this workspace as needed.

## Change History

- 2026-02-18: Standardized README created.
