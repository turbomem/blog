---
publishDate: 2026-07-15T00:00:00Z
title: The Three Kinds of Memory Every Agent Needs
excerpt: A useful agent does not remember everything. It remembers the right things in the right way. Here is how working memory, episodic recall, and semantic facts fit together, and why confusing them is the most common reason agents feel forgetful.
image: ~/assets/blogs/notes.jpg
category: Engineering
tags:
  - turbomem
  - agents
  - memory
  - architecture
author: Arneesh Aima
metadata:
  canonical: https://blog.turbomem.dev/the-three-kinds-of-memory-every-agent-needs
---

You have probably had this experience with an AI assistant. Within a single conversation it feels sharp. It picks up on details, follows threads, and answers follow up questions without losing the plot. Then you come back the next day and it has no idea who you are.

That gap is not a bug in the model. It is a gap in how memory is set up. Most agent builders treat memory as one thing when it is really three different jobs that need three different answers. Once you separate them, a lot of the confusion around "why does my agent forget?" starts to make sense.

This post is about those three kinds of memory, how they show up in real products, and what goes wrong when you collapse them into a single transcript.

## Working memory: what is happening right now

The first kind of memory is the simplest and the one you already have whether you planned for it or not. It is the conversation currently in the model's context window.

When the user asks a follow up question, the model can refer back to what was said five messages ago because those messages are still sitting in the prompt. That is working memory. It is fast, it is free in the sense that no separate system is involved, and it disappears the moment the session ends or the context gets trimmed.

Working memory is excellent for coherence inside a single turn or thread. It is terrible for continuity across days, devices, or separate chat sessions. Nothing from yesterday is in today's prompt unless you put it there on purpose.

Most demos feel good because working memory is enough for demos. A five minute conversation never outgrows the context window. The assistant never needs to recall something from last week. The moment your product has returning users, working memory alone stops being memory and starts being amnesia with good short term manners.

## Episodic memory: what happened, and when

The second kind is episodic memory. In human terms, this is remembering events: the meeting on Tuesday, the argument in the kitchen, the day you decided to train for a marathon. For an agent, episodic memory is a record of past interactions, usually stored as messages, summaries, or session logs.

Episodic memory answers questions like "what did we talk about last time?" or "when did the user first mention their new job?" It preserves narrative. It gives you an audit trail. It helps an agent sound like it has history with someone.

It also gets noisy fast. A user who chats daily for a month generates thousands of messages. Most of them are filler. Greetings, clarifications, small talk, repeated questions. Storing the full episodic record and dumping it into every new prompt does not scale. The context window fills up, costs rise, and the model still struggles to find the one sentence that actually matters.

Episodic memory is valuable when you need fidelity to past conversations. It is the wrong default when you need the agent to know facts about the user. Searching through six months of chat to answer "what city does this person live in?" is like reading someone's diary every time they ask for their own address.

## Semantic memory: what is true about the world

The third kind is semantic memory. This is knowledge stripped of when and where you learned it. You know that Paris is the capital of France. You do not need to remember the specific day someone told you that. You just know it.

For agents, semantic memory means discrete facts: preferences, goals, constraints, relationships, and stable context. "The user prefers morning workouts." "They are allergic to shellfish." "Their project deadline is in October." These are not tied to a particular chat session. They are things that should remain true until the user updates them.

Semantic memory is what makes an agent feel like it knows you rather than like it is rereading old transcripts. When the user asks about dinner plans, the agent should recall the allergy without replaying the conversation where it came up. When they ask about training, it should know about the marathon without searching through three weeks of fitness chat.

This is the layer most production agent products eventually add, often without naming it. Fact extraction, vector search, scoped user profiles, and knowledge bases are all ways of building semantic memory on top of raw conversation.

## Why mixing them up causes so many problems

The most common memory mistake in agent products is treating one kind as another.

Using working memory alone and expecting persistence is the beginner error. The context window is not a database. When the session ends, so does everything in it.

Using episodic memory alone and expecting precise recall is the intermediate error. Message history is a log, not a knowledge base. Relevant facts are buried in irrelevant prose. Retrieval by recency misses things that matter from older sessions. Costs balloon because you ship entire conversations on every request.

Skipping semantic memory and hoping the model will infer stable facts from raw chat every time is the error that shows up in production. It works until it does not. The model hallucinates preferences it never stored. It contradicts something the user said two weeks ago because that detail never made it into the prompt.

Each kind of memory has a job. Working memory keeps the current conversation coherent. Episodic memory preserves history and accountability. Semantic memory holds the distilled truth the agent should act on going forward.

## Forgetting is part of the design

Human memory is selective. You do not remember every word of every conversation you have ever had. You remember what mattered, what repeated, what had emotional weight, or what you deliberately committed to long term storage.

Agents need the same discipline. Not every message deserves to become a permanent fact. "Thanks!" does not need to live in semantic memory. A one off joke about pizza does not need to shape every future recommendation unless the user keeps bringing it up.

Good memory systems extract sparingly. They store facts that are likely to stay useful. They scope memories to the right user, agent, or session so one person's preferences do not leak into another's context. They let old or contradicted facts fade rather than pile up forever.

Forgetting is not failure. Uncontrolled remembering is. An agent that stores everything becomes slower, more expensive, and paradoxically less accurate because stale facts compete with current ones.

## How this maps to building a real product

If you are designing memory for an agent, it helps to decide explicitly what each layer is responsible for.

For working memory, the question is how much recent conversation stays in the prompt and when you trim it. Summarization, sliding windows, and tool calls that fetch recent context are all ways to manage this layer without pretending it persists.

For episodic memory, the question is whether you need full transcripts at all and for how long. Some products keep session logs for support and compliance. Others summarize sessions into short notes and discard the raw messages. The right choice depends on your privacy model and whether users expect to scroll back through old chats.

For semantic memory, the question is what gets extracted, how it gets stored, and how it gets retrieved when a new conversation starts. This is usually where embeddings, vector search, and scoped fact stores enter the picture. The user says something today. A fact gets written. Next week, a search for a related topic surfaces that fact without replaying the original chat.

You do not need a separate product for each layer. You need a clear answer for each job. Many teams start with working memory only, add episodic logging because it is easy, and then stall when users expect the agent to remember facts across sessions. Recognizing which layer is missing saves months of guessing why recall feels broken.

## Memory is a product decision, not a model feature

Models do not have durable memory built in. They have a context window and weights trained on public text. Everything that feels like "the agent remembered me" is something your application stored and injected back at the right moment.

That is actually good news. Memory is under your control. You decide what to keep, what to extract, what to scope, and what to discard. You decide whether continuity means full chat history, a summary, or a set of facts about the user.

The agents that feel personal are not the ones with the largest context windows. They are the ones that treat memory as three related problems instead of one blob of text. Working memory for the conversation in front of you. Episodic memory for the record of what happened. Semantic memory for what is true and worth carrying forward.

If you are building in TypeScript and want to see how semantic memory fits into a full pipeline, the [architecture guide](https://docs.turbomem.dev/guide/architecture.html) walks through extraction, embedding, and scoped search in detail. The [getting started guide](https://docs.turbomem.dev/guide/getting-started.html) is the fastest way to store your first facts and search them in a new session.

If you have questions about how memory should work in your product, reach out on the [contact page](https://turbomem.dev/contact) or [GitHub](https://github.com/turbomem/turbomem).
