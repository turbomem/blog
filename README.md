# turbomem blog

Blog for [turbomem](https://turbomem.dev/) local-first agent memory for TypeScript.

Static site built with Astro and Tailwind CSS. The post list is the homepage.

## Requirements

- Node.js >= 22.12.0

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Build

```bash
npm run build
npm run preview
```

## Add a post

Create a `.md` or `.mdx` file in `src/data/post/`:

```md
---
title: My post title
publishDate: 2026-06-28
excerpt: Short summary for listings and SEO.
category: Updates
tags:
  - turbomem
---

Your content here.
```

Posts are published at `/{slug}` where `slug` comes from the filename.

## Resources

Core `turbomem` resources.

Links: [https://blog.turbomem.dev](https://blog.turbomem.dev) (docs: [docs.turbomem.dev](https://docs.turbomem.dev), site: [turbomem.dev](https://turbomem.dev)).

## Scripts

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `npm run dev`     | Dev server                      |
| `npm run build`   | Production build to `dist/`     |
| `npm run preview` | Preview the production build    |
| `npm run check`   | Astro check, ESLint, Prettier   |
| `npm run fix`     | Auto-fix lint and format issues |

## License

Apache-2.0
