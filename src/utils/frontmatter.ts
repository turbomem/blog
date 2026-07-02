import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import type { RehypePlugin, RemarkPlugin } from '@astrojs/markdown-remark';
import type { Element, Root } from 'hast';

export const readingTimeRemarkPlugin: RemarkPlugin = () => {
  return function (tree, file) {
    const textOnPage = toString(tree);
    const readingTime = Math.ceil(getReadingTime(textOnPage).minutes);

    if (typeof file?.data?.astro?.frontmatter !== 'undefined') {
      file.data.astro.frontmatter.readingTime = readingTime;
    }
  };
};

export const responsiveTablesRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    if (!tree.children) return;

    for (let i = 0; i < tree.children.length; i++) {
      const child = tree.children[i];

      if (child.type === 'element' && child.tagName === 'table') {
        tree.children[i] = {
          type: 'element',
          tagName: 'div',
          properties: {
            style: 'overflow:auto',
          },
          children: [child],
        };

        i++;
      }
    }
  };
};

export const codeCopyRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    visit(tree as Root, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return;

      if (
        parent.type === 'element' &&
        parent.tagName === 'div' &&
        Array.isArray(parent.properties?.className) &&
        parent.properties.className.includes('code-block-wrapper')
      ) {
        return;
      }

      const copyButton: Element = {
        type: 'element',
        tagName: 'button',
        properties: {
          type: 'button',
          className: ['code-copy-btn'],
          ariaLabel: 'Copy code',
          dataAwCopyCode: '',
        },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['code-copy-icon', 'code-copy-icon-copy'],
              ariaHidden: 'true',
            },
            children: [],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['code-copy-icon', 'code-copy-icon-check'],
              ariaHidden: 'true',
            },
            children: [],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-copy-label'] },
            children: [{ type: 'text', value: 'Copy' }],
          },
        ],
      };

      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['code-block-wrapper'],
        },
        children: [node, copyButton],
      };

      parent.children[index] = wrapper;
    });
  };
};
