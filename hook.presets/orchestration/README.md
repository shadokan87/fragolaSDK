# @fragola-ai/hook-orchestration

Coordinate multiple Fragola agents through a shared orchestration hook.

## Install

```bash
npm install @fragola-ai/agent @fragola-ai/hook-orchestration
```

## Usage

```ts
import { orchestration } from "@fragola-ai/hook-orchestration";

lead.use(orchestration((leadAgent) => ({
  participants: [leadAgent, reviewer],
  flow: [[leadAgent, { to: reviewer }]],
})), "orchestration");
```