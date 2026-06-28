---
publishDate: 2026-06-28T12:00:00Z
title: 'How Agent Memory Actually Works: Facts, Vectors, and Scoping Explained'
excerpt: Storing every chat message and hoping the model finds the right ones does not scale. Here is what actually happens inside a memory pipeline, from fact extraction to scoped vector search, and how to debug it when recall goes sideways.
category: Engineering
tags:
  - turbomem
  - agents
  - memory
  - embeddings
  - architecture
author: Arneesh
metadata:
  canonical: https://blog.turbomem.dev/how-agent-memory-actually-works-facts-vectors-and-scoping-explained
---

Most tutorials on agent memory start the same way: append every message to an array, pass that array into the next prompt, and call it a day. It works in a demo. It falls apart the moment a real user comes back for a second conversation.

The fix is not "remember harder." It is a pipeline: extract facts, embed them, store them with the right scope, and retrieve by meaning instead of by timestamp. Once you see how those pieces fit together, debugging bad recall stops feeling like guesswork.

This post walks through that pipeline in plain language, with a concrete example you can trace from chat input to stored memory to search results.

## The naive approach: why raw chat history breaks at scale

The simplest memory implementation is a transcript. Every user message and assistant reply gets pushed into an array. When the agent needs context, you slice the last N messages (or the whole thing) and stuff it into the prompt.

That feels honest. You are not losing anything. The model sees exactly what was said.

The problems show up quietly, then all at once.

**Context windows are finite.** A power user with six months of history will overflow any model. Even aggressive truncation leaves you guessing which old messages matter.

**Most messages are noise for recall.** "Thanks!" and "Can you rephrase that?" are socially useful. They are not facts you want to search for later.

**Search by recency is not search by relevance.** The user asks about their marathon training plan. The relevant detail might be buried in a conversation from three weeks ago. Taking the last 20 messages will miss it every time.

**Cost adds up.** Shipping thousands of tokens of raw history on every turn burns money and latency. You pay to re-read the same filler over and over.

Raw chat history is a great audit log. It is a poor memory system. Production agent memory almost always adds a layer that turns conversations into discrete, searchable facts.

## Fact extraction: from messages to things worth remembering

Instead of storing messages verbatim, a memory pipeline asks an LLM a different question: *What here is worth remembering?*

You feed it the recent conversation (or a summary of it). It returns structured facts: short, standalone statements that capture durable information about the user, their preferences, their goals, or their context.

### A real example

Say this exchange just happened:

```text
User: I love hiking and I'm training for a half marathon this fall.
Assistant: Nice. I'll remember your fitness goals.
User: Oh, and I'm vegetarian, so meal prep tips should skip meat.
Assistant: Got it, plant based only.
```

A fact extractor might output something like:

```json
[
  "User enjoys hiking",
  "User is training for a half marathon in fall 2026",
  "User is vegetarian and prefers plant based meal prep advice"
]
```

Notice what changed. The assistant's pleasantries are gone. The facts are written in third person so they read cleanly when injected back into a system prompt later. Two separate user messages got merged into coherent statements.

That extraction step is why memory systems feel smarter than "just save the chat." You are not asking the model to grep through transcripts. You are asking it to reason over distilled knowledge.

In [turbomem](https://turbomem.dev/), extraction runs when you call `memory.add()` with message history. The LLM decides what to keep, what to update, and what to skip. You configure the provider and model; the library handles the prompt and parsing.

The tradeoff is real: extraction costs an extra model call on write, and a bad extraction prompt can drop or distort facts. We will come back to that in the debugging section. For most agents, the write path is far less frequent than the read path, so paying once to store a clean fact beats paying on every turn to re-process raw logs.

## Embeddings: what a vector is, and why meaning beats keywords

Once you have facts, you need a way to find them later. Keyword search fails in obvious ways. The user asks "What outdoor activities am I into?" Your stored fact says "User enjoys hiking." No shared words except maybe "user," which appears in everything.

**Embeddings** solve this. An embedding model turns text into a vector: a long list of numbers that represents the *meaning* of that text in a high dimensional space. Texts with similar meaning end up with vectors that point in similar directions.

You do not need to visualize 1,536 dimensions. The intuition is enough: "hiking" and "outdoor activities" land near each other. "Favorite pizza topping" lands somewhere else entirely.

When the user asks a question, you embed the query the same way you embedded the facts at storage time. Then you run **semantic search**: find the stored vectors closest to the query vector. That is usually cosine similarity or a related distance metric in a vector index (pgvector, sqlite-vec, Upstash, and others).

Keyword search asks: *Does this string contain these tokens?*

Semantic search asks: *Which stored ideas are closest in meaning to this question?*

That is why "outdoor activities" retrieves a fact about hiking even though the words do not match. It is also why memory recall feels almost magical when it works, and confusing when it does not (more on that later).

In turbomem, each extracted fact gets embedded on write. On `memory.search()`, your query string is embedded and ranked against stored facts in the same vector space. Same model family on both sides is important; mixing embedding models between write and read is a common footgun.

## Scoping: userId, agentId, sessionId, and why isolation matters

Facts and vectors answer *what* to remember and *how* to find it. Scoping answers *who* it belongs to.

Every memory write should carry scope metadata. At minimum:

**userId** ties memories to a person or account. User A's dietary preferences must never surface in User B's session.

**agentId** separates different agents or personas inside the same product. Your sales copilot and your support copilot might share a user but should not share the same memory pool unless you want them to.

**sessionId** narrows recall to a single conversation or task. Useful for ephemeral context ("we are debugging issue #4521 in this thread") that should not pollute long term user memory.

Even in a small app with ten users, scope collisions hurt. They are subtle bugs: the agent confidently states someone else's preference, or pulls in context from a test account you forgot to filter out. Multi tenant isolation is not only for platforms with thousands of customers. It is basic hygiene the first time you have more than one userId in the same database.

turbomem applies scope filters on both write and search. When you search with `{ userId: "user_123" }`, you only get facts stored under that user. Add `agentId` or `sessionId` when you need tighter boundaries.

```typescript
await memory.add(messages, {
  userId: "user_123",
  agentId: "fitness_coach",
  sessionId: "session_abc",
});

const results = await memory.search("What are my fitness goals?", {
  userId: "user_123",
  agentId: "fitness_coach",
  limit: 5,
});
```

If recall returns nothing, the first check is almost always scope: did you write with the same ids you are searching with?

## The full pipeline: one conversation, end to end

Let us tie it together with the hiking and marathon example from earlier.

### Turn 1: the user shares preferences

**Input:** two user messages and two assistant replies about hiking, marathon training, and vegetarian meal prep.

**Step 1, extraction:** the LLM returns three facts (hiking, half marathon, vegetarian).

**Step 2, embedding:** each fact is passed through the embedding model. Three vectors are produced.

**Step 3, storage:** facts, vectors, and scope `{ userId: "user_123", agentId: "fitness_coach" }` are written to your storage adapter (PGlite, IndexedDB, etc.).

Nothing from the raw chat is stored as searchable memory unless the extractor decided it was worth keeping.

### Turn 2: a new session, weeks later

The user returns and asks: *What outdoor activities am I into?*

**Step 1, query embedding:** the question is embedded into the same vector space.

**Step 2, scoped search:** turbomem filters to `userId: "user_123"` and `agentId: "fitness_coach"`, then ranks facts by similarity to the query.

**Step 3, results:** top match: `"User enjoys hiking"`. Possibly also the marathon fact if the ranker scores it highly enough.

**Step 4, your agent:** you inject those facts into the system prompt or tool context. The model answers with grounded knowledge instead of guessing.

```typescript
const results = await memory.search("What outdoor activities am I into?", {
  userId: "user_123",
  agentId: "fitness_coach",
  limit: 3,
});

// results[0].content ≈ "User enjoys hiking"
```

That is the whole loop. Conversation in, facts out, vectors indexed, scope applied, meaning matched on the way back.

## What can go wrong (and how to debug it)

Memory pipelines fail in predictable ways. Here is a short field guide.

### Bad extraction

**Symptoms:** obvious user preferences never show up in search; contradictory facts pile up; the agent "forgets" something the user said clearly.

**Causes:** extraction model too small for nuanced input; prompt not tuned for your domain; conversation too long and the model loses detail.

**Debug:** log extracted facts on every `add()`. Read them as a human. If the facts are wrong, search cannot save you. Fix extraction first: stronger model, clearer instructions, or chunking long conversations before extraction.

### Embedding drift

**Symptoms:** recall worked last month; now similar queries return unrelated facts or empty results.

**Causes:** you changed embedding models or providers between old writes and new searches; different embedding dimensions mixed in one index.

**Debug:** treat embedding model version as schema. If you switch models, re-embed existing facts or start a fresh store. Confirm the same embedding config on `add()` and `search()`.

### Scope collisions

**Symptoms:** memories from the wrong user, agent, or session appear in results; or recall always returns empty despite data in the database.

**Causes:** mismatched `userId` / `agentId` / `sessionId` between write and read; hardcoded test ids in production; missing scope on search so you filter too aggressively or not at all.

**Debug:** log scope on write and on search in the same request trace. Compare character for character. Query your store directly and confirm rows exist under the ids you expect.

### Stale or duplicate facts

**Symptoms:** the agent says the user is training for a half marathon when they already finished it; two facts say slightly different things.

**Causes:** memory is append heavy with no update or dedup strategy; extraction creates new facts instead of revising old ones.

**Debug:** inspect fact text over time for a test user. Some systems support update or delete on individual memories; turbomem's extractor can merge and revise when configured, but you still want periodic audits for long lived users.

When recall feels broken, resist the urge to tweak the chat prompt first. Walk the pipeline backward: **search results → scope filters → stored facts → extraction output → raw messages.** The bug is almost always in one of those layers, and fixing the right one beats adding "please remember carefully" to your system prompt.

## Where to go from here

Agent memory is not magic. It is extraction, embeddings, scoping, and search, wired together so your agent remembers the right things for the right user at the right time.

If you want to run this pipeline inside a TypeScript app without operating a separate memory server, [turbomem](https://turbomem.dev/) implements exactly this flow: `init()`, `add()` with extraction, `search()` with scoped semantic recall. The [architecture guide](https://turbomem.dev/guide/architecture.html) goes deeper on each stage, and the [getting started guide](https://turbomem.dev/guide/getting-started.html) lets you store and query your first facts in a few minutes.

Questions or war stories about broken recall? Reach out on the [contact page](https://turbomem.dev/contact) or [GitHub](https://github.com/turbomem/turbomem). We are always interested in how memory behaves in the wild.
