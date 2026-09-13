# react-native-nitro-html

[![npm](https://img.shields.io/npm/v/react-native-nitro-html?color=orange&label=npm)](https://www.npmjs.com/package/react-native-nitro-html)
[![license](https://img.shields.io/npm/l/react-native-nitro-html?color=green&label=license)](LICENSE)
[![platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey)](https://github.com/abhishekce17/react-native-nitro-html)
[![nitro](https://img.shields.io/badge/powered%20by-Nitro%20Modules-blue)](https://nitro.margelo.com)
[![cpp](https://img.shields.io/badge/core-C%2B%2B%20(Lexbor)-blue?logo=c%2B%2B)](https://github.com/lexbor/lexbor)

An ultra-fast, production-ready HTML Content & Editorial Pipeline for React Native. Engineered specifically for rich editorial apps, blogs, news feeds, documentation readers, and high-throughput content streams where traditional JavaScript-based HTML renderers suffer from thread lockups, frame drops, and bloated Virtual DOM overhead.

Powered by the spec-compliant **C++ Lexbor v2.3.0** engine and bound directly to the native runtime via zero-copy **Margelo Nitro Modules** (JSI):

- **0 React Virtual DOM Allocations**: Renders multi-paragraph articles directly into **Apple TextKit 2** (iOS) and **Precomputed Spannables** (Android) for rock-solid **120 FPS scrolling**.
- **Continuous Multi-Paragraph Text Selection**: Drag native selection handles seamlessly across headings, paragraphs, blockquotes, and lists in a single continuous native gesture.
- **Custom Component Slot Injection**: Intercept specific blocks (`<video>`, interactive widgets, code snippets) and inject custom React components seamlessly into the native stream while preserving full React state.
- **Dual Pipeline Architecture**: Lazy native-backed AST access for instant UI rendering, plus a **1-Pass Native JSON pipeline** (`parseHTMLToJSON`) for offline caching in MMKV, SQLite, or WatermelonDB.

---

## 📑 Table of Contents

- [Features](#-features)
- [Empirical Benchmarks](#-empirical-benchmarks)
- [Installation & Setup](#-installation--setup)
- [Architecture Overview](#-architecture-overview)
- [💡 Best Practices (Do's and Don'ts)](#-best-practices-dos-and-donts)
- [🎨 React Native UI Components](#-react-native-ui-components)
  - [`<FastHtmlView />`](#fasthtmlview-)
  - [All Props Reference](#all-props-reference)
  - [Comprehensive Props Examples](#comprehensive-props-examples)
- [🧱 All Supported HTML Content Blocks](#-all-supported-html-content-blocks)
  - [1. Paragraphs (`<p>`)](#1-paragraphs-p)
  - [2. Headings (`<h1>` to `<h6>`)](#2-headings-h1-to-h6)
  - [3. Blockquotes & Quotes (`<blockquote>`, `<q>`)](#3-blockquotes--quotes-blockquote-q)
  - [4. Code Blocks (`<pre><code>`)](#4-code-blocks-precode)
  - [5. Lists & Nested Lists (`<ul>`, `<ol>`, `<li>`)](#5-lists--nested-lists-ul-ol-li)
  - [6. Data Tables (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`)](#6-data-tables-table-thead-tbody-tr-th-td)
  - [7. Images & Figures (`<img>`, `<figure>`, `<figcaption>`)](#7-images--figures-img-figure-figcaption)
  - [8. Thematic Break / Dividers (`<hr>`)](#8-thematic-break--dividers-hr)
  - [9. Definition Lists (`<dl>`, `<dt>`, `<dd>`)](#9-definition-lists-dl-dt-dd)
  - [10. Inline Phrasing & Spans (`<b>`, `<i>`, `<a>`, `<mark>`, `<sub>`, `<sup>`, etc.)](#10-inline-phrasing--spans)
- [🔌 Core Methods & Functions API](#-core-methods--functions-api)
  - [`parseHTML(html)`](#1-parsehtmlhtml)
  - [`parseHTMLAsync(html)`](#2-parsehtmlasynchtml)
  - [`normalizeHTML(html)`](#3-normalizehtmlhtml)
  - [`calculateHTMLHeight(html, width, baseFontSize, baseLineHeight, fontScale)`](#4-calculatehtmlheighthtml-width-basefontsize-baselineheight-fontscale)
  - [`parseHTMLToJSON(html)`](#5-parsehtmltojsonhtml)
- [🗂️ Zero-Dependency AST Wrappers](#-zero-dependency-ast-wrappers)
  - [`getBlocks(article)`](#getblocksarticle)
  - [`getChildren(node)`](#getchildrennode)
  - [`getItems(block)`](#getitemsblock)
  - [`getNestedBlocks(item)`](#getnestedblocksitem)
  - [`getRows(block)`](#getrowsblock)
  - [`getCells(row)`](#getcellsrow)
  - [`getQuoteChildren(block)`](#getquotechildrenblock)
  - [`getDefItems(block)`](#getdefitemsblock)
  - [`getTerms(item)`](#gettermsitem)
  - [`getDefs(item)`](#getdefsitem)
- [🎮 Low-Level Native Fabric View (`<NativeHtmlView />`)](#-low-level-native-fabric-view-nativehtmlview-)
- [License](#-license)

---

## 🚀 Features

- **Blazing Fast Native Core**: Sub-millisecond HTML parsing written in C++ (Lexbor v2.3.0) and compiled directly into native machine code.
- **100% Native Fabric RichText Engine (`<FastHtmlView />`)**: Backed by Apple TextKit 2 on iOS and Precomputed Spannables on Android with **0 React Virtual DOM allocations** for maximum 120 FPS performance.
- **Continuous Multi-Paragraph Text Selection**: Select and copy text seamlessly across multiple headings, paragraphs, blockquotes, and lists in a single continuous native gesture.
- **Bug-Free Custom Renderer Injector**: Inject custom React components (`renderers={{ Video: CustomVideo, CodeBlock: CustomCode }}`) seamlessly into the native stream with full React state, hooks, and context lifecycle.
- **1-Pass Native JSON Pipeline**: Direct `parseHTMLToJSON()` native serialization for SQLite, MMKV, WatermelonDB, and Redux caching.
- **Print-Grade Typography & OpenType**: Native support for `fontFeatureSettings` (tabular numbers `"tnum"`, fractions `"frac"`, small-caps `"smcp"`, slashed zero `"zero"`) and 100–900 numeric font weights.
- **Horizontal Scroll Native Tables**: Fluid horizontal data tables with zero subview bloat and automatic dynamic color theme resolution.

---

## ⚡ Empirical Benchmarks

Measured on native C++ (Lexbor) engine across standard payload tiers:

| Payload Tier | Exact Size  | AST Blocks     | Parse Time      | 1-Pass JSON Time | Total Time      | Sustained Throughput |
| :----------- | :---------- | :------------- | :-------------- | :--------------- | :-------------- | :------------------- |
| **1 KB**     | 1.13 KB     | 6 blocks       | **0.005 ms**    | 0.003 ms         | **0.008 ms**    | 130.99 MB/s          |
| **10 KB**    | 10.18 KB    | 55 blocks      | **0.038 ms**    | 0.028 ms         | **0.066 ms**    | 150.58 MB/s          |
| **100 KB**   | 100.10 KB   | 541 blocks     | **0.377 ms**    | 0.269 ms         | **0.646 ms**    | 151.27 MB/s          |
| **500 KB**   | 500.08 KB   | 2,697 blocks   | **1.897 ms**    | 1.343 ms         | **3.241 ms**    | 150.70 MB/s          |
| **1 MB**     | 1,024.46 KB | 5,506 blocks   | **3.908 ms**    | 2.824 ms         | **6.732 ms**    | 148.60 MB/s          |
| **5 MB**     | 5,120.10 KB | 27,439 blocks  | **19.684 ms**   | 13.966 ms        | **33.650 ms**   | 148.59 MB/s          |

---

## 📦 Installation & Setup

```bash
# Using npm
npm install react-native-nitro-html react-native-nitro-modules

# Using yarn
yarn add react-native-nitro-html react-native-nitro-modules
```

### iOS Setup

```bash
cd ios && pod install
```

### Android Setup

No additional configuration required. Android builds automatically link native C++ artifacts via CMake and Nitro Modules.

---

## 🏗 Architecture Overview

```text
               Raw HTML Input String
                         │
                         ▼
        ┌─────────────────────────────────┐
        │       C++ (Lexbor) Engine       │
        │   HTML5 Tokenizer & DOM Walker  │
        └────────────────┬────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌──────────────────┐           ┌──────────────────┐
│  Lazy JSI Hybrid │           │   1-Pass Native  │
│   Object Tree    │           │   JSON String    │
└────────┬─────────┘           └────────┬─────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐           ┌──────────────────┐
│  <FastHtmlView>  │           │   MMKV / SQLite  │
│  Native Fabric UI│           │  State & Cache   │
└──────────────────┘           └──────────────────┘
```

---

## 💡 Best Practices (Do's and Don'ts)

| Category | ✅ DO | ❌ DON'T |
| :--- | :--- | :--- |
| **Style Memoization** | Memoize `baseStyle` and `tagsStyles` with `useMemo` or declare them outside component renders. | Don't pass inline new object literals `baseStyle={{ fontSize: 16 }}` inside high-frequency re-rendering parent components. |
| **Document Slicing** | Pass the whole article HTML directly into a single `<FastHtmlView />` to maintain 0 VDOM overhead and 120 FPS native scrolling. | Don't split HTML into 50 separate `<FastHtmlView />` instances for each paragraph. |
| **Massive Payloads (10K+ words)** | Use `mode="async"` or `parseHTMLAsync()` to offload AST tokenization to background C++ worker threads. | Don't run synchronous parsing of massive multi-megabyte HTML strings on the JS main thread. |
| **List Virtualization (`FlashList`)** | Use `parseHTML(html)` once, extract blocks with `getBlocks(article)`, and pass `parsedAst` to list items. | Don't re-parse raw HTML strings inside every list item row's render function. |
| **Custom Renderers** | Use `renderers` only for interactive, media, or dynamic components (e.g. `<video>`, polls, live charts). | Don't replace standard typography blocks (`Paragraph`, `Heading`) with custom React renderers unless custom interactive JSX state is required. |
| **Text Selection** | Keep `selectable={true}` to provide continuous native iOS/Android cursor dragging and copy-paste. | Don't wrap `<FastHtmlView />` in non-selectable gesture blockers if users need text copying. |

---

## 🎨 React Native UI Components

### `<FastHtmlView />`

The primary component that translates HTML directly into **Apple TextKit 2** on iOS and **Precomputed Spannables** on Android with **0 React Virtual DOM nodes**.

---

### All Props Reference

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `html` | `string` | `undefined` | The raw HTML string to parse and render. |
| `mode` | `'sync' \| 'async'` | `'sync'` | Parsing mode (`'sync'` on main thread or `'async'` offloaded to C++ worker pool). |
| `parsedAst` | `ParsedArticle \| null` | `undefined` | Pre-parsed AST object (used for "parse once, render many" workflows). |
| `baseStyle` | `TextStyle & { fontFeatureSettings?: string }` | `undefined` | Base typography style inherited by all text elements. |
| `tagsStyles` | `Record<string, TextStyle \| ViewStyle>` | `{}` | Tag-level style overrides (`h1`, `p`, `a`, `code`, `blockquote`, `table`, etc.). |
| `renderers` | `Record<string, CustomBlockRenderer>` | `{}` | Custom React component overrides for specific block types (Video, Code, Polls). |
| `selectable` | `boolean` | `true` | Enables continuous native multi-paragraph text selection. |
| `fontFeatureSettings`| `string` | `undefined` | OpenType font feature settings (e.g. `'"tnum" 1'`, `'"frac" 1'`, `'"smcp" 1'`). |
| `onLinkPress` | `(url: string) => void` | `undefined` | Callback invoked when an `<a>` hyperlink is pressed. |
| `style` | `ViewStyle` | `undefined` | Container style for the root `<View>`. |

---

### Comprehensive Props Examples

#### 1. `html`, `baseStyle`, and `tagsStyles`
```tsx
import React, { useMemo } from 'react';
import { FastHtmlView } from 'react-native-nitro-html';

export function StyledArticle() {
  const baseStyle = useMemo(() => ({
    fontSize: 16,
    color: '#334155',
    lineHeight: 26,
    fontFamily: 'System',
  }), []);

  const tagsStyles = useMemo(() => ({
    h1: { fontSize: 26, color: '#0f172a', fontWeight: '800' as const, marginBottom: 12 },
    h2: { fontSize: 20, color: '#1e293b', fontWeight: '700' as const, marginTop: 16, marginBottom: 8 },
    p: { color: '#475569', lineHeight: 24 },
    a: { color: '#2563eb', textDecorationLine: 'underline' as const },
    blockquote: { backgroundColor: '#f8fafc', borderLeftColor: '#3b82f6', borderLeftWidth: 4, paddingLeft: 12 },
    code: { backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: 'Courier' },
    table: { borderColor: '#cbd5e1', borderWidth: 1 },
    th: { backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold' as const },
  }), []);

  return (
    <FastHtmlView
      html="<h1>Editorial Title</h1><p>Styled article text with <a href='https://example.com'>link</a>.</p>"
      baseStyle={baseStyle}
      tagsStyles={tagsStyles}
    />
  );
}
```

#### 2. `mode="async"` (Background C++ Worker Thread Offloading)
```tsx
<FastHtmlView
  html={massiveHtmlPayload}
  mode="async" // Offloads Lexbor tokenization to a thread-safe C++ worker pool
  baseStyle={{ fontSize: 15, color: '#1e293b' }}
/>
```

#### 3. `parsedAst` (Parse Once, Render Many)
```tsx
import React, { useMemo } from 'react';
import { parseHTML, FastHtmlView } from 'react-native-nitro-html';

export function CachedAstScreen({ rawHtml }: { rawHtml: string }) {
  // 1. Parse AST once and memoize
  const parsedAst = useMemo(() => parseHTML(rawHtml), [rawHtml]);

  return (
    <FastHtmlView
      parsedAst={parsedAst}
      baseStyle={{ fontSize: 16, color: '#1e293b' }}
    />
  );
}
```

#### 4. `renderers` (Custom Component Slot Injection)
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FastHtmlView, type CustomBlockRenderer } from 'react-native-nitro-html';

// Custom Video Renderer
const CustomVideoRenderer: CustomBlockRenderer = ({ block }) => (
  <View style={styles.videoCard}>
    <Text style={styles.videoText}>🎬 Video Player: {block.url}</Text>
  </View>
);

export function MediaArticle() {
  const html = `
    <h1>Media Rich Article</h1>
    <p>Standard text renders natively below.</p>
    <video src="https://example.com/stream.mp4"></video>
  `;

  return (
    <FastHtmlView
      html={html}
      renderers={{
        Video: CustomVideoRenderer,
      }}
    />
  );
}

const styles = StyleSheet.create({
  videoCard: { backgroundColor: '#000', padding: 24, borderRadius: 8, marginVertical: 12, alignItems: 'center' },
  videoText: { color: '#fff', fontWeight: 'bold' },
});
```

#### 5. `fontFeatureSettings` (OpenType Typography Features)
```tsx
<FastHtmlView
  html="<p>Invoice Total: $12,450.00 (Tabular figures & fractions: 1/2, 3/4)</p>"
  fontFeatureSettings='"tnum" 1, "frac" 1, "zero" 1' // Tabular Numbers, Fractions, Slashed Zero
  baseStyle={{ fontSize: 17, color: '#0f172a' }}
/>
```

#### 6. `onLinkPress` (Hyperlink Interception)
```tsx
import { Linking, Alert } from 'react-native';
import { FastHtmlView } from 'react-native-nitro-html';

<FastHtmlView
  html="<p>Visit <a href='https://example.com'>Website</a> or <a href='myapp://settings'>Settings</a></p>"
  onLinkPress={(url) => {
    if (url.startsWith('myapp://')) {
      Alert.alert('In-App Navigation', url);
    } else {
      Linking.openURL(url);
    }
  }}
/>
```

#### 7. `selectable` (Continuous Native Selection)
```tsx
<FastHtmlView
  html="<h1>Selectable Title</h1><p>Select multiple paragraphs in a single native swipe gesture.</p>"
  selectable={true} // Default is true; set to false for non-selectable cards
/>
```

---

## 🧱 All Supported HTML Content Blocks

### 1. Paragraphs (`<p>`)
```html
<p>This is a standard paragraph with natural sentence flow, automatic hyphenation, and native line breaks.</p>
```
```tsx
<FastHtmlView
  html="<p>Paragraph content rendered with 0 React Virtual DOM overhead.</p>"
  tagsStyles={{ p: { fontSize: 16, lineHeight: 24, color: '#334155' } }}
/>
```

### 2. Headings (`<h1>` to `<h6>`)
```html
<h1>Main Title (H1)</h1>
<h2>Section Header (H2)</h2>
<h3>Subsection (H3)</h3>
<h4>Topic (H4)</h4>
<h5>Subtopic (H5)</h5>
<h6>Micro Header (H6)</h6>
```
```tsx
<FastHtmlView
  html="<h1>H1 Header</h1><h2>H2 Header</h2>"
  tagsStyles={{
    h1: { fontSize: 28, color: '#0f172a', fontWeight: '800' },
    h2: { fontSize: 22, color: '#1e293b', fontWeight: '700' },
  }}
/>
```

### 3. Blockquotes & Quotes (`<blockquote>`, `<q>`)
```html
<blockquote>
  <p>Simplicity is the soul of efficiency.</p>
  <cite>— Austin Freeman</cite>
</blockquote>
```
```tsx
<FastHtmlView
  html="<blockquote>Knowledge is power.</blockquote>"
  tagsStyles={{
    blockquote: {
      borderLeftColor: '#6366f1',
      borderLeftWidth: 4,
      backgroundColor: '#f5f3ff',
      paddingLeft: 16,
      color: '#4338ca',
    },
  }}
/>
```

### 4. Code Blocks (`<pre><code>`)
```html
<pre><code class="language-typescript">const answer: number = 42;
console.log(`The answer is ${answer}`);</code></pre>
```
```tsx
<FastHtmlView
  html='<pre><code class="typescript">const x = 10;</code></pre>'
  tagsStyles={{
    pre: { backgroundColor: '#1e293b', paddingLeft: 12, marginBottom: 12 },
    code: { color: '#38bdf8', fontFamily: 'Courier', fontSize: 14 },
  }}
/>
```

### 5. Lists & Nested Lists (`<ul>`, `<ol>`, `<li>`)
```html
<ul>
  <li>Architecture Guarantee #1: Zero React Virtual DOM allocations</li>
  <li>Architecture Guarantee #2: Continuous cross-block text selection</li>
  <li>Nested ordered sub-list:
    <ol>
      <li>First step</li>
      <li>Second step</li>
    </ol>
  </li>
</ul>
```
```tsx
<FastHtmlView
  html="<ul><li>Bullet Item 1</li><li>Bullet Item 2</li></ul>"
  tagsStyles={{
    ul: { marginBottom: 12 },
    li: { color: '#334155', lineHeight: 22 },
  }}
/>
```

### 6. Data Tables (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`)
```html
<table border="1" cellpadding="6" cellspacing="0">
  <thead>
    <tr><th>Metric</th><th>Architecture Target</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>DOM Virtualization</td><td>0 React Virtual DOM Nodes</td><td>Optimal</td></tr>
    <tr><td>Native Text Rendering</td><td>120 FPS Buttery Scroll</td><td>Passed</td></tr>
  </tbody>
</table>
```
```tsx
<FastHtmlView
  html="<table><tr><th>Key</th><th>Value</th></tr><tr><td>Engine</td><td>Lexbor C++</td></tr></table>"
  tagsStyles={{
    table: { borderColor: '#cbd5e1', borderWidth: 1 },
    th: { backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold' },
    td: { color: '#475569' },
  }}
/>
```

### 7. Images & Figures (`<img>`, `<figure>`, `<figcaption>`)
```html
<figure>
  <img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800" alt="Gradient Artwork" />
  <figcaption>Figure 1: High-performance native image stream.</figcaption>
</figure>
```
```tsx
<FastHtmlView
  html='<img src="https://example.com/banner.png" alt="Banner" />'
  tagsStyles={{
    img: { borderRadius: 8, marginBottom: 12 },
    figcaption: { color: '#64748b', fontStyle: 'italic', fontSize: 13 },
  }}
/>
```

### 8. Thematic Break / Dividers (`<hr>`)
```html
<p>Top section content</p>
<hr />
<p>Bottom section content</p>
```
```tsx
<FastHtmlView
  html="<p>Before</p><hr /><p>After</p>"
  tagsStyles={{
    hr: { color: '#e2e8f0' },
  }}
/>
```

### 9. Definition Lists (`<dl>`, `<dt>`, `<dd>`)
```html
<dl>
  <dt>Lexbor</dt>
  <dd>Ultra-fast spec-compliant HTML5 parsing engine in pure C.</dd>
  <dt>TextKit 2</dt>
  <dd>Modern Apple native text storage and layout engine for iOS 16+.</dd>
</dl>
```
```tsx
<FastHtmlView
  html="<dl><dt>Title</dt><dd>Description details</dd></dl>"
  tagsStyles={{
    dt: { fontWeight: 'bold', color: '#0f172a' },
    dd: { color: '#475569', marginLeft: 16 },
  }}
/>
```

### 10. Inline Phrasing & Spans
Supported inline tags: `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<ins>`, `<s>`, `<del>`, `<code>`, `<mark>`, `<sub>`, `<sup>`, `<small>`, `<a>`, `<br>`.
```html
<p>
  <b>Bold</b>, <strong>Strong</strong>, <i>Italic</i>, <em>Emphasis</em>,
  <u>Underline</u>, <ins>Inserted</ins>, <s>Strikethrough</s>, <del>Deleted</del>,
  <code>Inline Code</code>, <mark>Highlighted Mark</mark>,
  <sub>Subscript (H<sub>2</sub>O)</sub>, <sup>Superscript (E=mc<sup>2</sup>)</sup>,
  <small>Small text</small>, and <a href="https://google.com">Hyperlink</a>.
</p>
```
```tsx
<FastHtmlView
  html="<p>Text with <mark>highlight</mark> and <code>inline code</code>.</p>"
  tagsStyles={{
    mark: { backgroundColor: '#fef08a', color: '#854d0e' },
    code: { backgroundColor: '#f1f5f9', color: '#0f172a' },
    a: { color: '#2563eb', textDecorationLine: 'underline' },
  }}
/>
```

---

## 🔌 Core Methods & Functions API

### 1. `parseHTML(html)`
Synchronously tokenizes raw HTML into a C++ backed `ParsedArticle` HybridObject with zero upfront JS memory allocation.
```typescript
import { parseHTML, type ParsedArticle } from 'react-native-nitro-html';

const article: ParsedArticle | null = parseHTML('<h1>Title</h1><p>Body</p>');
if (article) {
  console.log('Block count:', article.length);
}
```

### 2. `parseHTMLAsync(html)`
Asynchronously parses HTML on a background C++ thread, returning a Promise that resolves to `ParsedArticle | null`.
```typescript
import { parseHTMLAsync, type ParsedArticle } from 'react-native-nitro-html';

async function loadArticle(html: string) {
  const article: ParsedArticle | null = await parseHTMLAsync(html);
  if (article) {
    console.log('Parsed asynchronously on C++ worker pool:', article.length);
  }
}
```

### 3. `normalizeHTML(html)`
Cleans and normalizes malformed HTML markup using Lexbor's HTML5 specification parser.
```typescript
import { normalizeHTML } from 'react-native-nitro-html';

const cleaned: string = normalizeHTML('<div><p>Unclosed paragraph<b>bold');
console.log(cleaned); // "<div><p>Unclosed paragraph<b>bold</b></p></div>"
```

### 4. `calculateHTMLHeight(html, width, baseFontSize, baseLineHeight, fontScale)`
Calculates estimated native layout height for an HTML payload before rendering, ideal for virtualized list placeholders.
```typescript
import { calculateHTMLHeight } from 'react-native-nitro-html';

const estimatedHeight: number = calculateHTMLHeight(
  '<p>Some long text...</p>',
  360, // Container width (dp)
  16,  // Base font size
  24,  // Base line height
  1.0  // Font scale factor
);
console.log('Estimated native height:', estimatedHeight);
```

### 5. `parseHTMLToJSON(html)`
Parses HTML and directly serializes it to a compact JSON string in a single 1-pass native execution.
```typescript
import { parseHTMLToJSON, type ParsedArticleData } from 'react-native-nitro-html';

const jsonStr: string = parseHTMLToJSON('<h1>Title</h1><p>Body</p>');
const data: ParsedArticleData = JSON.parse(jsonStr);
console.log('Blocks:', data.blocks.length);
```

---

## 🗂️ Zero-Dependency AST Wrappers

Helper functions that extract children and nested structures from `ParsedArticle` into standard JavaScript arrays:

```typescript
import {
  parseHTML,
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
} from 'react-native-nitro-html';

const article = parseHTML(`
  <h1>Title</h1>
  <p>Paragraph with <b>bold</b> text.</p>
  <ul><li>Item 1</li><li>Item 2</li></ul>
  <table><tr><td>Cell 1</td></tr></table>
  <blockquote><p>Quote text</p></blockquote>
  <dl><dt>Term</dt><dd>Definition</dd></dl>
`);

// 1. Get all top-level blocks
const blocks = getBlocks(article);

// 2. Get inline children of a paragraph
const inlines = getChildren(blocks[1]);

// 3. Get list items & nested blocks
const listItems = getItems(blocks[2]);
const nested = getNestedBlocks(listItems[0]);

// 4. Get table rows & cells
const rows = getRows(blocks[3]);
const cells = getCells(rows[0]);

// 5. Get quote nested blocks
const quoteBlocks = getQuoteChildren(blocks[4]);

// 6. Get definition items, terms, and definitions
const defItems = getDefItems(blocks[5]);
const terms = getTerms(defItems[0]);
const defs = getDefs(defItems[0]);
```

---

## 🎮 Low-Level Native Fabric View (`<NativeHtmlView />`)

For direct integration with native view hierarchies, use `<NativeHtmlView />`:

```tsx
import React, { useRef } from 'react';
import { View, Button } from 'react-native';
import {
  NativeHtmlView,
  type NativeHtmlViewMethods,
} from 'react-native-nitro-html';

export function ImperativeExample() {
  const ref = useRef<NativeHtmlViewMethods>(null);

  const handleReadText = async () => {
    if (ref.current) {
      const text = await ref.current.getTextContent();
      console.log('Native text content:', text);
    }
  };

  return (
    <View>
      <NativeHtmlView
        ref={ref}
        html="<h1>Headline</h1><p>Sample paragraph.</p>"
        selectable={true}
        style={{ flex: 1 }}
      />
      <Button title="Get Plain Text" onPress={handleReadText} />
    </View>
  );
}
```

---

## 📄 License

MIT © [abhishekce17](https://github.com/abhishekce17)
