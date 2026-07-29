---
publishDate: 2026-07-29T12:00:00Z
title: Give Claude Desktop a Memory That Sticks
excerpt: >-
  Claude Desktop is excellent within a conversation and forgetful across them.
  turbomem's MCP server adds local, private long-term memory in one click - no
  terminal, no separate database, nothing uploaded except the AI provider you
  choose for extraction and search.
image: ~/assets/blogs/desktop.jpg
category: Tutorial
tags:
  - turbomem
  - mcp
  - claude
  - memory
  - agents
author: Arneesh Aima
metadata:
  canonical: https://blog.turbomem.dev/give-claude-desktop-a-memory-that-sticks-with-turbomem-mcp
---

Claude Desktop is a sharp conversational partner. It reads your files, follows threads inside a chat, and reasons well across a long turn. Then you start a new conversation and it has no idea you prefer TypeScript, that your dog is named Rex, or that you are training for a half marathon in October.

That gap is not a flaw in Claude. It is a gap in what the desktop client ships with. The model only knows what fits in the current context window. Yesterday's chat is not in today's prompt unless something external puts it there.

For developers building agents, the answer is usually a memory pipeline: extract facts, embed them, store them, recall by meaning. We have written about that layer at length on this blog. But what if you are not building an app? What if you just want Claude on your laptop to remember you?

That is what [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is for, and it is why we built `@turbomem/mcp`: a one-click extension that gives Claude Desktop the same kind of durable, searchable memory turbomem provides to TypeScript agents - stored locally on your machine, scoped to you, and usable across conversations without standing up a server.

## Why desktop chat needs a memory layer

Most people experience "AI amnesia" as a personality problem. The assistant feels warm and attentive, then oddly blank the next morning. In practice it is an architecture problem.

**Context windows reset.** Each new chat starts fresh. Claude cannot reference facts from last week's thread unless you paste them back in or use a tool that retrieves them.

**Not everything in a chat is worth remembering.** "Thanks!" and "Can you rephrase that?" are useful in the moment. They are not facts you want indexed forever. Good memory systems extract durable statements and discard the filler.

**Recall needs meaning, not just history.** When you ask "What was that restaurant I liked in Portland?", the answer might never have included the word "restaurant." Semantic search over stored facts handles that better than scrolling old transcripts.

**Privacy matters on a personal machine.** Many users want memory that stays local. They do not want every preference uploaded to a third-party memory SaaS just so an assistant can recall their coffee order.

MCP solves the wiring problem. Claude Desktop can call tools exposed by local servers over stdio. A memory MCP server sits beside the chat client, stores facts on disk, and answers recall queries when the model needs personal context. No custom app required.

## What turbomem MCP does

Package: `@turbomem/mcp`

The server wraps the same [turbomem](https://turbomem.dev/) engine used in production TypeScript agents. When Claude calls `remember`, turbomem runs fact extraction on the statement, embeds the result, and writes it to a PGlite database under `~/.turbomem/data`. When Claude calls `recall`, turbomem embeds the query and returns the closest matching facts by meaning.

Everything stays on your computer. The only outbound calls are to whichever AI provider you configure for extraction and embeddings - the same tradeoff as using any LLM-powered tool.

Claude is instructed to use memory proactively:

- Save durable facts when you share preferences, projects, relationships, or goals.
- Search memory before answering questions that depend on personal context.
- List or delete memories when you ask to review or correct what is stored.

You do not need to say "remember this" every time. Claude is nudged to treat obvious personal facts the way a good assistant would: notice what matters and carry it forward.

## Install in Claude Desktop (no terminal)

We ship turbomem as a Claude Desktop extension (`.mcpb`) so non-technical users never touch JSON config or npm.

1. **Download** `turbomem.mcpb` from the [GitHub Releases](https://github.com/turbomem/turbomem/releases) page.
2. **Double-click** the file. Claude Desktop opens an install screen. (You can also drag the file onto the window, or use **Settings → Extensions → Advanced settings → Install Extension…**.)
3. Fill in two fields and click **Install**:
   - **AI provider** - type `openai`, `google`, or `anthropic` (leave as `openai` if unsure).
   - **API key** - paste the key for that provider.

Then chat normally. Try "Remember that my dog is named Rex," start a **new** conversation, and ask "What's my dog's name?" Claude should recall without you repeating yourself.

That is the entire setup for most users. The extension bundles the MCP server, resolves storage paths, and connects Claude to the five memory tools automatically.

## Which API key do you need?

You only need **one** key when you choose OpenAI or Google. Both providers supply models for understanding text and for embedding it, so a single key covers extraction and search.

| Provider    | Get a key                                                            | What it powers                      |
| ----------- | -------------------------------------------------------------------- | ----------------------------------- |
| `openai`    | [platform.openai.com](https://platform.openai.com/api-keys)          | Understanding + searching memories  |
| `google`    | [aistudio.google.com](https://aistudio.google.com/app/apikey)        | Understanding + searching memories  |
| `anthropic` | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Understanding memories (extraction) |

Anthropic is the special case. Claude models extract facts well, but Anthropic does not ship an embedding API. Memory search still needs vectors, so when you choose `anthropic` as your provider, also set:

- **Search provider** → `openai` or `google`
- **Search API key** → that provider's key

Extraction runs on Claude over HTTP. Search runs on OpenAI or Google over HTTP. No local model download required for that path.

Advanced users who want fully on-device search can set `TURBOMEM_EMBEDDINGS_PROVIDER=local` in manual config and install `@huggingface/transformers`. The one-click `.mcpb` bundle intentionally omits that dependency to keep the install small (~14 MB instead of hundreds).

## The five memory tools

Claude calls these automatically, but you can invoke them directly too ("list everything you remember about me", "forget that I like dark mode").

| Tool                | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `remember`          | Saves durable facts about you to local memory          |
| `recall`            | Searches memory for anything relevant to a query       |
| `list_memories`     | Lists everything currently stored, newest first        |
| `forget`            | Deletes one memory by id                               |
| `forget_everything` | Erases all memories - only when you explicitly confirm |

`remember` accepts plain language. You do not format facts as JSON. Pass "My dog is named Rex and he is afraid of thunderstorms" and turbomem extracts discrete statements, deduplicates against what is already stored, and embeds the new ones.

`recall` returns scored results so Claude can judge relevance. A query about weekend plans might surface dietary restrictions and travel preferences together, even when none of those facts share keywords with the question.

`forget_everything` requires `confirm: true`. Destructive operations should not happen by accident.

## What happens under the hood

When Claude calls `remember`, the MCP server forwards the text to turbomem's `add()` pipeline:

```text
User statement
      │
      ▼
┌─────────────────┐
│ Fact extraction │  (LLM: gpt-4.1-mini, Gemini, or Claude Haiku)
└────────┬────────┘
         ▼
┌─────────────────┐
│   Embeddings    │  (OpenAI, Google, or local WASM model)
└────────┬────────┘
         ▼
┌─────────────────┐
│ PGlite on disk  │  ~/.turbomem/data
└─────────────────┘
```

When Claude calls `recall`, the query follows the same path in reverse: embed the question, run cosine similarity search scoped to your user id, return the top matches.

The storage backend is PGlite - Postgres compiled to WASM, running locally. It is the same store the [turbomem CLI](https://docs.turbomem.dev/cli) uses. If you use both the CLI and the MCP extension with default paths, they share one memory profile.

Scoping uses a `userId` label, defaulting to `me`. Unless you run separate profiles for work and personal use, you do not need to change it.

## Manual setup for other MCP clients

The `.mcpb` extension targets Claude Desktop. If you use another MCP host, or want to wire things by hand:

```bash
npm install -g @turbomem/mcp
```

Add to your MCP config:

```json
{
  "mcpServers": {
    "turbomem": {
      "command": "turbomem-mcp",
      "env": {
        "TURBOMEM_PROVIDER": "openai",
        "TURBOMEM_API_KEY": "sk-...",
        "TURBOMEM_USER_ID": "me",
        "TURBOMEM_DATA_DIR": "/Users/you/.turbomem/data"
      }
    }
  }
}
```

Or run without installing:

```bash
npx @turbomem/mcp
```

For Anthropic extraction with OpenAI search:

```json
{
  "mcpServers": {
    "turbomem": {
      "command": "turbomem-mcp",
      "env": {
        "TURBOMEM_PROVIDER": "anthropic",
        "TURBOMEM_API_KEY": "sk-ant-...",
        "TURBOMEM_EMBEDDINGS_PROVIDER": "openai",
        "TURBOMEM_EMBEDDINGS_API_KEY": "sk-..."
      }
    }
  }
}
```

Full environment variable reference lives in the [MCP docs](https://docs.turbomem.dev/mcp).

## MCP memory vs building your own agent

If you are shipping a product, you probably still want memory inside your application code. The [Next.js starter walkthrough](/building-a-personal-assistant-that-remembers-you) shows how turbomem integrates with the Vercel AI SDK: automatic recall before generation, tool-based memory during a turn, extraction after the reply completes.

MCP memory is for a different job: personal use of a desktop client you do not control. You cannot modify Claude's system prompt or add a `/api/chat` route. You can attach a local server that exposes tools. That is the entire integration surface.

The mental model is the same in both cases:

- **Working memory** is the current chat (Claude's context window).
- **Semantic memory** is extracted facts stored out of band and retrieved by meaning.

Confusing the two is why many "memory" hacks feel brittle. Pasting old chats into every new thread does not scale. Storing everything Claude says creates noise. Extraction plus scoped search is what makes recall feel intentional.

For a deeper look at that split, see [The Three Kinds of Memory Every Agent Needs](/the-three-kinds-of-memory-every-agent-needs) and [How Agent Memory Actually Works](/how-agent-memory-actually-works-facts-vectors-and-scoping-explained).

## Privacy and data boundaries

turbomem is local-first. Memories live in a database on your disk. We do not operate a cloud that receives your facts or API keys.

When you save a memory, the extraction and embedding steps call your chosen provider's API with the text being processed. That is the same privacy boundary as using Claude, ChatGPT, or Gemini directly. Read each provider's policy if that matters for your use case.

You can inspect everything stored with `list_memories`, delete individual facts with `forget`, or wipe the store with `forget_everything`. The [privacy policy](https://turbomem.dev/privacy) describes what turbomem itself collects (nothing from the MCP server beyond what you configure locally).

## When MCP memory is the right fit

**Good fit:**

- You use Claude Desktop daily and want continuity across chats.
- You care about local storage and do not want a hosted memory vendor.
- You are comfortable supplying an API key for extraction and search.
- You want memory without building or deploying an app.

**Less ideal:**

- You need memory shared across multiple users on a team (scope is single-profile by default).
- You require audit logs, admin dashboards, or server-side access control.
- You are building a product and need memory embedded in your own backend (use the turbomem library directly instead).

MCP extends a client. It does not replace a product memory layer. For TypeScript agents in production, the library path remains the right default. For personal desktop use, MCP closes the gap cleanly.

## Try it

Download [`turbomem.mcpb`](https://github.com/turbomem/turbomem/releases), install it in Claude Desktop, and share a few facts about yourself. Open a fresh chat and ask Claude what it knows. List your memories. Correct something with `forget`. Watch recall work across sessions.

For setup details, provider options, and manual configuration, see the [MCP documentation](https://docs.turbomem.dev/mcp). For the engineering story behind the memory pipeline itself, start with [Why Your TypeScript Agent Doesn't Need a Memory Server](/why-your-typescript-agent-doesnt-need-a-memory-server).

Questions or issues? Open a thread on [GitHub](https://github.com/turbomem/turbomem/issues) or reach out via the [contact page](https://turbomem.dev/contact).
