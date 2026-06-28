---
publishDate: 2026-06-28T00:00:00Z
title: Why Your TypeScript Agent Doesn't Need a Memory Server
excerpt: Most agent memory stacks assume you want another service in the loop. If you are building in TypeScript, that assumption costs you latency, dependencies, and operational overhead you may not need.
category: Product
tags:
  - turbomem
  - typescript
  - agents
  - memory
author: Arneesh
metadata:
  canonical: https://blog.turbomem.dev/why-your-typescript-agent-doesnt-need-a-memory-server
---

If you are building an AI agent in TypeScript, you have probably been told that memory is a separate problem. Spin up a vector database. Run a Python sidecar. Sign up for a hosted memory platform. Wire your agent to it over HTTP and hope the network stays fast enough that recall does not feel sluggish.

That stack works for a lot of teams. It is also not the only way to give an agent a memory.

We built [turbomem](https://turbomem.dev/) because we wanted persistent, searchable memory inside a TypeScript process: `npm install`, call `init()`, store facts, search them later. No extra server process. No Python runtime in your deployment graph. This post is the story behind that choice, and when a server based approach still makes sense.

## The standard agent memory stack

Tools like mem0, Zep, and hosted vector offerings have shaped what people expect from agent memory. The pattern is familiar:

1. Your agent runs in one language or runtime.
2. Memory lives somewhere else: a Python service, a managed API, or a vector database you operate yourself.
3. Every recall and every write crosses a network boundary.

That separation is not accidental. These systems were designed to be shared infrastructure: one memory layer for many clients, often across languages, with a team operating the backing store.

The tradeoffs show up quickly in a TypeScript app:

**Extra infrastructure.** You are not just shipping your agent. You are shipping or subscribing to something else that must stay up, stay patched, and stay compatible with your app releases.

**Python in the loop.** A large slice of the memory ecosystem is Python first. TypeScript teams often end up bridging runtimes, containerizing another service, or paying for a hosted tier to avoid that work.

**Latency on every memory call.** Search and store are not local function calls. They are HTTP requests. In a tight agent loop where the model reasons, recalls context, acts, and recalls again, those hops add up. They also fail in ways local code does not: timeouts, rate limits, regional outages.

**Operational surface area.** Backups, scaling, auth between services, and schema migrations on a remote store all become your problem unless you buy managed hosting.

None of this is wrong if you need a shared memory platform. It is a lot to accept if your product is a TypeScript application that only needs memory for its own users.

## Why TypeScript developers get a raw deal

The agent boom landed hard on Python. Notebooks, research code, and early frameworks set the tone. Memory libraries followed that gravity.

If you live in Node, Bun, or the browser, the default path often looks like this: find a memory product with a REST API, wrap it in your own client, or run a Python service beside your TypeScript app and treat memory as a remote dependency.

That is a strange place to be when the rest of your stack is already TypeScript. Your types do not cross the wire cleanly. Your deployment story gets heavier. Your local dev environment needs more moving parts before you can test a single conversation loop.

You also miss something subtler: **memory as a library**. In a product embedding an agent, memory is often a feature of the app, not a platform you are building. You want it to behave like any other dependency: install it, configure it, call it in process, ship it.

That is the gap turbomem is aimed at.

## What "local first" actually means for memory

"Local first" is easy to misread as "only on your laptop." For turbomem it means something more specific:

**Same process.** Memory runs inside your Node, Bun, or browser runtime. Initialization, extraction, embedding, and search happen without delegating to a sidecar.

**No network hop for the hot path.** When your agent searches memory during a turn, that work is local by default. PGlite with pgvector on disk, IndexedDB in the browser, or Upstash over HTTP when you are on edge are storage adapters, not a separate memory server you operate.

**npm install and done.** The default stack uses OpenAI for embeddings and extraction plus PGlite for storage. PGlite ships as a dependency. You set an API key, call `init()`, and you are writing memories.

The pipeline is straightforward: conversation goes in, an LLM extracts discrete facts, those facts get embedded and stored with scope metadata, and search embeds your query and returns ranked matches filtered by user, agent, or session.

That model is different from "run a memory platform and point clients at it." It is closer to how you would use any other serious TypeScript library in production.

## Before and after: mem0 style setup vs turbomem

Fair comparison requires context. mem0 is a strong option when you want a dedicated memory service, multi language clients, or a hosted platform with ops taken off your plate. The snippets below are illustrative of the *shape* of each approach, not a benchmark.

### Typical server oriented path

With a hosted or self hosted memory service, your TypeScript app is a client. You configure endpoints and keys, then call out on every operation:

```typescript
// Conceptual: remote memory client in your agent
const memoryClient = createRemoteMemoryClient({
  apiKey: process.env.MEMORY_API_KEY,
  baseUrl: process.env.MEMORY_API_URL,
});

await memoryClient.add(messages, { userId: "user_123" });

const results = await memoryClient.search("What does the user care about?", {
  userId: "user_123",
});
```

Behind that client you are still responsible for whatever runs at `MEMORY_API_URL`: containers, health checks, networking, and often a Python stack if you are self hosting common open source memory tooling.

### Embedded path with turbomem

With turbomem, memory is constructed and used inside your application:

```typescript
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4.1-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
  pglite: { dataDir: ".turbomem" },
});

await memory.init();

await memory.add(
  [
    { role: "user", content: "I love hiking and I'm training for a half marathon this fall." },
    { role: "assistant", content: "Nice. I'll remember your fitness goals." },
  ],
  { userId: "user_123" },
);

const results = await memory.search("What outdoor activities is the user into?", {
  userId: "user_123",
  limit: 5,
});

await memory.close();
```

Same outcome: facts extracted, stored, searchable by meaning. Different deployment story: one process, one dependency tree, one place to debug when recall looks wrong.

## When a server based approach still makes sense

We are not here to tell you that remote memory is always wrong. It is often the right call.

**Cross language teams.** If Python agents, mobile clients, and internal tools all need the same memory store with one operational model, a centralized service is a feature, not a burden.

**Managed infrastructure.** If your priority is to buy uptime, compliance, and scaling instead of operating vector storage, hosted memory platforms earn their price.

**Multi tenant platforms.** If you are building memory as the product, with billing, isolation, and SLAs across many customers, you are building a platform. A library embedded in each customer's app is not the same job.

**Heavy governance workflows.** Some teams need centralized audit, retention policies, and admin tooling that assume a shared backend.

turbomem is optimized for a different job: TypeScript products that need memory as a capability inside the app. Local first by default, browser and edge capable, strict types at the boundary, adapters when you need sqlite-vec, Upstash, Mastra, or the Vercel AI SDK.

If that sounds like your stack, the overhead of a memory server may be solving a problem you do not have.

## Get started

The fastest way to see how embedded memory feels in your own agent is to run through the [getting started guide](https://turbomem.dev/guide/getting-started.html): install the package, set your OpenAI key, call `init()`, and store your first scoped memories.

From there, the [configuration guide](https://turbomem.dev/guide/configuration.html) covers embeddings, extraction, and scoping, and the [architecture overview](https://turbomem.dev/guide/architecture.html) walks through the full pipeline.

If you have questions or feedback, reach out on the [contact page](https://turbomem.dev/contact) or email [arneesh@turbomem.dev](mailto:arneesh@turbomem.dev). We are building turbomem in the open on [GitHub](https://github.com/turbomem/turbomem).
