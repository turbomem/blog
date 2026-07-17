---
publishDate: 2026-07-03T12:00:00Z
title: 'Building a Personal Assistant That Remembers You'
excerpt: >-
  A walkthrough of the turbomem Next.js starter: a production shaped chat app
  where the assistant recalls facts across sessions, with a visible memory panel
  and Vercel AI SDK streaming.
image: ~/assets/blogs/memory.jpg
category: Tutorial
tags:
  - turbomem
  - nextjs
  - vercel-ai
  - tutorial
  - agents
author: Arneesh Aima
metadata:
  canonical: https://blog.turbomem.dev/building-a-personal-assistant-that-remembers-you
---

Most chat demos forget everything the moment you refresh the page. That is fine for a screenshot. It is not fine for a product.

This post walks through [Assistant](https://github.com/turbomem/turbomem-nextjs-starter), a Next.js chat app built with [turbomem](https://turbomem.dev) and the [Vercel AI SDK](https://sdk.vercel.ai). The assistant remembers facts about you across browser sessions, server restarts, and Vercel deploys. A memory panel on the side shows exactly what it knows, so recall is never a black box.

The full starter is on GitHub: [github.com/turbomem/turbomem-nextjs-starter](https://github.com/turbomem/turbomem-nextjs-starter). We will go through the architecture, the memory pipeline, and the code that wires it together.

## What we are building

Assistant is a two panel layout: chat on the left, stored memories on the right. On mobile, the memory panel slides in from the side.

The product behavior is deliberate:

**Long term memory persists.** Facts extracted from conversation are stored in Upstash Vector and survive refresh, redeploy, and cold starts on Vercel.

**Chat history does not persist.** Each page load starts a fresh conversation thread. The assistant still knows who you are because memories are separate from the transcript.

**Memory is visible.** Users can read every stored fact and clear them with one button. Trust comes from transparency, not from hidden state.

**It feels like a real app.** Streaming responses, dark mode, responsive layout, and polished empty states. Not a single file hackathon demo.

## Architecture at a glance

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │  Chat (useChat)      │  │  MemoryPanel                │  │
│  │  POST /api/chat      │  │  GET /api/memories          │  │
│  └──────────┬───────────┘  └──────────────┬──────────────┘  │
└─────────────┼─────────────────────────────┼──────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js API Routes (Node.js runtime)                        │
│  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │  /api/chat           │  │  /api/memories              │  │
│  │  streamText + tools  │  │  getAll / deleteAll         │  │
│  └──────────┬───────────┘  └──────────────┬──────────────┘  │
└─────────────┼─────────────────────────────┼──────────────────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  TurboMemory (turbomem)       │
              │  extract → embed → store      │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  Upstash Vector               │
              └──────────────────────────────┘
```

Every memory operation runs inside your Next.js process. turbomem handles extraction, embedding, and scoped search. Upstash Vector holds the vectors so memories survive serverless.

## Project setup

Clone the starter and install dependencies:

```bash
git clone https://github.com/turbomem/turbomem-nextjs-starter.git
cd turbomem-nextjs-starter
npm install
```

Copy the environment template and add your keys:

```bash
cp .env.local.example .env.local
```

You need three variables:

```bash
OPENAI_API_KEY=sk-...
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=...
```

Create an [Upstash Vector](https://console.upstash.com) index with **1536 dimensions** (OpenAI embeddings) and **Cosine** similarity. Paste the REST URL and token into `.env.local`.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Tell the assistant something about yourself, refresh the page, and ask it to recall what you shared. The fact should still be there.

## Dependencies

The starter pulls together four pieces that matter for memory:

```json
{
  "dependencies": {
    "turbomem": "^0.7.1",
    "@turbomem/vercel-ai": "^0.2.11",
    "ai": "^3.4.33",
    "@ai-sdk/openai": "^0.0.66"
  }
}
```

**turbomem** is the memory engine: fact extraction, embeddings, scoped vector search.

**@turbomem/vercel-ai** exposes `rememberFact` and `recallMemories` as tools the model can call during a turn.

**ai** and **@ai-sdk/openai** handle streaming chat via `useChat` on the client and `streamText` on the server.

## Step 1: Initialize memory

Serverless functions can spin up fresh on every request, so we need a singleton that initializes once and reuses the same `TurboMemory` instance. That lives in `lib/memory.ts`:

```typescript
import { TurboMemory } from 'turbomem';

let instance: TurboMemory | null = null;
let initPromise: Promise<TurboMemory> | null = null;

export async function getMemory(): Promise<TurboMemory> {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = (async () => {
      const memory = new TurboMemory({
        embeddings: 'openai',
        storage: 'upstash-vector',
        extraction: { provider: 'openai', model: 'gpt-4.1-mini' },
        openai: { apiKey: process.env.OPENAI_API_KEY },
        upstashVector: {
          url: process.env.UPSTASH_VECTOR_REST_URL!,
          token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
        },
      });
      await memory.init();
      instance = memory;
      return memory;
    })();
  }
  return initPromise;
}
```

A few details worth noting:

**Upstash Vector for production.** PGlite works well locally, but serverless needs external storage. Upstash Vector is HTTP based, so it works on Vercel without managing a database server.

**Extraction on write.** When you call `memory.add()`, turbomem runs an LLM pass to pull discrete facts out of the conversation. You configure the model here; the library handles the prompt.

**Singleton pattern.** Without this, every API call would call `init()` again. The promise guard ensures concurrent requests share one initialization.

Environment validation is centralized in `lib/env.ts` so both API routes fail fast with a clear error:

```typescript
const REQUIRED_ENV = ['OPENAI_API_KEY', 'UPSTASH_VECTOR_REST_URL', 'UPSTASH_VECTOR_REST_TOKEN'] as const;

export function envConfigError(): Response | null {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length === 0) {
    return null;
  }

  return new Response(
    JSON.stringify({
      error: `Missing environment variables: ${missing.join(', ')}`,
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
```

## Step 2: The chat API route

The heart of the app is `app/api/chat/route.ts`. Each POST does four things: recall relevant memories, build a system prompt, stream a response with memory tools, and persist new facts after the turn completes.

```typescript
import { openai } from '@ai-sdk/openai';
import { streamText, type Message } from 'ai';
import { createMemoryTools } from '@turbomem/vercel-ai';
import { DEMO_USER_ID } from '@/lib/constants';
import { envConfigError } from '@/lib/env';
import { getMemory } from '@/lib/memory';
import { buildSystemPrompt } from '@/lib/prompts';

export const runtime = 'nodejs';
export const maxDuration = 30;

function getLatestUserMessage(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return messages[i];
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  const configError = envConfigError();
  if (configError) return configError;

  const { messages } = (await req.json()) as { messages: Message[] };
  const memory = await getMemory();
  const tools = createMemoryTools(memory, { userId: DEMO_USER_ID });

  const lastUser = getLatestUserMessage(messages);
  const recalled =
    lastUser?.content && typeof lastUser.content === 'string'
      ? await memory.search(lastUser.content, { userId: DEMO_USER_ID, limit: 5 })
      : [];

  const system = buildSystemPrompt(recalled);

  const result = await streamText({
    model: openai('gpt-4.1-mini'),
    system,
    messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ text }) => {
      if (lastUser?.content && typeof lastUser.content === 'string' && text) {
        await memory.add(
          [
            { role: 'user', content: lastUser.content },
            { role: 'assistant', content: text },
          ],
          { userId: DEMO_USER_ID }
        );
      }
    },
  });

  return result.toDataStreamResponse();
}
```

This route uses two complementary memory paths:

**Automatic recall before generation.** The latest user message is embedded and searched against stored facts. Top matches are injected into the system prompt so the model starts the turn with context.

**Tool based memory during generation.** `createMemoryTools` gives the model `rememberFact` and `recallMemories`. The assistant can store a fact mid turn or search for something specific without waiting for the next request.

**Automatic extraction after generation.** `onFinish` calls `memory.add()` with the user message and assistant reply. turbomem extracts new facts from that exchange and merges them into long term storage.

The `maxSteps: 5` setting allows the model to call tools and continue reasoning within a single streamed response. Without it, a tool call would end the turn prematurely.

### Scoping with userId

Memories are scoped to a user. The starter hardcodes a demo id:

```typescript
export const DEMO_USER_ID = 'demo_user';
```

In production you would replace this with the authenticated user's id. Every write and search in the chat route and memories route uses the same scope, which prevents cross user leakage.

### The system prompt

Recalled facts are formatted into the system prompt in `lib/prompts.ts`:

```typescript
import type { MemorySearchResult } from 'turbomem';

export function buildSystemPrompt(recalled: MemorySearchResult[]): string {
  const base = 'You are a helpful personal assistant. You have a long-term memory system.';

  if (recalled.length === 0) {
    return `${base}\n\nYou don't know anything about this user yet — learn about them through conversation.`;
  }

  const facts = recalled.map((r) => `- ${r.memory.content}`).join('\n');

  return `${base}

Here are facts you already know about this user:
${facts}

Use these facts to personalize your responses. If the user shares new information about themselves, use the rememberFact tool to save it. Don't announce that you're saving memories — just do it naturally.`;
}
```

When no memories exist yet, the assistant knows it should learn through conversation. When facts are present, they are listed explicitly so the model can personalize without guessing.

The prompt also instructs the model to use `rememberFact` for new information and to save quietly. Users should feel remembered, not managed.

## Step 3: The memories API

The memory panel needs its own endpoint. `app/api/memories/route.ts` lists and clears stored facts:

```typescript
import { DEMO_USER_ID } from '@/lib/constants';
import { envConfigError } from '@/lib/env';
import { getMemory } from '@/lib/memory';

export const runtime = 'nodejs';

export async function GET() {
  const configError = envConfigError();
  if (configError) return configError;

  const memory = await getMemory();
  const all = await memory.getAll({ userId: DEMO_USER_ID });

  const memories = all
    .map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return Response.json({ memories });
}

export async function DELETE() {
  const configError = envConfigError();
  if (configError) return configError;

  const memory = await getMemory();
  await memory.deleteAll({ userId: DEMO_USER_ID });

  return Response.json({ ok: true });
}
```

`GET` returns every fact for the demo user, newest first. `DELETE` wipes the store so users can reset when testing or when they want a clean slate.

Showing memories in the UI is a product decision, not just a debug feature. When recall feels wrong, the user can see exactly what was stored and fix the conversation from there.

## Step 4: The chat interface

The client uses the Vercel AI SDK `useChat` hook. It handles message state, streaming, and the input form:

```typescript
"use client";

import { useChat } from "ai/react";
import { DEMO_USER_ID } from "@/lib/constants";
import { MessageBubble } from "./Message";

interface ChatProps {
  onTurnComplete: () => void;
}

export function Chat({ onTurnComplete }: ChatProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      body: { userId: DEMO_USER_ID },
      onFinish: () => {
        onTurnComplete();
      },
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* message list + input form */}
    </div>
  );
}
```

The important hook here is `onFinish`. When a streamed response completes, it calls `onTurnComplete()`, which bumps a refresh token in the parent page. That triggers the memory panel to refetch, so new facts appear without a manual reload.

The page wires chat and memory together in `app/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Chat } from "@/components/Chat";
import { Header } from "@/components/Header";
import { MemoryPanel } from "@/components/MemoryPanel";

export default function Home() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  function handleTurnComplete() {
    setRefreshToken((n) => n + 1);
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Header onToggleMemory={() => setMobilePanelOpen((open) => !open)} />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Chat onTurnComplete={handleTurnComplete} />
        </main>

        <MemoryPanel
          refreshToken={refreshToken}
          className="hidden w-72 shrink-0 border-l md:flex lg:w-80"
        />
      </div>
    </div>
  );
}
```

On desktop, the memory panel sits beside the chat. On mobile, a header button opens it as an overlay. Same data, different layout.

## Step 5: The memory panel

`components/MemoryPanel.tsx` fetches from `/api/memories` and renders each fact with a relative timestamp:

```typescript
'use client';

import { formatDistanceToNow } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

interface MemoryItem {
  id: string;
  content: string;
  createdAt: string;
}

interface MemoryPanelProps {
  refreshToken: number;
  className?: string;
}

export function MemoryPanel({ refreshToken, className = '' }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/memories');
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data = (await res.json()) as { memories: MemoryItem[] };
      setMemories(data.memories);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories, refreshToken]);

  // render list + clear button
}
```

The `refreshToken` prop is the glue between chat and memory. Without it, the panel would only load once on mount and miss facts written during the session.

The clear button calls `DELETE /api/memories` and resets local state. Useful for demos, testing, and giving users control over their data.

## How a conversation turn flows

Trace what happens when a user sends "I'm training for a half marathon in October":

1. **Client** posts the message array to `/api/chat` via `useChat`.

2. **Recall** embeds the latest user message and searches Upstash Vector for the top 5 matching facts scoped to `demo_user`.

3. **Prompt** merges recalled facts into the system message via `buildSystemPrompt`.

4. **Stream** `streamText` generates a response. The model may call `rememberFact` to store "User is training for a half marathon in October" immediately, or rely on post turn extraction.

5. **Extract** in `onFinish`, `memory.add()` runs extraction on the user message and assistant reply. New facts are embedded and stored.

6. **Refresh** `onFinish` on the client triggers `handleTurnComplete`, which increments `refreshToken`.

7. **Panel** `MemoryPanel` refetches and displays the new fact with a "2 minutes ago" timestamp.

8. **Next session** the user refreshes the browser. Chat history is empty, but the marathon fact is still in Upstash Vector. The next message triggers recall and the assistant knows about the race.

That separation between ephemeral chat and durable memory is the core design. Chat is the interface. Memory is the knowledge base.

## Deploy to Vercel

The starter is ready for Vercel out of the box:

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add `OPENAI_API_KEY`, `UPSTASH_VECTOR_REST_URL`, and `UPSTASH_VECTOR_REST_TOKEN` in project settings.
4. Deploy.

Memories persist across serverless instances because they live in Upstash, not in process memory. Redeploys do not wipe user facts.

## Extending the starter

The demo is intentionally small. Here are the natural next steps for a production app:

**Authentication.** Replace `DEMO_USER_ID` with the logged in user's id from Clerk, Auth.js, or your auth provider. Scope every memory operation to that id.

**Persistent chat threads.** Store message history in a database if you want conversations to survive refresh. Keep long term facts in turbomem; store transcripts separately.

**Agent scoping.** Add `agentId` to memory scope if you run multiple assistants (coach, scheduler, researcher) for the same user.

**Custom extraction.** Tune the extraction model or prompt for your domain. Medical, legal, and support apps often need stricter fact formatting.

**Rate limiting and quotas.** Gate memory writes per user to control OpenAI costs on the extraction and embedding paths.

Each of these builds on the same architecture. The starter gives you the skeleton; you add product specific flesh.

## What you get out of the box

| Layer     | Choice                                        |
| --------- | --------------------------------------------- |
| Framework | Next.js 14 App Router, Node.js runtime        |
| AI        | Vercel AI SDK with OpenAI streaming           |
| Memory    | turbomem + `@turbomem/vercel-ai` tools        |
| Storage   | Upstash Vector (1536 dims, cosine similarity) |
| Styling   | Tailwind CSS with light and dark mode         |
| Deploy    | Vercel                                        |

No Python sidecar. No separate memory microservice. One TypeScript codebase, one deploy target, memories that actually stick.

## Try it yourself

Clone the [starter repo](https://github.com/turbomem/turbomem-nextjs-starter), add your keys, and run a conversation. Share a few facts about yourself, refresh, and ask the assistant what it remembers. Watch the memory panel update after each turn.

For deeper context on what happens under the hood, read [How Agent Memory Actually Works](/how-agent-memory-actually-works-facts-vectors-and-scoping-explained) and the [turbomem architecture guide](https://docs.turbomem.dev/guide/architecture).

Questions or improvements for the starter? Open an issue on [GitHub](https://github.com/turbomem/turbomem-nextjs-starter) or reach out on the [contact page](https://turbomem.dev/contact).
