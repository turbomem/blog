---
publishDate: 2026-07-12T00:00:00Z
title: 'Choosing a Storage Backend for TurboMem: PGlite, sqlite-vec, and the Edge'
excerpt: TurboMem asks you to make one real decision when you set it up i.e storage. Where your vectors and facts live depends almost entirely on where your code runs, and the adapters are built around that difference.
image: ~/assets/blogs/choice.jpg
category: Engineering
tags:
  - turbomem
  - storage
  - pglite
  - sqlite-vec
  - upstash
author: Arneesh Aima
metadata:
  canonical: https://blog.turbomem.dev/choosing-a-storage-backend-for-turbomem-pglite-sqlite-vec-and-the-edge
---

[turbomem](https://turbomem.dev/) asks you to make one real decision when you set it up. Everything else has a sane default. That one decision is storage. Where do the vectors and facts actually live once they're written?

The answer depends almost entirely on where your code runs. A Node process, a browser tab, and a Cloudflare Worker all have different relationships with the filesystem, and turbomem's storage adapters are built around that difference instead of pretending it doesn't exist. This post walks through the options and when each one actually makes sense.

## The three environments, and why they need different storage

Before comparing adapters, it helps to name the constraint each runtime puts on you.

A **Node or Bun process** has a real filesystem. It can write files, keep a process alive, and hold state in memory between requests. This is the easy case.

A **browser tab** has no filesystem access at all. The only thing it can reliably persist to is IndexedDB, and even that comes with quirks around private browsing and storage eviction.

An **edge runtime**, like a Cloudflare Worker or Vercel Edge function, is stateless by design. There's no disk, and the process itself might not even survive between requests. Anything you want to keep has to live somewhere external that you reach over the network.

turbomem has a storage adapter for each of these, and picking the wrong one for your runtime doesn't just perform badly. It usually throws a `ConfigError` at `init()` before you get anywhere near production.

## PGlite: the default, and the right call for Node

If you install turbomem and don't configure storage at all, you get PGlite. It's a WASM build of Postgres that runs inside your own process, no external database required.

```typescript
import { TurboMemory } from 'turbomem';

const memory = new TurboMemory({
  embeddings: 'openai',
  storage: 'pglite',
  extraction: { provider: 'openai', model: 'gpt-4.1-mini' },
  openai: { apiKey: process.env.OPENAI_API_KEY },
  pglite: { dataDir: '.turbomem' },
});

await memory.init();
```

On Node or Bun, `dataDir` points to a folder on disk. Facts and their vectors get written there, and pgvector handles the similarity search locally. There's no separate service to run, no connection string to manage, and no network hop between your app and its own memory.

This is also the same adapter that powers turbomem in the browser, just pointed at `idb://` instead of a disk path. If you've read about running turbomem client side, you've already seen this adapter at work. The point worth repeating here is that PGlite isn't a browser-only trick. It's the default for server-side TypeScript apps too, and for most single-process apps it's genuinely the right amount of infrastructure: none.

## sqlite-vec: a lighter option for Node and Bun

PGlite ships a full WASM Postgres. That's convenient, but it's not free. It's a several-megabyte binary, and it's more database than some apps need.

For Node and Bun apps that want something smaller, turbomem also supports `sqlite-vec` as a storage preset. It's a SQLite-based alternative for local, disk-backed storage. Where PGlite gives you a real Postgres instance with pgvector, sqlite-vec gives you a lighter embedded option built on SQLite's vector search extension.

The tradeoff is roughly what you'd expect. SQLite is simpler and smaller. Postgres, even a WASM build of it, gives you a more familiar query surface if you ever want to reach into the store directly. Neither one requires you to run a separate process, which is the property that actually matters most of the time. If you're picking between the two, it usually comes down to how much you care about binary size versus how much you might want Postgres-specific tooling later.

## Upstash Vector and Pinecone: what actually works on the edge

Edge runtimes change the question entirely. There's no disk to write to, so neither PGlite nor sqlite-vec is an option there. Trying to configure one throws a `ConfigError` at `init()` rather than failing silently later.

Instead, edge deployments use a hosted vector store reached over HTTP. turbomem supports Upstash Vector and Pinecone as presets for this. Both are external services with their own account and API key, and both are built for the request-scoped, stateless nature of edge functions. Every read and write is a network call, which is a real difference from PGlite's local search, but it's also the only shape of storage that actually fits a runtime that might not exist a second after your function returns.

If you're deploying to Cloudflare Workers or Vercel Edge, this isn't really a choice between "fast local storage" and "slower hosted storage." Local storage isn't on the table at all. The choice is closer to picking which hosted vector provider fits the rest of your infrastructure, since both are documented storage presets for that environment.

## A simple way to decide

You mostly don't need to weigh all four options against each other. The runtime you're deploying to already narrows it down:

**Browser app (React, Vue, a Chrome extension):** PGlite with an `idb://` path. Nothing else is available there.

**Node or Bun backend, single process, memory should just work:** PGlite on disk. This is the default for a reason.

**Node or Bun backend, and you want the smallest possible footprint:** sqlite-vec is worth a look.

**Cloudflare Workers, Vercel Edge, or another stateless runtime:** Upstash Vector or Pinecone. Local storage isn't an option here regardless of preference.

## Dimensions are still tied to the store either way

One thing holds true across every adapter. The vector dimension gets fixed the first time you call `init()` against a given store, whether that store is a local PGlite folder, a SQLite file, or a namespace in a hosted vector database. Switch your embedding model later and you'll hit a dimension mismatch on the next write. The fix is always the same: start a fresh store rather than trying to migrate an old one in place.

It's worth treating your embedding model choice as something you settle early, alongside your storage choice, rather than something you expect to swap freely down the line.

## Where to go from here

Storage is the one setup decision in turbomem that's actually tied to where your code runs rather than personal preference. Once you know your runtime, the choice mostly makes itself. The [storage guide](https://docs.turbomem.dev/guide/storage) has the full adapter reference if you want the exact config shape for sqlite-vec, Upstash Vector, or Pinecone, and the [architecture guide](https://docs.turbomem.dev/guide/architecture) covers how storage fits into the rest of the extraction and search pipeline.

If you've run into a storage question this post didn't answer, reach out on the [contact page](https://turbomem.dev/contact) or [GitHub](https://github.com/turbomem/turbomem).
