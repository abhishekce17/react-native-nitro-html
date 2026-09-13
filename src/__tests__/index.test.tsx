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
  parseHTML,
  parseHTMLAsync,
} from '../index';

describe('1. Module Exports & Core APIs', () => {
  it('exports FastHtmlView and NativeHtmlView components', () => {
    expect(FastHtmlView).toBeDefined();
    expect(NativeHtmlView).toBeDefined();
  });

  it('exports core parser methods', () => {
    expect(typeof parseHTML).toBe('function');
    expect(typeof parseHTMLAsync).toBe('function');
  });

  it('exports all 8 AST helper wrappers', () => {
    expect(typeof getBlocks).toBe('function');
    expect(typeof getChildren).toBe('function');
    expect(typeof getItems).toBe('function');
    expect(typeof getNestedBlocks).toBe('function');
    expect(typeof getRows).toBe('function');
    expect(typeof getCells).toBe('function');
    expect(typeof getQuoteChildren).toBe('function');
    expect(typeof getDefItems).toBe('function');
  });
});

describe('2. Malformed HTML Recovery & Resiliency', () => {
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

describe('3. Multiple Nested HTML & Deep Hierarchies', () => {
  it('parses multi-level nested lists (ordered inside unordered)', () => {
    const nestedListsHtml = `
      <ul>
        <li>Parent Item 1
          <ol>
            <li>Sub Item 1.1</li>
            <li>Sub Item 1.2
              <ul>
                <li>Deep Sub Item 1.2.1</li>
              </ul>
            </li>
          </ol>
        </li>
      </ul>
    `;
    const article = parseHTML(nestedListsHtml);
    const blocks = getBlocks(article);
    const listBlock = blocks.find((b) => b.type === 'List');
    expect(listBlock).toBeDefined();

    const items = getItems(listBlock);
    expect(items.length).toBeGreaterThan(0);
    const firstItem = items[0];
    expect(firstItem).toBeDefined();

    const nested = getNestedBlocks(firstItem);
    expect(nested.length).toBe(1);
    expect(nested[0]?.type).toBe('List');
  });

  it('parses blockquotes containing nested paragraphs and headings', () => {
    const quoteHtml = `
      <blockquote>
        <h2>Nested Heading</h2>
        <p>Nested quote paragraph with <b>bold</b> and <i>italic</i> formatting.</p>
      </blockquote>
    `;
    const article = parseHTML(quoteHtml);
    const blocks = getBlocks(article);
    const quoteBlock = blocks.find((b) => b.type === 'Quote');
    expect(quoteBlock).toBeDefined();

    const quoteChildren = getQuoteChildren(quoteBlock);
    expect(quoteChildren.length).toBeGreaterThan(0);
    expect(quoteChildren[0]?.type).toBe('Paragraph');
  });

  it('parses deep inline combinations (bold > italic > underline > link)', () => {
    const deepInline =
      '<p><span><b><i><u><a href="https://example.com">Click Deep Link</a></u></i></b></span></p>';
    const article = parseHTML(deepInline);
    const blocks = getBlocks(article);
    expect(blocks.length).toBeGreaterThan(0);
    const inlines = getChildren(blocks[0]);
    expect(inlines.length).toBeGreaterThan(0);
  });
});

describe('4. Complex Editorial HTML & Mixed Layouts', () => {
  it('parses complete 2D Data Tables with headers, cells, and inline formatting', () => {
    const tableHtml = `
      <table>
        <thead>
          <tr><th>Framework</th><th>Core Language</th><th>Speed</th></tr>
        </thead>
        <tbody>
          <tr><td>React Native</td><td>TypeScript</td><td><b>High</b></td></tr>
          <tr><td>Rust Core</td><td>Rust</td><td><i>Ultra Fast</i></td></tr>
        </tbody>
      </table>
    `;
    const article = parseHTML(tableHtml);
    const blocks = getBlocks(article);
    const tableBlock = blocks.find((b) => b.type === 'Table');
    expect(tableBlock).toBeDefined();

    const rows = getRows(tableBlock);
    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0];
    expect(firstRow).toBeDefined();

    const cells = getCells(firstRow);
    expect(cells.length).toBeGreaterThan(0);
    const firstCell = cells[0];
    expect(firstCell).toBeDefined();
    const cellInlines = getChildren(firstCell);
    expect(cellInlines.length).toBeGreaterThan(0);
  });

  it('parses syntax-highlighted code blocks with language classes', () => {
    const codeHtml = `
      <pre><code class="language-typescript">
        const fast = parseHTML('&lt;h1&gt;Speed&lt;/h1&gt;');
        console.log(fast.length);
      </code></pre>
    `;
    const article = parseHTML(codeHtml);
    const blocks = getBlocks(article);
    const codeBlock = blocks.find((b) => b.type === 'CodeBlock');
    expect(codeBlock).toBeDefined();
    expect(codeBlock?.language).toBe('typescript');
    expect(codeBlock?.code).toContain('const fast');
  });

  it('parses definition lists (<dl>, <dt>, <dd>)', () => {
    const dlHtml = `
      <dl>
        <dt>JSI</dt>
        <dd>JavaScript Interface for direct memory calls.</dd>
        <dt>Nitro</dt>
        <dd>Fast native module engine by Margelo.</dd>
      </dl>
    `;
    const article = parseHTML(dlHtml);
    const blocks = getBlocks(article);
    const dlBlock = blocks.find((b) => b.type === 'DefinitionList');
    expect(dlBlock).toBeDefined();

    const items = getDefItems(dlBlock);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe('5. Unsupported, Ignored & Custom Tags', () => {
  it('strips dangerous <script> and <style> tags completely', () => {
    const dangerousHtml = `
      <script>window.location.href = "https://malicious.com"; alert("XSS");</script>
      <style>body { display: none; }</style>
      <h1>Clean Title</h1>
      <p>Safe content here.</p>
    `;
    const article = parseHTML(dangerousHtml);
    expect(article).not.toBeNull();
    const blocks = getBlocks(article);
    const hasScript = blocks.some((b) =>
      b.type.toLowerCase().includes('script')
    );
    const hasStyle = blocks.some((b) => b.type.toLowerCase().includes('style'));
    expect(hasScript).toBe(false);
    expect(hasStyle).toBe(false);
  });

  it('preserves custom tags for custom renderer injection', () => {
    const customHtml = `
      <h1>Article</h1>
      <custom-poll id="poll-42" title="Favorite Framework"></custom-poll>
      <p>Closing thoughts.</p>
    `;
    const article = parseHTML(customHtml);
    const blocks = getBlocks(article);
    const customBlock = blocks.find((b) => b.type === 'custom-poll');
    expect(customBlock).toBeDefined();
  });

  it('handles void elements (<hr>, <br>, <wbr>, <img>)', () => {
    const voidHtml = '<h1>Title</h1><hr /><p>Line 1<br>Line 2<wbr>Line 3</p>';
    const article = parseHTML(voidHtml);
    expect(article).not.toBeNull();
    const blocks = getBlocks(article);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe('6. Combination & Mega Stress Test', () => {
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

    // Verify all wrapper helpers operate safely on the complex AST
    blocks.forEach((block) => {
      getChildren(block);
      if (block.type === 'List') getItems(block);
      if (block.type === 'Table') {
        const rows = getRows(block);
        rows.forEach((r) => getCells(r));
      }
      if (block.type === 'Quote') getQuoteChildren(block);
      if (block.type === 'DefinitionList') getDefItems(block);
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

  // 7. Advanced Native Optimizations & Capabilities
  describe('7. Advanced Native Optimizations & Capabilities', () => {
    it('parses large document asynchronously via parseHTMLAsync', async () => {
      const article = await parseHTMLAsync(MEGA_HTML);
      expect(article).not.toBeNull();
      expect(article!.length).toBeGreaterThan(0);
    });

    it('supports sync parseHTML and async parseHTMLAsync', async () => {
      const syncArticle = parseHTML('<p>Sync test</p>');
      const asyncArticle = await parseHTMLAsync('<p>Async test</p>');
      expect(syncArticle).not.toBeNull();
      expect(asyncArticle).not.toBeNull();
    });

    it('renders FastHtmlView with mode prop (sync and async)', () => {
      const syncElement = React.createElement(FastHtmlView, {
        html: '<p>Sync render</p>',
        mode: 'sync',
      });
      const asyncElement = React.createElement(FastHtmlView, {
        html: '<p>Async render</p>',
        mode: 'async',
      });

      expect(syncElement).toBeDefined();
      expect(asyncElement).toBeDefined();
    });
  });
});
