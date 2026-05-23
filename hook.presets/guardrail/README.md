# @fragola-ai/hook-guardrail

Reusable guardrail hook presets for Fragola agents.

## Install

```bash
npm install @fragola-ai/agent @fragola-ai/hook-guardrail
```

## Usage

```ts
import { guardrail } from "@fragola-ai/hook-guardrail";

agent.use(guardrail([]), "guardrail");
```