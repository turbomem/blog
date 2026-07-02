import { getBlogPermalink } from './utils/permalinks';

const DOCS = 'https://docs.turbomem.dev';

export const headerData = {
  links: [
    {
      text: 'Docs',
      href: `${DOCS}/`,
    },
    {
      text: 'NPM',
      href: `https://www.npmjs.com/package/turbomem`,
    },
    {
      text: 'API',
      href: `${DOCS}/api/reference`,
    },
    {
      text: 'Blog',
      href: getBlogPermalink(),
    },
  ],
  actions: [{ text: 'GitHub', href: 'https://github.com/turbomem/turbomem', target: '_blank' }],
};

export const footerData = {
  links: [
    {
      title: 'Documentation',
      links: [
        { text: 'Getting started', href: `${DOCS}/guide/getting-started` },
        { text: 'Configuration', href: `${DOCS}/guide/configuration.html` },
        { text: 'Architecture', href: `${DOCS}/guide/architecture.html` },
        { text: 'Browser', href: `${DOCS}/guide/browser.html` },
        { text: 'Edge', href: `${DOCS}/guide/edge.html` },
        { text: 'CLI', href: `${DOCS}/cli/` },
        { text: 'API reference', href: `${DOCS}/api/reference` },
      ],
    },
    {
      title: 'Project',
      links: [
        { text: 'Adapters', href: `${DOCS}/adapters/mastra` },
        { text: 'Contact', href: `${DOCS}/contact` },
        { text: 'npm', href: 'https://www.npmjs.com/package/turbomem' },
        { text: 'GitHub', href: 'https://github.com/turbomem/turbomem' },
      ],
    },
  ],
  secondaryLinks: [
    // { text: 'Terms', href: `${DOCS}/terms` },
    // { text: 'Privacy Policy', href: `${DOCS}/privacy` },
  ],
  socialLinks: [
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/turbomem/turbomem' },
  ],
  footNote: `
    Apache-2.0 Licensed · turbomem · All Rights Reserved
  `,
};
