# GridTrade Mockup Sandbox

This workspace contains design prototypes, UI mockups, and sandbox components for GridTrade's frontend user interface.

## Purpose

The Mockup Sandbox serves as an isolated playground for design experimentation, visual testing, and prototyping UI components before integrating them into `@workspace/gridtrade-web`.

## Features

- **Isolated Vite Environment**: Prototyping without API/backend dependencies.
- **Tailwind CSS & Component Primitives**: Rapid UI composition.
- **Mockup Preview Plugin**: `mockupPreviewPlugin.ts` provides hot-reloading preview capabilities for component variations.

## Usage

To start the mockup sandbox development server:

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

To build the sandbox distribution bundle:

```bash
pnpm --filter @workspace/mockup-sandbox run build
```
