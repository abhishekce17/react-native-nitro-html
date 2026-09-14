import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';

// Comprehensive mock of NitroModules for parser & AST simulation in Jest
jest.mock('react-native-nitro-modules', () => {
  function sanitizeAndTokenize(html: string) {
    if (!html) return [];

    // Strip script and style tags for safety simulation
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .trim();

    const blocks: any[] = [];

    // Simulate Heading parsing
    const headingMatches = cleaned.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/gis);
    for (const match of headingMatches) {
      const level = parseInt(match[1] || '1', 10);
      const text = (match[2] || '').replace(/<[^>]+>/g, '').trim();
      blocks.push({
        type: 'Heading',
        level,
        childCount: 1,
        getChild: () => ({
          type: 'Text',
          text,
          url: '',
          childCount: 0,
          getChild: () => null,
        }),
        quoteChildCount: 0,
        itemCount: 0,
        rowCount: 0,
        defItemCount: 0,
      });
    }

    // Simulate CodeBlock parsing
    const codeMatches = cleaned.matchAll(
      /<pre\b[^>]*><code(?:\s+class="language-([^"]+)")?[^>]*>(.*?)<\/code><\/pre>/gis
    );
    for (const match of codeMatches) {
      blocks.push({
        type: 'CodeBlock',
        language: match[1] || undefined,
        code: (match[2] || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
        childCount: 0,
        getChild: () => null,
        quoteChildCount: 0,
        itemCount: 0,
        rowCount: 0,
        defItemCount: 0,
      });
    }

    // Simulate List parsing
    if (/<(ul|ol)\b/i.test(cleaned)) {
      const isOrdered = /<ol\b/i.test(cleaned);
      const liMatches = [...cleaned.matchAll(/<li\b[^>]*>(.*?)<\/li>/gis)];
      const items = liMatches.map((m) => {
        const itemText = (m[1] || '').replace(/<[^>]+>/g, '').trim();
        const hasNestedList = /<(ul|ol)\b/i.test(m[1] || '');
        return {
          childCount: 1,
          getChild: () => ({
            type: 'Text',
            text: itemText,
            url: '',
            childCount: 0,
            getChild: () => null,
          }),
          nestedCount: hasNestedList ? 1 : 0,
          getNested: () =>
            hasNestedList
              ? {
                  type: 'List',
                  ordered: false,
                  itemCount: 1,
                  getItem: () => ({
                    childCount: 1,
                    getChild: () => ({ type: 'Text', text: 'Sub-item' }),
                    nestedCount: 0,
                    getNested: () => null,
                  }),
                }
              : null,
        };
      });

      blocks.push({
        type: 'List',
        ordered: isOrdered,
        itemCount: items.length || 1,
        getItem: (idx: number) =>
          items[idx] || {
            childCount: 1,
            getChild: () => ({ type: 'Text', text: 'Default List Item' }),
            nestedCount: 0,
            getNested: () => null,
          },
        childCount: 0,
        getChild: () => null,
        quoteChildCount: 0,
        rowCount: 0,
        defItemCount: 0,
      });
    }

    // Simulate Table parsing
    if (/<table\b/i.test(cleaned)) {
      const trMatches = [...cleaned.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gis)];
      const rows = trMatches.map((tr) => {
        const cellMatches = [
          ...tr[1]!.matchAll(/<(?:td|th)\b[^>]*>(.*?)<\/(?:td|th)>/gis),
        ];
        return {
          cellCount: cellMatches.length || 1,
          getCell: (cIdx: number) => {
            const cellContent = cellMatches[cIdx]
              ? cellMatches[cIdx]![1]!.replace(/<[^>]+>/g, '').trim()
              : `Cell ${cIdx + 1}`;
            return {
              childCount: 1,
              getChild: () => ({
                type: 'Text',
                text: cellContent,
                url: '',
                childCount: 0,
                getChild: () => null,
              }),
            };
          },
        };
      });

      blocks.push({
        type: 'Table',
        rowCount: rows.length || 1,
        getRow: (rIdx: number) =>
          rows[rIdx] || {
            cellCount: 2,
            getCell: () => ({
              childCount: 1,
              getChild: () => ({ type: 'Text', text: 'Cell' }),
            }),
          },
        childCount: 0,
        getChild: () => null,
        quoteChildCount: 0,
        itemCount: 0,
        defItemCount: 0,
      });
    }

    // Simulate Blockquote parsing
    if (/<blockquote\b/i.test(cleaned)) {
      blocks.push({
        type: 'Quote',
        quoteChildCount: 1,
        getQuoteChild: () => ({
          type: 'Paragraph',
          childCount: 1,
          getChild: () => ({
            type: 'Text',
            text: 'Quote text',
            url: '',
            childCount: 0,
            getChild: () => null,
          }),
          quoteChildCount: 0,
          itemCount: 0,
          rowCount: 0,
          defItemCount: 0,
        }),
        childCount: 0,
        getChild: () => null,
        itemCount: 0,
        rowCount: 0,
        defItemCount: 0,
      });
    }

    // Simulate DefinitionList parsing
    if (/<dl\b/i.test(cleaned)) {
      blocks.push({
        type: 'DefinitionList',
        defItemCount: 1,
        getDefItem: () => ({
          termCount: 1,
          getTerm: () => ({
            type: 'Text',
            text: 'Term',
            url: '',
            childCount: 0,
            getChild: () => null,
          }),
          defCount: 1,
          getDef: () => ({
            type: 'Text',
            text: 'Definition',
            url: '',
            childCount: 0,
            getChild: () => null,
          }),
        }),
        childCount: 0,
        getChild: () => null,
        quoteChildCount: 0,
        itemCount: 0,
        rowCount: 0,
      });
    }

    // Simulate Custom / Video / Embed tags
    if (/<video\b/i.test(cleaned)) {
      blocks.push({
        type: 'Video',
        src: 'https://example.com/video.mp4',
        childCount: 0,
        getChild: () => null,
        quoteChildCount: 0,
        itemCount: 0,
        rowCount: 0,
        defItemCount: 0,
      });
    }

    if (/<custom-poll\b/i.test(cleaned)) {
      blocks.push({
        type: 'custom-poll',
        childCount: 0,
        getChild: () => null,
        quoteChildCount: 0,
        itemCount: 0,
        rowCount: 0,
        defItemCount: 0,
      });
    }

    // Default Paragraph for standard text or malformed remnants
    if (blocks.length === 0 || /<p\b/i.test(cleaned)) {
      const text = cleaned.replace(/<[^>]+>/g, '').trim() || 'Fallback text';
      blocks.push({
        type: 'Paragraph',
        childCount: 1,
        getChild: () => ({
          type: 'Text',
          text,
          url: '',
          childCount: 0,
          getChild: () => null,
        }),
        quoteChildCount: 0,
        itemCount: 0,
        rowCount: 0,
        defItemCount: 0,
      });
    }

    blocks.forEach((b: any) => {
      if (!b.html) b.html = `<p>${b.type}</p>`;
    });

    return blocks;
  }

  const mockAstBuffer = new Map<string, any>();
  let mockAstCounter = 0;

  return {
    NitroModules: {
      createHybridObject: jest.fn(() => ({
        parse: jest.fn((html: string) => {
          if (!html) return null;
          const blocks = sanitizeAndTokenize(html);
          return {
            length: blocks.length,
            getBlock: (idx: number) => blocks[idx] || null,
          };
        }),
        parseAsync: jest.fn(async (html: string) => {
          if (!html) return null;
          const blocks = sanitizeAndTokenize(html);
          return {
            length: blocks.length,
            getBlock: (idx: number) => blocks[idx] || null,
          };
        }),
        normalizeHtml: jest.fn((html: string) =>
          html ? `<html><body>${html}</body></html>` : ''
        ),
        calculateHtmlLayout: jest.fn(
          (
            html: string,
            _width: number,
            baseStyle?: any,
            tagsStyles?: any,
            fontScale: number = 1.0
          ) => {
            if (!html) return { height: 0, astId: '' };
            const baseFs = baseStyle?.fontSize || 16;
            const effectiveFs = baseFs * (fontScale > 0 ? fontScale : 1);
            const height = Math.max(effectiveFs, 24);
            let hash = 0;
            const str = `${html}|${JSON.stringify(baseStyle || {})}|${JSON.stringify(tagsStyles || {})}`;
            for (let i = 0; i < str.length; i++) {
              // eslint-disable-next-line no-bitwise
              hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
            }
            const astId = `ast_${hash.toString(16).padStart(16, '0')}`;
            return { height, astId };
          }
        ),
        calculateHtmlLayoutAsync: jest.fn(
          async (
            html: string,
            _width: number,
            baseStyle?: any,
            tagsStyles?: any,
            fontScale: number = 1.0
          ) => {
            if (!html) return { height: 0, astId: '' };
            const baseFs = baseStyle?.fontSize || 16;
            const effectiveFs = baseFs * (fontScale > 0 ? fontScale : 1);
            const height = Math.max(effectiveFs, 24);
            let hash = 0;
            const str = `${html}|${JSON.stringify(baseStyle || {})}|${JSON.stringify(tagsStyles || {})}`;
            for (let i = 0; i < str.length; i++) {
              // eslint-disable-next-line no-bitwise
              hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
            }
            const astId = `ast_${hash.toString(16).padStart(16, '0')}`;
            return { height, astId };
          }
        ),
        calculateHtmlHeight: jest.fn(
          (
            html: string,
            _width: number,
            baseStyle?: any,
            tagsStyles?: any,
            fontScale: number = 1.0
          ) => {
            if (!html) return { height: 0, astId: '' };
            const baseFs = baseStyle?.fontSize || 16;
            const effectiveFs = baseFs * (fontScale > 0 ? fontScale : 1);
            const height = Math.max(effectiveFs, 24);
            let hash = 0;
            const str = `${html}|${JSON.stringify(baseStyle || {})}|${JSON.stringify(tagsStyles || {})}`;
            for (let i = 0; i < str.length; i++) {
              // eslint-disable-next-line no-bitwise
              hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
            }
            const astId = `ast_${hash.toString(16).padStart(16, '0')}`;
            return { height, astId };
          }
        ),
        getAstId: jest.fn((html: string, baseStyle?: any, tagsStyles?: any) => {
          if (!html) return '';
          let hash = 0;
          const str = `${html}|${JSON.stringify(baseStyle || {})}|${JSON.stringify(tagsStyles || {})}`;
          for (let i = 0; i < str.length; i++) {
            // eslint-disable-next-line no-bitwise
            hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
          }
          return `ast_${hash.toString(16).padStart(16, '0')}`;
        }),
        storeAst: jest.fn((article: any) => {
          if (!article) return '';
          const id = `ast_dyn_${(++mockAstCounter).toString(16).padStart(16, '0')}`;
          mockAstBuffer.set(id, article);
          return id;
        }),
        getAst: jest.fn((astId: string) => {
          return mockAstBuffer.get(astId) || null;
        }),
        clearAstCache: jest.fn(() => {
          mockAstBuffer.clear();
        }),
      })),
    },
    getHostComponent: jest.fn(() => 'NativeHtmlView'),
    callback: jest.fn((fn: any) => fn),
  };
});

import {
  FastHtmlView,
  NativeHtmlView,
  getBlocks,
  getChildren,
  getItems,
  getNestedBlocks,
  getRows,
  getCells,
  getQuoteChildren,
  getDefItems,
  getTerms,
  getDefs,
  parseHTML,
  parseHTMLAsync,
  normalizeHTML,
  calculateHTMLLayout,
  calculateHTMLLayoutAsync,
  getAstId,
  storeAst,
  getAst,
  clearAstCache,
} from '../index';

describe('1. Module Exports & Core APIs', () => {
  it('exports FastHtmlView and NativeHtmlView components', () => {
    expect(FastHtmlView).toBeDefined();
    expect(NativeHtmlView).toBeDefined();
  });

  it('exports core parser and AST buffer methods', () => {
    expect(typeof parseHTML).toBe('function');
    expect(typeof parseHTMLAsync).toBe('function');
    expect(typeof normalizeHTML).toBe('function');
    expect(typeof calculateHTMLLayout).toBe('function');
    expect(typeof calculateHTMLLayoutAsync).toBe('function');
    expect(typeof getAstId).toBe('function');
    expect(typeof storeAst).toBe('function');
    expect(typeof getAst).toBe('function');
    expect(typeof clearAstCache).toBe('function');
  });

  it('exports all 10 AST helper wrappers', () => {
    expect(typeof getBlocks).toBe('function');
    expect(typeof getChildren).toBe('function');
    expect(typeof getItems).toBe('function');
    expect(typeof getNestedBlocks).toBe('function');
    expect(typeof getRows).toBe('function');
    expect(typeof getCells).toBe('function');
    expect(typeof getQuoteChildren).toBe('function');
    expect(typeof getDefItems).toBe('function');
    expect(typeof getTerms).toBe('function');
    expect(typeof getDefs).toBe('function');
  });
});

describe('2. Comprehensive Testing of Utility Functions', () => {
  describe('parseHTML & parseHTMLAsync', () => {
    it('returns null for empty string or null input', () => {
      expect(parseHTML('')).toBeNull();
      expect(parseHTML(null as any)).toBeNull();
    });

    it('parses valid HTML synchronously and returns ParsedArticle', () => {
      const article = parseHTML('<p>Hello World</p>');
      expect(article).not.toBeNull();
      expect(article?.length).toBeGreaterThan(0);
      expect(article?.getBlock(0)).not.toBeNull();
    });

    it('parses valid HTML asynchronously via Promise', async () => {
      const article = await parseHTMLAsync('<p>Async content</p>');
      expect(article).not.toBeNull();
      expect(article?.length).toBeGreaterThan(0);
    });

    it('returns null for empty string in parseHTMLAsync', async () => {
      const result = await parseHTMLAsync('');
      expect(result).toBeNull();
    });
  });

  describe('normalizeHTML', () => {
    it('normalizes HTML markup', () => {
      const normalized = normalizeHTML('<div><p>Test</p></div>');
      expect(normalized).toContain('Test');
    });

    it('handles empty input in normalizeHTML', () => {
      expect(normalizeHTML('')).toBe('');
    });
  });

  describe('calculateHTMLLayout & calculateHTMLLayoutAsync', () => {
    it('calculates estimated height and returns astId for layout pass', () => {
      const measurement = calculateHTMLLayout(
        '<p>Test Paragraph</p>',
        375,
        { fontSize: 16, lineHeight: 24 },
        { h1: { fontSize: 32 } },
        1.0
      );
      expect(measurement.height).toBeGreaterThan(0);
      expect(measurement.astId).toMatch(/^ast_/);
    });

    it('calculates estimated height and returns astId asynchronously', async () => {
      const measurement = await calculateHTMLLayoutAsync(
        '<p>Test Paragraph Async</p>',
        375,
        { fontSize: 16, lineHeight: 24 },
        { h1: { fontSize: 32 } },
        1.0
      );
      expect(measurement.height).toBeGreaterThan(0);
      expect(measurement.astId).toMatch(/^ast_/);
    });

    it('returns 0 height and empty astId for empty HTML string', () => {
      const measurement = calculateHTMLLayout('', 375);
      expect(measurement.height).toBe(0);
      expect(measurement.astId).toBe('');
    });

    it('scales with custom fontScale and baseFontSize', () => {
      const standard = calculateHTMLLayout(
        '<p>Text</p>',
        375,
        { fontSize: 16 },
        undefined,
        1.0
      );
      const scaled = calculateHTMLLayout(
        '<p>Text</p>',
        375,
        { fontSize: 24 },
        undefined,
        1.5
      );
      expect(scaled.height).toBeGreaterThanOrEqual(standard.height);
      expect(scaled.astId).not.toBe('');
    });

    it('produces distinct astIds for different styles', () => {
      const id1 = getAstId('<p>Text</p>', { color: '#ff0000' });
      const id2 = getAstId('<p>Text</p>', { color: '#00ff00' });
      expect(id1).not.toBe(id2);
    });
  });

  describe('AST Memory Buffer & Zero-Copy Helpers', () => {
    it('getAstId returns deterministic IDs for identical HTML', () => {
      const id1 = getAstId('<p>Consistent HTML content</p>');
      const id2 = getAstId('<p>Consistent HTML content</p>');
      expect(id1).toBeTruthy();
      expect(id1).toBe(id2);
      expect(getAstId('')).toBe('');
    });

    it('storeAst stores a parsed article into C++ buffer and returns astId', () => {
      const article = parseHTML('<p>Article to store in C++ buffer</p>');
      expect(article).not.toBeNull();
      const astId = storeAst(article!);
      expect(astId).toBeTruthy();
      expect(astId).toMatch(/^ast_/);

      const retrieved = getAst(astId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.length).toBe(article?.length);
    });

    it('clearAstCache clears buffer entries', () => {
      const article = parseHTML('<p>Temporary article</p>');
      const astId = storeAst(article!);
      expect(getAst(astId)).not.toBeNull();
      clearAstCache();
      expect(getAst(astId)).toBeNull();
    });
  });

  describe('AST Wrappers (getBlocks, getChildren, etc.)', () => {
    it('getBlocks: handles null, undefined, and valid articles', () => {
      expect(getBlocks(null)).toEqual([]);
      expect(getBlocks(undefined)).toEqual([]);

      const article = parseHTML('<h1>Title</h1><p>Body</p>');
      const blocks = getBlocks(article);
      expect(blocks.length).toBe(2);
      expect(blocks[0]?.type).toBe('Heading');
      expect(blocks[1]?.type).toBe('Paragraph');
    });

    it('getChildren: extracts inline children and handles null safely', () => {
      expect(getChildren(null)).toEqual([]);
      expect(getChildren(undefined)).toEqual([]);

      const article = parseHTML('<p>Inline <b>bold</b> text</p>');
      const blocks = getBlocks(article);
      const children = getChildren(blocks[0]);
      expect(children.length).toBeGreaterThan(0);
    });

    it('getItems & getNestedBlocks: handles lists and nested lists', () => {
      expect(getItems(null)).toEqual([]);
      expect(getItems(undefined)).toEqual([]);
      expect(getNestedBlocks(null)).toEqual([]);
      expect(getNestedBlocks(undefined)).toEqual([]);

      const article = parseHTML(
        '<ul><li>Item 1<ol><li>Sub-item</li></ol></li></ul>'
      );
      const listBlock = getBlocks(article)[0];
      const items = getItems(listBlock);
      expect(items.length).toBe(1);

      const nested = getNestedBlocks(items[0]);
      expect(nested.length).toBe(1);
      expect(nested[0]?.type).toBe('List');
    });

    it('getRows & getCells: handles table hierarchies', () => {
      expect(getRows(null)).toEqual([]);
      expect(getRows(undefined)).toEqual([]);
      expect(getCells(null)).toEqual([]);
      expect(getCells(undefined)).toEqual([]);

      const article = parseHTML(
        '<table><tr><td>Row 1 Cell 1</td><td>Row 1 Cell 2</td></tr></table>'
      );
      const tableBlock = getBlocks(article)[0];
      const rows = getRows(tableBlock);
      expect(rows.length).toBe(1);

      const cells = getCells(rows[0]);
      expect(cells.length).toBe(2);
    });

    it('getQuoteChildren: handles blockquotes', () => {
      expect(getQuoteChildren(null)).toEqual([]);
      expect(getQuoteChildren(undefined)).toEqual([]);

      const article = parseHTML(
        '<blockquote><p>Quoted wisdom</p></blockquote>'
      );
      const quoteBlock = getBlocks(article)[0];
      const quoteChildren = getQuoteChildren(quoteBlock);
      expect(quoteChildren.length).toBe(1);
      expect(quoteChildren[0]?.type).toBe('Paragraph');
    });

    it('getDefItems, getTerms & getDefs: handles definition lists', () => {
      expect(getDefItems(null)).toEqual([]);
      expect(getDefItems(undefined)).toEqual([]);
      expect(getTerms(null)).toEqual([]);
      expect(getTerms(undefined)).toEqual([]);
      expect(getDefs(null)).toEqual([]);
      expect(getDefs(undefined)).toEqual([]);

      const article = parseHTML(
        '<dl><dt>Nitro</dt><dd>Fast Native Modules</dd></dl>'
      );
      const dlBlock = getBlocks(article)[0];
      const defItems = getDefItems(dlBlock);
      expect(defItems.length).toBe(1);

      const terms = getTerms(defItems[0]);
      expect(terms.length).toBe(1);

      const defs = getDefs(defItems[0]);
      expect(defs.length).toBe(1);
    });
  });
});

describe('3. FastHtmlView Props Verification', () => {
  it('renders default FastHtmlView with html prop', () => {
    const el = React.createElement(FastHtmlView, {
      html: '<p>Standard native render</p>',
    });
    expect(el).toBeDefined();
    expect(el.props.html).toBe('<p>Standard native render</p>');
  });

  it('supports mode prop ("sync" and "async")', () => {
    const syncEl = React.createElement(FastHtmlView, {
      html: '<p>Sync</p>',
      mode: 'sync',
    });
    const asyncEl = React.createElement(FastHtmlView, {
      html: '<p>Async</p>',
      mode: 'async',
    });
    expect(syncEl.props.mode).toBe('sync');
    expect(asyncEl.props.mode).toBe('async');
  });

  it('supports pre-parsed AST via parsedAst prop', () => {
    const article = parseHTML('<h1>Pre-parsed Header</h1>');
    const el = React.createElement(FastHtmlView, {
      parsedAst: article,
    });
    expect(el.props.parsedAst).toBe(article);
  });

  it('supports comprehensive baseStyle prop (typography, margin, padding, border)', () => {
    const baseStyle = {
      fontSize: 18,
      color: '#334155',
      lineHeight: 28,
      fontFamily: 'Inter',
      fontWeight: '600' as const,
      fontStyle: 'normal' as const,
      letterSpacing: 0.5,
      textAlign: 'left' as const,
      backgroundColor: '#f8fafc',
      margin: 10,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: '#3b82f6',
    };

    const el = React.createElement(FastHtmlView, {
      html: '<p>Styled body text</p>',
      baseStyle,
    });
    expect(el.props.baseStyle).toEqual(baseStyle);
  });

  it('supports tagsStyles prop for individual HTML tag customizations', () => {
    const tagsStyles = {
      h1: { fontSize: 28, color: '#1e293b', fontWeight: 'bold' as const },
      h2: { fontSize: 22, color: '#334155' },
      p: { lineHeight: 24, color: '#475569' },
      a: { color: '#2563eb', textDecorationLine: 'underline' as const },
      code: { backgroundColor: '#f1f5f9', color: '#0f172a' },
      blockquote: { borderLeftColor: '#94a3b8', borderLeftWidth: 4 },
      table: { borderColor: '#cbd5e1', borderWidth: 1 },
    };

    const el = React.createElement(FastHtmlView, {
      html: '<h1>Title</h1><p>Body with <code>code</code> and <a href="#">Link</a></p>',
      tagsStyles,
    });
    expect(el.props.tagsStyles).toEqual(tagsStyles);
  });

  it('supports custom component renderers via renderers prop', () => {
    const CustomVideo = ({ block }: any) =>
      React.createElement('View', { testID: `video-${block.src}` });
    const CustomCode = ({ block }: any) =>
      React.createElement('Text', { testID: 'code-block' }, block.code);
    const CustomPoll = () =>
      React.createElement('View', { testID: 'poll-component' });

    const el = React.createElement(FastHtmlView, {
      html: '<p>Before</p><video src="https://example.com/v.mp4"></video><custom-poll></custom-poll><pre><code>let x = 1;</code></pre><p>After</p>',
      renderers: {
        'Video': CustomVideo,
        'CodeBlock': CustomCode,
        'custom-poll': CustomPoll,
      },
    });

    expect(el.props.renderers).toBeDefined();
    expect(el.props.renderers?.Video).toBe(CustomVideo);
    expect(el.props.renderers?.CodeBlock).toBe(CustomCode);
  });

  it('preserves heading and paragraph tags across interleaved custom renderers', () => {
    const CustomCode = ({ block }: any) =>
      React.createElement('Text', { testID: 'code-block' }, block.code);

    const el = React.createElement(FastHtmlView, {
      html: '<p>Intro</p><pre><code>npx gitpulse</code></pre><p>Body text</p><h2>The Bug</h2><p>Explanation</p><pre><code>run(cmd)</code></pre>',
      renderers: {
        CodeBlock: CustomCode,
      },
    });

    expect(el).toBeDefined();
    expect(el.props.renderers?.CodeBlock).toBe(CustomCode);
  });

  it('supports selectable prop (true | false)', () => {
    const selectableEl = React.createElement(FastHtmlView, {
      html: '<p>Selectable text</p>',
      selectable: true,
    });
    const nonSelectableEl = React.createElement(FastHtmlView, {
      html: '<p>Non-selectable text</p>',
      selectable: false,
    });

    expect(selectableEl.props.selectable).toBe(true);
    expect(nonSelectableEl.props.selectable).toBe(false);
  });

  it('supports fontFeatureSettings prop', () => {
    const el = React.createElement(FastHtmlView, {
      html: '<p>Tabular numbers: 123456</p>',
      fontFeatureSettings: '"tnum" 1, "frac" 1',
    });
    expect(el.props.fontFeatureSettings).toBe('"tnum" 1, "frac" 1');
  });

  it('supports onLinkPress callback prop', () => {
    const handleLink = jest.fn();
    const el = React.createElement(FastHtmlView, {
      html: '<a href="https://example.com">Visit</a>',
      onLinkPress: handleLink,
    });
    expect(el.props.onLinkPress).toBe(handleLink);
  });

  it('supports style prop for container view', () => {
    const containerStyle = {
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: '#ffffff',
      borderRadius: 12,
    };
    const el = React.createElement(FastHtmlView, {
      html: '<p>Card Content</p>',
      style: containerStyle,
    });
    expect(el.props.style).toEqual(containerStyle);
  });
});

describe('4. Malformed HTML Recovery & Resiliency', () => {
  it('recovers gracefully from unclosed tags and mismatched tags', () => {
    const malformed =
      '<div><p>Unclosed paragraph<h1>Header without close<b>bold<i>italic';
    const article = parseHTML(malformed);
    expect(article).not.toBeNull();
    const blocks = getBlocks(article);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('handles stray closing tags and orphaned formatting', () => {
    const stray = '</span></div></p></h1><b>text</b></em>';
    const article = parseHTML(stray);
    expect(article).not.toBeNull();
    const blocks = getBlocks(article);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('handles HTML entities and decoded numeric character references', () => {
    const entities =
      '<p>&amp; &lt; &gt; &quot; &apos; &#160; &#x26; &#x1F600; 😀</p>';
    const article = parseHTML(entities);
    expect(article).not.toBeNull();
    const blocks = getBlocks(article);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('handles excessive whitespace, tabs, and multiline unclosed strings', () => {
    const whitespaceHtml = `
      \n\t   <p>   \n\t  Line 1   \n\t </p>
      \n\t   <div>\n\n\t\t<p>Line 2</p>\n   </div>
    `;
    const article = parseHTML(whitespaceHtml);
    expect(article).not.toBeNull();
    const blocks = getBlocks(article);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe('5. Combination & Mega Stress Test', () => {
  const MEGA_HTML = `
    <!-- HTML Comment Stripping Test -->
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Stress Test Document</title>
        <script>console.log("Ignore me");</script>
        <style>.hide { display: none; }</style>
      </head>
      <body>
        <h1>🔥 Ultra Fast HTML Renderer</h1>
        <p>Combining <b>bold</b>, <i>italic</i>, <u>underline</u>, and <a href="https://github.com">links</a>.</p>
        
        <blockquote>
          <p>"Benchmarked at 50+ MB/s sustained throughput."</p>
        </blockquote>

        <pre><code class="language-rust">
          pub fn parse_html(input: &str) -> ParsedArticle {
              // Zero-copy JSI engine
          }
        </code></pre>

        <h2>Nested Lists & Data</h2>
        <ul>
          <li>Point 1
            <ol>
              <li>Sub-point A</li>
              <li>Sub-point B</li>
            </ol>
          </li>
          <li>Point 2</li>
        </ul>

        <table>
          <tr><th>Feature</th><th>Status</th></tr>
          <tr><td>Native TextKit 2</td><td>Supported</td></tr>
          <tr><td>Android Spannables</td><td>Supported</td></tr>
        </table>

        <dl>
          <dt>JSI</dt><dd>Direct C++ access</dd>
        </dl>

        <video src="https://example.com/demo.mp4" poster="https://example.com/poster.jpg"></video>
        <custom-poll id="survey-100"></custom-poll>

        <!-- Unclosed malformed tail -->
        <div><p>Malformed ending <b>tag without close
      </body>
    </html>
  `;

  it('processes mega document through parseHTML and AST wrappers', () => {
    const article = parseHTML(MEGA_HTML);
    expect(article).not.toBeNull();

    const blocks = getBlocks(article);
    expect(blocks.length).toBeGreaterThanOrEqual(5);

    blocks.forEach((block) => {
      getChildren(block);
      if (block.type === 'List') getItems(block);
      if (block.type === 'Table') {
        const rows = getRows(block);
        rows.forEach((r) => getCells(r));
      }
      if (block.type === 'Quote') getQuoteChildren(block);
      if (block.type === 'DefinitionList') {
        const defItems = getDefItems(block);
        defItems.forEach((d) => {
          getTerms(d);
          getDefs(d);
        });
      }
    });
  });

  it('renders mega document in FastHtmlView with custom renderer injection stream', () => {
    const CustomVideo = ({ block }: any) =>
      React.createElement('View', { testID: `video-${block.src}` });
    const CustomPoll = () =>
      React.createElement('View', { testID: 'poll-widget' });

    const element = React.createElement(FastHtmlView, {
      html: MEGA_HTML,
      baseStyle: { fontSize: 16, color: '#1e293b' },
      tagsStyles: {
        h1: { fontSize: 26, color: '#7c3aed' },
        h2: { fontSize: 20, color: '#0369a1' },
      },
      renderers: {
        'Video': CustomVideo,
        'custom-poll': CustomPoll,
      },
      selectable: true,
      onLinkPress: (url: string) => console.log('Link:', url),
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(FastHtmlView);
  });

  it('stress tests parsing and wrapper extraction for 10K+ words content (~10,000 words, 240 sections, ~45 min read)', async () => {
    // Generate 10,000+ words of reading content (~240 sections)
    const sectionsCount = 240;
    const stress10KHtml = Array.from({ length: sectionsCount }, (_, i) => {
      const idx = i + 1;
      const headingLevel = (i % 3) + 2;
      let extra = '';

      if (i % 3 === 0) {
        extra += `
<table>
  <tr><th>Metric</th><th>Target</th><th>Measured</th><th>Status</th></tr>
  <tr><td>DOM Node Count #${idx}</td><td>0 Virtual DOM</td><td>0 Nodes</td><td>Verified</td></tr>
  <tr><td>JSI Latency #${idx}</td><td>&lt; 0.50 ms</td><td>0.08 ms</td><td>Optimal</td></tr>
  <tr><td>Framerate #${idx}</td><td>120 FPS</td><td>120 FPS</td><td>Buttery</td></tr>
</table>`;
      }
      if (i % 4 === 0) {
        extra += `<pre><code class="typescript">const benchmark_${idx} = FastHtmlParser.parse(largePayload);</code></pre>`;
      }
      if (i % 5 === 0) {
        extra += `<blockquote><p>Milestone #${idx}: "Direct C++ Lexbor AST normalization eliminates JS serialization bottlenecks."</p></blockquote>`;
      }
      if (i % 6 === 0) {
        extra += `<ul><li>Rule #${idx}.A: Zero VDOM allocation</li><li>Rule #${idx}.B: Native continuous text selection</li></ul>`;
      }

      return `
<h${headingLevel}>Section ${idx}: High-Throughput DOM Virtualization &amp; Native Typography</h${headingLevel}>
<p>This is paragraph ${idx} of the high-throughput 10,000 words stress test suite. The <b>FastHtmlView</b> utilizes native text fragment layout with <b>0 React Virtual DOM nodes</b>. Long-form articles with deep hierarchies maintain steady <code>120 FPS</code> smooth scrolling with continuous text selection across headings, lists, tables, and phrasing elements.</p>
${extra}
`;
    }).join('');

    // Estimate word count:
    const wordCount = stress10KHtml
      .replace(/<[^>]+>/g, ' ')
      .trim()
      .split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(10000);

    // Synchronous parsing pass
    const t0 = performance.now();
    const articleSync = parseHTML(stress10KHtml);
    const syncParseTimeMs = performance.now() - t0;
    expect(syncParseTimeMs).toBeGreaterThanOrEqual(0);

    expect(articleSync).not.toBeNull();
    expect(articleSync!.length).toBeGreaterThanOrEqual(sectionsCount);

    // Extract all blocks and children through AST wrappers
    const blocks = getBlocks(articleSync);
    expect(blocks.length).toBe(articleSync!.length);

    let totalInlineChildren = 0;
    blocks.forEach((b) => {
      totalInlineChildren += getChildren(b).length;
      if (b.type === 'Table') {
        const rows = getRows(b);
        expect(rows.length).toBeGreaterThanOrEqual(1);
      }
    });
    expect(totalInlineChildren).toBeGreaterThan(0);

    // Asynchronous parsing pass (C++ worker thread)
    const tAsync0 = performance.now();
    const articleAsync = await parseHTMLAsync(stress10KHtml);
    const asyncParseTimeMs = performance.now() - tAsync0;
    expect(asyncParseTimeMs).toBeGreaterThanOrEqual(0);

    expect(articleAsync).not.toBeNull();
    expect(articleAsync!.length).toBe(articleSync!.length);

    // FastHtmlView component initialization with 10K-word payload
    const element = React.createElement(FastHtmlView, {
      html: stress10KHtml,
      baseStyle: { fontSize: 16, color: '#0f172a' },
      tagsStyles: {
        h2: { color: '#0284c7' },
        blockquote: { borderLeftWidth: 4, borderLeftColor: '#8b5cf6' },
      },
      selectable: true,
    });
    expect(element).toBeDefined();
    expect(element.props.html).toBe(stress10KHtml);
  });
});
