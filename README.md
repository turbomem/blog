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

## Configuration

Site metadata and blog settings live in `src/config.yaml`. Navigation links are in `src/navigation.ts`.

Production URL: [https://blog.turbomem.dev](https://blog.turbomem.dev) (main docs site: [turbomem.dev](https://turbomem.dev)).

## Deploy to GitHub Pages

This repo deploys with GitHub Actions on pushes to `main`.

1. In the repository **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Under **Custom domain**, enter `blog.turbomem.dev` (a `public/CNAME` file is already included).
3. Add a DNS `CNAME` record pointing `blog.turbomem.dev` to your GitHub Pages hostname (`<username>.github.io` or your org’s Pages URL).
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds `dist/` and publishes it.

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
