# react-native-fast-html-parser

[![npm](https://img.shields.io/npm/v/react-native-fast-html-parser?color=orange&label=npm)](https://www.npmjs.com/package/react-native-fast-html-parser)
[![license](https://img.shields.io/npm/l/react-native-fast-html-parser?color=green&label=license)](LICENSE)
[![platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey)](https://github.com/abhishekce17/react-native-fast-html-parser)
[![nitro](https://img.shields.io/badge/powered%20by-Nitro%20Modules-blue)](https://nitro.margelo.com)
[![cpp](https://img.shields.io/badge/core-C%2B%2B%20(Lexbor)-blue?logo=c%2B%2B)](https://github.com/lexbor/lexbor)

A high-performance HTML Content & Editorial Pipeline for React Native. Powered by the ultra-fast, spec-compliant C++ Lexbor engine integrated via direct C++ JSI using Margelo Nitro Modules.

**Zero binary prebuilts, zero postinstall scripts, zero extra toolchains required.** Compiles directly alongside your application via standard CMake and CocoaPods.

It provides dual execution modes: **Lazy native-backed AST access** that avoids materializing the complete AST in JavaScript for instant UI rendering, and a **1-Pass Native JSON pipeline** (`parseHTMLToJSON`) for offline persistence, background workers, and global state management.

---

## 📑 Table of Contents

- [Features](#-features)
- [Empirical Benchmarks](#-empirical-benchmarks)
- [Installation & Setup](#-installation--setup)
- [Architecture Overview](#-architecture-overview)
- [Core API Reference](#-core-api-reference)
  - [`parseHTML(html)`](#1-parsehtmlhtml)
  - [`parseHTMLToJSON(html)`](#2-parsehtmltojsonhtml)
- [React Native UI Components](#-react-native-ui-components)
  - [`<FastHtmlView />`](#fasthtmlview-)
    - [Basic Rendering & Styling](#basic-rendering--styling)
    - [`parsedAst` (Parse Once, Render Many)](#parsedast--parse-once-render-many)
    - [Custom Renderer Injection (`renderers`)](#custom-renderer-injection-renderers)
    - [Continuous Text Selection (`selectable`)](#continuous-text-selection-selectable)
    - [Hyperlink Interception (`onLinkPress`)](#hyperlink-interception-onlinkpress)
  - [`<NativeHtmlView />` (Low-Level Fabric Component)](#nativehtmlview-low-level-fabric-component)
    - [Imperative Methods (`getTextContent()`)](#imperative-methods-gettextcontent)
- [AST Traversal & Wrapper Utilities](#-ast-traversal--wrapper-utilities)
  - [`getBlocks(article)`](#1-getblocksarticle)
  - [`getChildren(node)`](#2-getchildrennode)
  - [`getItems(block)`](#3-getitemsblock)
  - [`getNestedBlocks(item)`](#4-getnestedblocksitem)
  - [`getRows(block)`](#5-getrowsblock)
  - [`getCells(row)`](#6-getcellsrow)
  - [`getQuoteChildren(block)`](#7-getquotechildrenblock)
  - [`getDefItems(block)`](#8-getdefitemsblock)
- [Application Canonical Adapters](#-application-canonical-adapters)
  - [`createCanonicalAdapter(config)`](#createcanonicaladapterconfig)
  - [`adapter.adapt(parsedJson)`](#adapteradaptparsedjson)
  - [`BlockTransformer<TOutput>`](#blocktransformertoutput)
- [Low-Level JSI HybridObject API](#-low-level-jsi-hybridobject-api)
  - [`ParsedArticle`](#parsedarticle)
    - [`.length`](#parsedarticlelength)
    - [`.getBlock(index)`](#parsedarticlegetblockindex)
    - [`.toJSON()`](#parsedarticletojson)
  - [`ContentBlock`](#contentblock)
    - [All Properties](#contentblock-properties)
    - [`.getChild(index)`](#contentblockgetchildindex)
    - [`.getQuoteChild(index)`](#contentblockgetquotechildindex)
    - [`.getItem(index)`](#contentblockgetitemindex)
    - [`.getRow(index)`](#contentblockgetrowindex)
    - [`.getDefItem(index)`](#contentblockgetdefitemindex)
  - [`InlineNode`](#inlinenode)
    - [Properties & `.getChild(index)`](#inlinenode-properties--getchildindex)
  - [`ListItem`](#listitem)
    - [`.getChild(index)` & `.getNested(index)`](#listitem-getchildindex--getnestedindex)
  - [`TableRow` & `TableCell`](#tablerow--tablecell)
    - [`TableRow.getCell(index)`](#tablerowgetcellindex)
    - [`TableCell.getChild(index)`](#tablecellgetchildindex)
  - [`DefinitionItem`](#definitionitem)
    - [`.getTerm(index)` & `.getDef(index)`](#definitionitem-gettermindex--getdefindex)
  - [`FastHtmlParser` (Nitro HybridObject Singleton)](#fasthtmlparser-nitro-hybridobject-singleton)
    - [`.parse(html)` & `.parseToJSON(html)`](#fasthtmlparserparsehtml--parsetojsonhtml)
- [Block Type Reference & Properties](#-block-type-reference--properties)
- [JSON AST Data Models](#-json-ast-data-models)
- [Advanced Production Recipes](#-advanced-production-recipes)
  - [Recipe 1: Drop-in `@shopify/flash-list` Virtualization](#recipe-1-drop-in-shopifyflash-list-virtualization)
  - [Recipe 2: Offline Caching with MMKV / SQLite](#recipe-2-offline-caching-with-mmkv--sqlite)
  - [Recipe 3: Custom Video Player Integration](#recipe-3-custom-video-player-integration)
  - [Recipe 4: Custom Syntax Highlighting](#recipe-4-custom-syntax-highlighting)
  - [Recipe 5: Interactive Custom Callout / Poll Widget](#recipe-5-interactive-custom-callout--poll-widget)
- [Full TypeScript Type Reference](#-full-typescript-type-reference)
- [HTML Compatibility Matrix](#-html-compatibility-matrix)
- [License](#-license)

---

## 🚀 Features

- **Blazing Fast Native Core**: Sub-millisecond HTML parsing written in C++ (Lexbor v2.3.0) and compiled directly into native machine code.
- **100% Native Fabric RichText Engine (`<FastHtmlView />`)**: Backed by Apple TextKit 2 on iOS and Precomputed Spannables on Android with **0 React Virtual DOM allocations** for maximum 120 FPS performance.
- **Continuous Multi-Paragraph Text Selection**: Select and copy text seamlessly across multiple headings, paragraphs, blockquotes, and lists in a single continuous native gesture.
- **Bug-Free Custom Renderer Injector**: Inject custom React components (`renderers={{ video: CustomVideo, code: CustomCode }}`) seamlessly into the native stream with full React state, hooks, and context lifecycle.
- **1-Pass Native JSON Pipeline**: Direct `parseHTMLToJSON()` native serialization for SQLite, MMKV, WatermelonDB, and Redux caching.
- **Application Canonical Adapters**: Decouple parser AST from domain schemas (e.g. RSS feed, CMS models) with `createCanonicalAdapter()`.
- **Zero-Dependency AST Wrappers**: 8 convenient helper functions to traverse blocks, inlines, lists, tables, quotes, and definition lists as standard JS arrays.
- **Strict Tag Normalization Contract**: Validated against 60+ HTML tags. See [HTML_COMPATIBILITY_MATRIX.md](./HTML_COMPATIBILITY_MATRIX.md).

---

## ⚡ Empirical Benchmarks

Measured on native C++ (Lexbor) engine across standard payload tiers:

| Payload Tier | Exact Size  | AST Blocks    | Parse Time     | 1-Pass JSON Time | Total Time     | Sustained Throughput |
| :----------- | :---------- | :------------ | :------------- | :--------------- | :------------- | :------------------- |
| **1 KB**     | 1.65 KB     | 8 blocks      | **0.007 ms**   | 0.002 ms         | **0.010 ms**   | 163.53 MB/s          |
| **10 KB**    | 11.55 KB    | 56 blocks     | **0.042 ms**   | 0.015 ms         | **0.056 ms**   | 200.27 MB/s          |
| **100 KB**   | 100.67 KB   | 488 blocks    | **0.353 ms**   | 0.128 ms         | **0.481 ms**   | 204.48 MB/s          |
| **500 KB**   | 500.07 KB   | 2,424 blocks  | **1.746 ms**   | 0.612 ms         | **2.357 ms**   | 207.15 MB/s          |
| **1 MB**     | 1,024.89 KB | 4,968 blocks  | **3.618 ms**   | 1.243 ms         | **4.861 ms**   | 205.91 MB/s          |
| **5 MB**     | 5,121.16 KB | 24,824 blocks | **20.401 ms**  | 6.500 ms         | **26.901 ms**  | 185.91 MB/s          |

---

## 📦 Installation & Setup

```bash
# Using npm
npm install react-native-fast-html-parser react-native-nitro-modules

# Using yarn
yarn add react-native-fast-html-parser react-native-nitro-modules
```

### iOS Setup

```bash
cd ios && pod install
```

### Android Setup

No additional configuration required. Android builds automatically link native C++ artifacts via CMake and Nitro Modules.

### Rebuild Application

```bash
npx react-native run-ios
# or
npx react-native run-android
```

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

## 🔌 Core API Reference

### 1. `parseHTML(html)`

Parses raw HTML into a lazy native JSI `ParsedArticle` HybridObject. Elements are traversed on-demand via direct C++ pointers with zero upfront JavaScript heap allocations.

#### Type Signature

```typescript
function parseHTML(html: string): ParsedArticle | null;
```

#### Example

```typescript
import { parseHTML, type ParsedArticle } from 'react-native-fast-html-parser';

const html = `
  <article>
    <h1>Supercharged React Native</h1>
    <p>Render <b>bold</b> text with sub-millisecond parsing speed.</p>
  </article>
`;

const article: ParsedArticle | null = parseHTML(html);

if (article) {
  console.log('Total Block Count:', article.length); // 2
  const firstBlock = article.getBlock(0);
  console.log('First Block Type:', firstBlock?.type); // "Heading"
  console.log('Heading Level:', firstBlock?.level); // 1
}
```

---

### 2. `parseHTMLToJSON(html)`

Parses raw HTML and directly serializes it to a compact JSON string in a single native pass inside C++. The native memory is immediately released. Ideal for background workers, offline persistence, and Redux/Zustand state slices.

#### Type Signature

```typescript
function parseHTMLToJSON(html: string): string;
```

#### Example

```typescript
import {
  parseHTMLToJSON,
  type ParsedArticleData,
} from 'react-native-fast-html-parser';

const html = `<h2>Fast Pipeline</h2><p>Saved directly to storage.</p>`;

// 1. Get raw JSON string from native C++ pipeline
const jsonString: string = parseHTMLToJSON(html);

// 2. Parse into typed JS object tree if needed
const data: ParsedArticleData = JSON.parse(jsonString);

console.log('Blocks count:', data.blocks.length); // 2
console.log('First Block Type:', data.blocks[0].type); // "heading"
console.log('First Block Level:', (data.blocks[0] as any).level); // 2
```

---

## 🎨 React Native UI Components

### `<FastHtmlView />`

The primary, high-performance Fabric component to render HTML directly into native platform text engines (**Apple TextKit 2 on iOS** and **Precomputed Spannables on Android**).

Because it operates natively, it creates **0 React Virtual DOM nodes** for text, headings, and lists, sustaining smooth **120 FPS scrolling** and **continuous text selection** across multiple paragraphs.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `html` | `string` | `undefined` | The raw HTML string to parse and render. |
| `mode` | `'sync' \| 'async'` | `'sync'` | Parse execution mode (`'sync'` on main thread or `'async'` offloaded to C++ worker thread). |
| `parsedAst` | `ParsedArticle \| null` | `undefined` | Pre-parsed AST object (used if parsed ahead of time). |
| `baseStyle` | `TextStyle & { fontFeatureSettings?: string }` | `undefined` | Base typography style inherited by all text elements. |
| `tagsStyles` | `Record<string, TextStyle \| ViewStyle>` | `{}` | Style overrides keyed by tag name (`h1`, `p`, `a`, `code`, `blockquote`, etc.). |
| `renderers` | `Record<string, CustomBlockRenderer>` | `{}` | Custom React component overrides for block types (Video, Polls, Code, etc.). |
| `selectable` | `boolean` | `true` | Enables continuous multi-paragraph text selection & copy-paste. |
| `fontFeatureSettings`| `string` | `undefined` | OpenType font feature settings (e.g. `'"tnum" 1'`, `'"liga" 1'`). |
| `onLinkPress` | `(url: string) => void` | `undefined` | Callback triggered when an `<a>` anchor link is pressed. |
| `style` | `ViewStyle` | `undefined` | Container style for the root `<View>`. |

---

#### Basic Rendering & Styling

```tsx
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { FastHtmlView } from 'react-native-fast-html-parser';

export function SimpleArticleScreen() {
  const html = `
    <h1>Getting Started</h1>
    <p>This is a paragraph with <b>bold</b>, <i>italic</i>, and <code>inline code</code>.</p>
    <blockquote>Knowledge is power.</blockquote>
  `;

  return (
    <ScrollView style={styles.container}>
      <FastHtmlView
        html={html}
        baseStyle={{
          fontSize: 16,
          color: '#1e293b',
          lineHeight: 26,
        }}
        tagsStyles={{
          h1: { fontSize: 28, color: '#0f172a', fontWeight: '800', marginBottom: 12 },
          blockquote: { backgroundColor: 'rgba(99, 102, 241, 0.08)', color: '#4338ca' },
          code: { color: '#09b43a', backgroundColor: '#f1f5f9' },
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
});
```

---

#### `parsedAst` — Parse Once, Render Many

Parse the AST exactly once (e.g. in a screen-level `useMemo` or state store) and pass the pre-parsed `ParsedArticle` object to avoid redundant parsing across re-renders:

```tsx
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  parseHTML,
  FastHtmlView,
  type ParsedArticle,
} from 'react-native-fast-html-parser';

export function OptimizedArticleScreen({ rawHtml }: { rawHtml: string }) {
  // Parse AST once
  const parsedAst: ParsedArticle | null = useMemo(() => parseHTML(rawHtml), [rawHtml]);

  return (
    <ScrollView style={styles.container}>
      <FastHtmlView
        parsedAst={parsedAst}
        baseStyle={{ fontSize: 16, color: '#334155' }}
        selectable={true}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
});
```

---

#### Custom Renderer Injection (`renderers`)

Inject custom React components directly into the native text stream for complex interactive blocks (Video, Code with syntax highlighting, Polls, Ads, Canvas) while preserving standard React component state, hooks, and context:

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  FastHtmlView,
  type CustomBlockRenderer,
} from 'react-native-fast-html-parser';

// Custom Interactive Poll block
const CustomPollRenderer: CustomBlockRenderer = ({ block }) => {
  const [voted, setVoted] = useState(false);

  return (
    <View style={styles.pollContainer}>
      <Text style={styles.pollTitle}>📊 Interactive Poll</Text>
      <Text style={styles.pollCaption}>{block.caption || 'Do you like Native RichText?'}</Text>
      <TouchableOpacity
        style={[styles.pollButton, voted && styles.pollButtonVoted]}
        onPress={() => setVoted(!voted)}
      >
        <Text style={styles.pollButtonText}>{voted ? '✓ Voted (100% Yes)' : 'Vote Yes'}</Text>
      </TouchableOpacity>
    </View>
  );
};

// Custom Code block with copy action
const CustomCodeRenderer: CustomBlockRenderer = ({ block }) => {
  return (
    <View style={styles.codeContainer}>
      <Text style={styles.codeLang}>{block.language || 'code'}</Text>
      <Text style={styles.codeText}>{block.code}</Text>
    </View>
  );
};

export function InteractiveArticleScreen() {
  const html = `
    <h1>Interactive Content Pipeline</h1>
    <p>Native text renders below with zero virtual DOM overhead.</p>
    <figure><figcaption>Do you like Native RichText?</figcaption></figure>
    <pre><code class="language-rust">fn main() { println!("Hello!"); }</code></pre>
    <p>And continuous text continues below seamlessly.</p>
  `;

  return (
    <FastHtmlView
      html={html}
      renderers={{
        Figure: CustomPollRenderer,
        CodeBlock: CustomCodeRenderer,
      }}
    />
  );
}

const styles = StyleSheet.create({
  pollContainer: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 8, marginVertical: 12 },
  pollTitle: { fontSize: 14, fontWeight: '700', color: '#166534' },
  pollCaption: { fontSize: 16, color: '#15803d', marginVertical: 8 },
  pollButton: { backgroundColor: '#22c55e', padding: 10, borderRadius: 6, alignItems: 'center' },
  pollButtonVoted: { backgroundColor: '#15803d' },
  pollButtonText: { color: '#ffffff', fontWeight: 'bold' },
  codeContainer: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginVertical: 8 },
  codeLang: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  codeText: { color: '#f8fafc', fontFamily: 'Courier', marginTop: 4 },
});
```

---

#### Continuous Text Selection (`selectable`)

Allows users to highlight, select, and copy text across headings, paragraphs, lists, and blockquotes with standard native platform selection handles.

```tsx
<FastHtmlView
  html="<h1>Title</h1><p>Select me and the title in one gesture!</p>"
  selectable={true} // Default: true
/>
```

---

#### Hyperlink Interception (`onLinkPress`)

Intercept link clicks to handle in-app navigation, web views, or custom deep links:

```tsx
import React from 'react';
import { Linking, Alert } from 'react-native';
import { FastHtmlView } from 'react-native-fast-html-parser';

export function LinkHandlingExample() {
  const html = `<p>Check the <a href="https://nitro.margelo.com">Nitro Docs</a> or open <a href="myapp://profile/123">Profile</a>.</p>`;

  const handleLinkPress = (url: string) => {
    if (url.startsWith('myapp://')) {
      Alert.alert('In-App Deep Link', url);
    } else {
      Linking.openURL(url).catch((err) => console.error('Failed to open URL:', err));
    }
  };

  return (
    <FastHtmlView
      html={html}
      tagsStyles={{ a: { color: '#2563eb', textDecorationLine: 'underline' } }}
      onLinkPress={handleLinkPress}
    />
  );
}
```

---

### `<NativeHtmlView />` (Low-Level Fabric Component)

The underlying raw Nitro HybridView component. Renders raw HTML strings directly into TextKit 2 / Spannables without segment splitting.

```tsx
import React, { useRef } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import {
  NativeHtmlView,
  type NativeHtmlViewMethods,
} from 'react-native-fast-html-parser';

export function DirectNativeViewExample() {
  const nativeRef = useRef<NativeHtmlViewMethods>(null);

  const handleInspect = () => {
    // Imperative method on NativeHtmlView instance
    const text = nativeRef.current?.getTextContent();
    console.log('Raw text content rendered in native view:', text);
  };

  return (
    <View style={styles.container}>
      <NativeHtmlView
        ref={nativeRef}
        html="<h2>Direct Native View</h2><p>Zero React VDOM nodes.</p>"
        baseStyle={{ fontSize: 16, color: '#0f172a' }}
        tagsStyles={{ h2: { fontSize: 22, color: '#1e40af' } }}
        selectable={true}
        onLinkPress={(url) => console.log('Clicked:', url)}
        style={styles.view}
      />
      <Button title="Get Rendered Text" onPress={handleInspect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  view: { flex: 1 },
});
```

#### Imperative Methods (`getTextContent()`)

- `getTextContent(): string` — Returns the plain rendered text content currently displayed inside the native `UITextView` (iOS) or `TextView` (Android).

---

## 🛠 AST Traversal & Wrapper Utilities

The library exports 8 ergonomic traversal helper functions that convert low-level JSI HostObject getters into standard JavaScript arrays:

### 1. `getBlocks(article)`

Extracts all top-level `ContentBlock[]` elements from a `ParsedArticle`.

```typescript
import {
  parseHTML,
  getBlocks,
  type ContentBlock,
} from 'react-native-fast-html-parser';

const article = parseHTML(
  '<h1>Title</h1><p>First paragraph.</p><p>Second paragraph.</p>'
);
const blocks: ContentBlock[] = getBlocks(article);

console.log(`Extracted ${blocks.length} blocks`); // 3
blocks.forEach((block, index) => {
  console.log(`Block #${index}: ${block.type}`); // "Heading", "Paragraph", "Paragraph"
});
```

---

### 2. `getChildren(node)`

Extracts all inline child nodes (`InlineNode[]`) from a `ContentBlock`, `InlineNode`, `TableCell`, or `ListItem`.

```typescript
import {
  parseHTML,
  getBlocks,
  getChildren,
  type InlineNode,
} from 'react-native-fast-html-parser';

const article = parseHTML(
  '<p>Welcome to <b>React Native</b> with <a href="https://nitro.margelo.com">Nitro Modules</a>.</p>'
);
const paragraph = getBlocks(article)[0];

const inlines: InlineNode[] = getChildren(paragraph);
inlines.forEach((inline) => {
  console.log(`Type: ${inline.type}, Text: "${inline.text}", URL: "${inline.url}"`);
  // Type: Text, Text: "Welcome to ", URL: ""
  // Type: Bold, Text: "React Native", URL: ""
  // Type: Text, Text: " with ", URL: ""
  // Type: Link, Text: "Nitro Modules", URL: "https://nitro.margelo.com"
});
```

---

### 3. `getItems(block)`

Extracts all `ListItem[]` entries from an ordered (`<ol>`) or unordered (`<ul>`) `List` block.

```typescript
import {
  parseHTML,
  getBlocks,
  getItems,
  getChildren,
  type ListItem,
} from 'react-native-fast-html-parser';

const article = parseHTML(`
  <ul>
    <li>First item</li>
    <li>Second item with <b>bold</b> text</li>
  </ul>
`);
const listBlock = getBlocks(article)[0];

if (listBlock.type === 'List') {
  const items: ListItem[] = getItems(listBlock);
  console.log(`List has ${items.length} items`); // 2
  items.forEach((item, index) => {
    const textNodes = getChildren(item);
    console.log(`Item ${index + 1}:`, textNodes.map((n) => n.text).join(''));
  });
}
```

---

### 4. `getNestedBlocks(item)`

Extracts nested sub-blocks (`ContentBlock[]`) contained inside a `ListItem` (for multi-level hierarchical lists).

```typescript
import {
  parseHTML,
  getBlocks,
  getItems,
  getNestedBlocks,
  type ContentBlock,
} from 'react-native-fast-html-parser';

const article = parseHTML(`
  <ul>
    <li>
      Parent item
      <ul>
        <li>Sub item 1</li>
        <li>Sub item 2</li>
      </ul>
    </li>
  </ul>
`);
const listBlock = getBlocks(article)[0];
const parentItem = getItems(listBlock)[0];

const nestedBlocks: ContentBlock[] = getNestedBlocks(parentItem);
console.log('Nested sub-lists count:', nestedBlocks.length); // 1
console.log('Nested block type:', nestedBlocks[0].type); // "List"
```

---

### 5. `getRows(block)`

Extracts all `TableRow[]` entries from a `Table` block.

```typescript
import {
  parseHTML,
  getBlocks,
  getRows,
  type TableRow,
} from 'react-native-fast-html-parser';

const article = parseHTML(`
  <table>
    <tr><th>Framework</th><th>Language</th></tr>
    <tr><td>React Native</td><td>TypeScript</td></tr>
    <tr><td>Nitro Modules</td><td>C++</td></tr>
  </table>
`);
const tableBlock = getBlocks(article)[0];

const rows: TableRow[] = getRows(tableBlock);
console.log(`Table has ${rows.length} rows`); // 3
```

---

### 6. `getCells(row)`

Extracts all `TableCell[]` entries from a `TableRow`.

```typescript
import {
  parseHTML,
  getBlocks,
  getRows,
  getCells,
  getChildren,
  type TableCell,
} from 'react-native-fast-html-parser';

const article = parseHTML(
  '<table><tr><td>Col 1</td><td>Col 2</td><td>Col 3</td></tr></table>'
);
const tableBlock = getBlocks(article)[0];
const firstRow = getRows(tableBlock)[0];

const cells: TableCell[] = getCells(firstRow);
console.log(`Row has ${cells.length} cells`); // 3
cells.forEach((cell, index) => {
  const cellInlines = getChildren(cell);
  console.log(`Cell ${index}:`, cellInlines.map((c) => c.text).join(''));
});
```

---

### 7. `getQuoteChildren(block)`

Extracts nested `ContentBlock[]` elements from a `Quote` (`<blockquote>`) block.

```typescript
import {
  parseHTML,
  getBlocks,
  getQuoteChildren,
  getChildren,
  type ContentBlock,
} from 'react-native-fast-html-parser';

const article = parseHTML(`
  <blockquote>
    <p>Simplicity is prerequisite for reliability.</p>
    <p>— Edsger W. Dijkstra</p>
  </blockquote>
`);
const quoteBlock = getBlocks(article)[0];

const subBlocks: ContentBlock[] = getQuoteChildren(quoteBlock);
console.log(`Quote contains ${subBlocks.length} inner blocks`); // 2
subBlocks.forEach((child) => {
  if (child.type === 'Paragraph') {
    console.log('Quote line:', getChildren(child).map((c) => c.text).join(''));
  }
});
```

---

### 8. `getDefItems(block)`

Extracts all `DefinitionItem[]` entries from a `DefinitionList` (`<dl>`) block.

```typescript
import {
  parseHTML,
  getBlocks,
  getDefItems,
  type DefinitionItem,
} from 'react-native-fast-html-parser';

const article = parseHTML(`
  <dl>
    <dt>JSI</dt>
    <dd>JavaScript Interface for direct C++ to JavaScript communication.</dd>
    <dt>Nitro Modules</dt>
    <dd>Next-generation React Native native module framework.</dd>
  </dl>
`);
const dlBlock = getBlocks(article)[0];

const defItems: DefinitionItem[] = getDefItems(dlBlock);
console.log(`Definition list has ${defItems.length} pairs`); // 2
defItems.forEach((item) => {
  const term = item.getTerm(0)?.text;
  const def = item.getDef(0)?.text;
  console.log(`${term} => ${def}`);
});
```

---

## 🔀 Application Canonical Adapters

### `createCanonicalAdapter(config)`

Decouple parser AST internals from your proprietary application schema (such as NewsFeed, Blog, or CMS models) using `createCanonicalAdapter()`.

#### Configuration Schema (`CanonicalAdapterConfig`)

| Property | Type | Description |
| :--- | :--- | :--- |
| `transformers` | `Record<string, (block: any, index: number) => TDomainBlock>` | Specialized transformers keyed by block type (`heading`, `paragraph`, `image`, `code`, `list`, `table`, `quote`, etc.). |
| `transformBlock` | `(block: ContentBlockData, index: number) => TDomainBlock` | Fallback transformer for any block type without a specialized transformer. |
| `transformArticle` | `(article: ParsedArticleData, blocks: TDomainBlock[]) => TDomainArticle` | Transforms the array of domain blocks into your application's root article document. |

---

### `adapter.adapt(parsedJson)`

Takes the parsed JSON data object and returns your typed domain document:

```typescript
import {
  createCanonicalAdapter,
  parseHTMLToJSON,
  type ParsedArticleData,
  type ContentBlockData,
} from 'react-native-fast-html-parser';

// 1. Define your domain models
interface FeedItem {
  id: string;
  type: 'title' | 'body' | 'image' | 'generic';
  text?: string;
  sourceUrl?: string;
}

interface FeedArticle {
  articleId: string;
  title: string;
  items: FeedItem[];
  itemCount: number;
}

// 2. Create the canonical adapter
const newsFeedAdapter = createCanonicalAdapter<FeedArticle, FeedItem>({
  transformers: {
    heading: (block, index) => ({
      id: `h-${index}`,
      type: 'title',
      text: block.children?.map((c) => c.text).join(''),
    }),
    paragraph: (block, index) => ({
      id: `p-${index}`,
      type: 'body',
      text: block.children?.map((c) => c.text).join(''),
    }),
    image: (block, index) => ({
      id: `img-${index}`,
      type: 'image',
      sourceUrl: block.url,
    }),
  },
  transformBlock: (block, index) => ({
    id: `misc-${index}`,
    type: 'generic',
  }),
  transformArticle: (article, items) => ({
    articleId: `feed-${Date.now()}`,
    title: article.title || 'Untitled',
    items: items,
    itemCount: items.length,
  }),
});

// 3. Adapt parsed JSON AST
const jsonString = parseHTMLToJSON('<h1>News Headline</h1><p>Breaking story.</p>');
const parsedData: ParsedArticleData = JSON.parse(jsonString);

const canonicalResult: FeedArticle = newsFeedAdapter.adapt(parsedData);
console.log('Resulting Domain Article:', canonicalResult);
```

---

### `BlockTransformer<TOutput>`

Type helper to strongly type individual block transformer functions:

```typescript
import {
  type BlockTransformer,
  type HeadingBlockData,
  type ParagraphBlockData,
} from 'react-native-fast-html-parser';

const headingTransform: BlockTransformer<{ headingText: string; level: number }> = (
  block,
  index
) => {
  const heading = block as HeadingBlockData;
  return {
    headingText: heading.children?.map((c) => c.text).join('') ?? '',
    level: heading.level,
  };
};
```

---

## ⚙️ Low-Level JSI HybridObject API

When using `parseHTML()`, you interact directly with high-performance C++ JSI `HybridObject` instances:

### `ParsedArticle`

Represents the root parsed document backed by native C++ memory.

| Property / Method | Return Type | Description |
| :--- | :--- | :--- |
| `length` | `number` | Total number of top-level content blocks. |
| `getBlock(index: number)` | `ContentBlock \| null` | Returns the `ContentBlock` at index without copying. |
| `toJSON()` | `string` | Serializes the article into a JSON string natively. |

#### Example: Inspecting and Serializing `ParsedArticle`

```typescript
import { parseHTML, type ParsedArticle } from 'react-native-fast-html-parser';

const article: ParsedArticle | null = parseHTML('<h1>Title</h1><p>Body</p>');

if (article) {
  // 1. Read .length
  const totalBlocks = article.length; // 2

  // 2. Call .getBlock(index)
  for (let i = 0; i < totalBlocks; i++) {
    const block = article.getBlock(i);
    console.log(`Block #${i} type:`, block?.type);
  }

  // 3. Call .toJSON() to serialize directly from native memory
  const jsonStr = article.toJSON();
  console.log('Serialized JSON:', jsonStr);
}
```

#### `article.toJSON()` vs `parseHTMLToJSON()` — when to use each

| | `article.toJSON()` | `parseHTMLToJSON(html)` |
| :--- | :--- | :--- |
| **When** | You already have a `ParsedArticle` (e.g. used for rendering first, then want to cache) | You only need JSON — no live rendering |
| **Native memory** | Freed when `article` is GC'd | Freed immediately after the call |
| **JSI overhead** | 1 extra JSI call on an existing HybridObject | 0 — native→JSON in a single C++ pass |
| **Best for** | Cache-after-render, debug `console.log` | Background workers, MMKV/SQLite pipelines |

---

### `ContentBlock`

Represents an individual structural content block in the AST.

#### ContentBlock Properties

| Field | Return Type | Applicable Block Types | Description |
| :--- | :--- | :--- | :--- |
| `type` | `string` | All | Block type name (`Paragraph`, `Heading`, `List`, `Table`, `Image`, `Figure`, `CodeBlock`, `Quote`, `DefinitionList`, `Video`, `Audio`, `Embed`, `Separator`). |
| `level` | `number` | `Heading` | Heading level (1 to 6). |
| `url` | `string` | `Image`, `Figure` | Image asset URL. |
| `alt` | `string` | `Image`, `Figure` | Accessibility alternative text. |
| `caption` | `string` | `Figure`, `Video`, `Audio`, `Embed` | Caption or subtitle text. |
| `linkUrl` | `string` | `Image`, `Figure` | Destination hyperlink URL if the image is wrapped inside an `<a>` tag. |
| `code` | `string` | `CodeBlock` | Raw source code text. |
| `language` | `string` | `CodeBlock` | Syntax language (e.g. `typescript`, `rust`, `python`). |
| `src` | `string` | `Video`, `Audio`, `Embed` | Media source URL or embed iframe target. |
| `poster` | `string` | `Video` | Video preview thumbnail poster URL. |
| `title` | `string` | `Embed` | Title attribute of embed/iframe. |
| `ordered` | `boolean` | `List` | `true` for `<ol>`, `false` for `<ul>`. |
| `childCount` | `number` | `Paragraph`, `Heading` | Number of inline child nodes. |
| `quoteChildCount` | `number` | `Quote` | Number of child blocks inside a blockquote. |
| `itemCount` | `number` | `List`, `DefinitionList` | Number of list items or definition items. |
| `rowCount` | `number` | `Table` | Number of rows in table. |
| `defItemCount` | `number` | `DefinitionList` | Number of term/definition pairs. |

#### ContentBlock Methods

##### `ContentBlock.getChild(index)`
Returns the inline child node (`InlineNode | null`) for `Paragraph` or `Heading` blocks.

```typescript
const headingBlock = article.getBlock(0);
for (let i = 0; i < headingBlock.childCount; i++) {
  const inline = headingBlock.getChild(i);
  console.log('Heading inline text:', inline?.text);
}
```

##### `ContentBlock.getQuoteChild(index)`
Returns the nested `ContentBlock | null` inside a `Quote` block.

```typescript
const quoteBlock = article.getBlock(1);
for (let i = 0; i < quoteBlock.quoteChildCount; i++) {
  const childBlock = quoteBlock.getQuoteChild(i);
  console.log('Quote inner block type:', childBlock?.type);
}
```

##### `ContentBlock.getItem(index)`
Returns the `ListItem | null` inside a `List` block.

```typescript
const listBlock = article.getBlock(2);
for (let i = 0; i < listBlock.itemCount; i++) {
  const item = listBlock.getItem(i);
  console.log('Item child count:', item?.childCount);
}
```

##### `ContentBlock.getRow(index)`
Returns the `TableRow | null` inside a `Table` block.

```typescript
const tableBlock = article.getBlock(3);
for (let i = 0; i < tableBlock.rowCount; i++) {
  const row = tableBlock.getRow(i);
  console.log('Row cell count:', row?.cellCount);
}
```

##### `ContentBlock.getDefItem(index)`
Returns the `DefinitionItem | null` inside a `DefinitionList` block.

```typescript
const dlBlock = article.getBlock(4);
for (let i = 0; i < dlBlock.defItemCount; i++) {
  const defItem = dlBlock.getDefItem(i);
  console.log('Term count:', defItem?.termCount);
}
```

---

### `InlineNode`

Represents an inline formatted text node (plain text, bold, italic, anchor links, inline code).

#### `InlineNode` Properties & `.getChild(index)`

| Field / Method | Return Type | Description |
| :--- | :--- | :--- |
| `type` | `string` | Node type: `'Text'`, `'Bold'`, `'Italic'`, `'Link'`, `'InlineCode'`, `'Break'`. |
| `text` | `string` | Text content of the node. |
| `url` | `string` | Destination URL (for `Link` nodes). |
| `childCount` | `number` | Number of nested inline formatting nodes. |
| `getChild(i)` | `InlineNode \| null` | Returns the nested inline node at index `i`. |

```typescript
import { parseHTML, getBlocks } from 'react-native-fast-html-parser';

const article = parseHTML('<p>Visit <a href="https://example.com"><b>Our Site</b></a>!</p>');
const para = getBlocks(article)[0];

for (let i = 0; i < para.childCount; i++) {
  const node = para.getChild(i);
  if (!node) continue;

  console.log(`Node [${node.type}]: "${node.text}" (URL: ${node.url})`);

  // Drill down into nested inline children (e.g. <b> inside <a>)
  for (let j = 0; j < node.childCount; j++) {
    const subNode = node.getChild(j);
    console.log(`  -> SubNode [${subNode?.type}]: "${subNode?.text}"`);
  }
}
```

---

### `ListItem`

Represents an item (`<li>`) within an ordered or unordered list.

#### `ListItem` `.getChild(index)` & `.getNested(index)`

| Field / Method | Return Type | Description |
| :--- | :--- | :--- |
| `childCount` | `number` | Number of inline child formatting nodes in this item. |
| `getChild(i)` | `InlineNode \| null` | Returns the inline child node at index `i`. |
| `nestedCount` | `number` | Number of nested sub-lists or sub-blocks inside this item. |
| `getNested(i)` | `ContentBlock \| null` | Returns the nested `ContentBlock` at index `i`. |

```typescript
import { parseHTML, getBlocks } from 'react-native-fast-html-parser';

const article = parseHTML(`
  <ul>
    <li>Item 1</li>
    <li>Item 2
      <ul><li>Sub-item 2.1</li></ul>
    </li>
  </ul>
`);
const list = getBlocks(article)[0];

for (let i = 0; i < list.itemCount; i++) {
  const item = list.getItem(i);
  if (!item) continue;

  // 1. Inspect text inline nodes
  for (let c = 0; c < item.childCount; c++) {
    const inline = item.getChild(c);
    console.log(`Item #${i} Text:`, inline?.text);
  }

  // 2. Inspect nested sub-blocks
  for (let n = 0; n < item.nestedCount; n++) {
    const subList = item.getNested(n);
    console.log(`Item #${i} Nested Block Type:`, subList?.type); // "List"
  }
}
```

---

### `TableRow` & `TableCell`

Represents rows and individual cells within an HTML table.

#### `TableRow.getCell(index)`
| Field / Method | Return Type | Description |
| :--- | :--- | :--- |
| `cellCount` | `number` | Total number of cells in the row. |
| `getCell(i)` | `TableCell \| null` | Returns the `TableCell` at index `i`. |

#### `TableCell.getChild(index)`
| Field / Method | Return Type | Description |
| :--- | :--- | :--- |
| `childCount` | `number` | Total number of inline nodes in the cell. |
| `getChild(i)` | `InlineNode \| null` | Returns the `InlineNode` at index `i`. |

```typescript
import { parseHTML, getBlocks } from 'react-native-fast-html-parser';

const article = parseHTML(`
  <table>
    <tr><th>Library</th><th>Speed</th></tr>
    <tr><td>FastHtmlParser</td><td>Sub-ms</td></tr>
  </table>
`);
const table = getBlocks(article)[0];

for (let r = 0; r < table.rowCount; r++) {
  const row = table.getRow(r);
  if (!row) continue;

  const rowValues: string[] = [];
  for (let c = 0; c < row.cellCount; c++) {
    const cell = row.getCell(c);
    if (!cell) continue;

    const cellText: string[] = [];
    for (let n = 0; n < cell.childCount; n++) {
      const inline = cell.getChild(n);
      if (inline?.text) cellText.push(inline.text);
    }
    rowValues.push(cellText.join(''));
  }
  console.log(`Row ${r}:`, rowValues.join(' | '));
}
```

---

### `DefinitionItem`

Represents a `<dt>` / `<dd>` term-definition pair in a `<dl>` list.

#### `DefinitionItem` `.getTerm(index)` & `.getDef(index)`

| Field / Method | Return Type | Description |
| :--- | :--- | :--- |
| `termCount` | `number` | Number of term (`<dt>`) inline nodes. |
| `getTerm(i)` | `InlineNode \| null` | Returns the `<dt>` inline node at index `i`. |
| `defCount` | `number` | Number of definition (`<dd>`) inline nodes. |
| `getDef(i)` | `InlineNode \| null` | Returns the `<dd>` inline node at index `i`. |

```typescript
import { parseHTML, getBlocks } from 'react-native-fast-html-parser';

const article = parseHTML(`
  <dl>
    <dt>TextKit 2</dt>
    <dd>Apple modern high-performance text rendering framework.</dd>
  </dl>
`);
const dl = getBlocks(article)[0];

for (let i = 0; i < dl.defItemCount; i++) {
  const item = dl.getDefItem(i);
  if (!item) continue;

  const term = item.getTerm(0)?.text;
  const def = item.getDef(0)?.text;
  console.log(`${term}: ${def}`);
}
```

---

### `FastHtmlParser` (Nitro HybridObject Singleton)

If you need direct programmatic access to the underlying Nitro HybridObject instance without the convenience wrapper functions:

```typescript
import { NitroModules } from 'react-native-nitro-modules';
import type { FastHtmlParser, ParsedArticle } from 'react-native-fast-html-parser';

// Access the native singleton
const parser = NitroModules.createHybridObject<FastHtmlParser>('FastHtmlParser');

// 1. Direct parse
const article: ParsedArticle | null = parser.parse('<h1>Direct JSI</h1>');

// 2. Direct JSON parse
const jsonString: string = parser.parseToJSON('<p>Single pass string</p>');
```

---

## 📖 Block Type Reference & Properties

| `block.type` | Applicable Properties | Example HTML Tag Origin |
| :--- | :--- | :--- |
| **`Paragraph`** | `childCount`, `getChild(i)` | `<p>`, `<address>`, `<div>` with inline text |
| **`Heading`** | `level` (1-6), `childCount`, `getChild(i)` | `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>` |
| **`List`** | `ordered`, `itemCount`, `getItem(i)` | `<ul>`, `<ol>`, `<li>` |
| **`Table`** | `rowCount`, `getRow(i)` | `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` |
| **`Image`** | `url`, `alt`, `linkUrl` | `<img>`, `<picture>`, `<p><img>`, `<a href="..."><img>` |
| **`Figure`** | `url`, `alt`, `caption`, `linkUrl` | `<figure>`, `<figcaption>` |
| **`CodeBlock`** | `code`, `language` | `<pre><code>` |
| **`Quote`** | `quoteChildCount`, `getQuoteChild(i)` | `<blockquote>`, `<q>` |
| **`DefinitionList`** | `defItemCount`, `getDefItem(i)` | `<dl>`, `<dt>`, `<dd>` |
| **`Video`** | `src`, `poster`, `caption` | `<video>`, `<source>` |
| **`Audio`** | `src`, `caption` | `<audio>` |
| **`Embed`** | `src`, `title`, `caption` | `<iframe>`, `<embed>` |
| **`Separator`** | _None_ | `<hr>` |

---

## 📄 JSON AST Data Models

When using `parseHTMLToJSON()`, the JSON output maps directly to these standard TypeScript interfaces:

```typescript
import type {
  ParsedArticleData,
  ContentBlockData,
  HeadingBlockData,
  ParagraphBlockData,
  ListBlockData,
  ListItemData,
  TableBlockData,
  TableRowData,
  TableCellData,
  ImageBlockData,
  CodeBlockData,
  QuoteBlockData,
  CustomBlockData,
  InlineNodeData,
} from 'react-native-fast-html-parser';
```

---

## 🚀 Advanced Production Recipes

### Recipe 1: Drop-in `@shopify/flash-list` Virtualization

For massive 50,000+ word editorial documents on low-end Android hardware, combine `getBlocks` with `@shopify/flash-list`:

```tsx
import React, { useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
  parseHTML,
  getBlocks,
  FastHtmlView,
  type ContentBlock,
} from 'react-native-fast-html-parser';

export function FlashListArticle({ html }: { html: string }) {
  const article = useMemo(() => parseHTML(html), [html]);
  const blocks = useMemo(() => getBlocks(article), [article]);

  const renderItem = ({ item }: { item: ContentBlock }) => {
    // Wrap individual block into a 1-block virtual article
    const singleBlockAst = {
      length: 1,
      getBlock: (i: number) => (i === 0 ? item : null),
      toJSON: () => JSON.stringify([item]),
      equals: () => false,
      dispose: () => {},
    } as any;

    return <FastHtmlView parsedAst={singleBlockAst} />;
  };

  return (
    <FlashList
      data={blocks}
      renderItem={renderItem}
      estimatedItemSize={60}
      keyExtractor={(_, index) => `flash-block-${index}`}
    />
  );
}
```

---

### Recipe 2: Offline Caching with MMKV / SQLite

Cache parsed AST structures across application sessions to eliminate HTML parsing overhead on subsequent launches:

```typescript
import {
  parseHTMLToJSON,
  type ParsedArticleData,
} from 'react-native-fast-html-parser';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

export function fetchAndCacheArticle(
  articleId: string,
  rawHtml: string
): ParsedArticleData {
  const cacheKey = `article_ast_${articleId}`;

  // 1. Check offline cache
  const cachedJson = storage.getString(cacheKey);
  if (cachedJson) {
    return JSON.parse(cachedJson);
  }

  // 2. Parse natively in 1-pass C++ pipeline
  const nativeJsonString = parseHTMLToJSON(rawHtml);

  // 3. Store serialized JSON directly into MMKV
  storage.set(cacheKey, nativeJsonString);

  return JSON.parse(nativeJsonString);
}
```

---

### Recipe 3: Custom Video Player Integration

Intercept `Video` and `Audio` blocks to render native players like `react-native-video`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  FastHtmlView,
  type CustomBlockRenderer,
} from 'react-native-fast-html-parser';

const CustomVideoRenderer: CustomBlockRenderer = ({ block }) => {
  return (
    <View style={styles.videoContainer}>
      <Text style={styles.videoLabel}>Video Stream</Text>
      <Text style={styles.videoUrl}>Source: {block.src}</Text>
      {block.poster ? <Text style={styles.posterText}>Poster: {block.poster}</Text> : null}
      {block.caption ? <Text style={styles.captionText}>{block.caption}</Text> : null}
    </View>
  );
};

export function MediaArticle({ html }: { html: string }) {
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
  videoContainer: { backgroundColor: '#0f172a', padding: 16, borderRadius: 8, marginVertical: 8 },
  videoLabel: { color: '#38bdf8', fontWeight: 'bold' },
  videoUrl: { color: '#f8fafc', fontSize: 13, marginTop: 4 },
  posterText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  captionText: { color: '#cbd5e1', fontStyle: 'italic', marginTop: 4 },
});
```

---

### Recipe 4: Custom Syntax Highlighting

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  FastHtmlView,
  type CustomBlockRenderer,
} from 'react-native-fast-html-parser';

const SyntaxHighlightedCode: CustomBlockRenderer = ({ block }) => {
  return (
    <View style={styles.box}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{block.language || 'code'}</Text>
      </View>
      <Text style={styles.codeText}>{block.code}</Text>
    </View>
  );
};

export function CodeArticle({ html }: { html: string }) {
  return (
    <FastHtmlView
      html={html}
      renderers={{
        CodeBlock: SyntaxHighlightedCode,
      }}
    />
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#1e1e1e', borderRadius: 8, padding: 12, marginVertical: 8 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#333', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#4ec9b0', fontSize: 11, fontFamily: 'Courier', fontWeight: 'bold' },
  codeText: { color: '#d4d4d4', fontFamily: 'Courier', fontSize: 13, marginTop: 8 },
});
```

---

### Recipe 5: Interactive Custom Callout / Poll Widget

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  FastHtmlView,
  type CustomBlockRenderer,
} from 'react-native-fast-html-parser';

const CalloutWidget: CustomBlockRenderer = ({ block }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.calloutCard}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <Text style={styles.calloutHeader}>
          💡 {block.caption || 'Important Note'} (Tap to {expanded ? 'Collapse' : 'Expand'})
        </Text>
      </TouchableOpacity>
      {expanded && (
        <Text style={styles.calloutBody}>
          This is an interactive callout rendered via React Native JSX while surrounding text renders at 120 FPS in native TextKit 2 / Spannables!
        </Text>
      )}
    </View>
  );
};

export function CalloutArticle({ html }: { html: string }) {
  return (
    <FastHtmlView
      html={html}
      renderers={{
        Figure: CalloutWidget,
      }}
    />
  );
}

const styles = StyleSheet.create({
  calloutCard: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, padding: 12, marginVertical: 8 },
  calloutHeader: { fontSize: 15, fontWeight: '700', color: '#1d4ed8' },
  calloutBody: { fontSize: 14, color: '#1e40af', marginTop: 8, lineHeight: 20 },
});
```

---

## 📚 Full TypeScript Type Reference

All data structures, props, and custom renderer types are fully exported:

```typescript
import type {
  // Core HybridObject Interfaces
  InlineNode,
  ListItem,
  TableCell,
  TableRow,
  DefinitionItem,
  ContentBlock,
  ParsedArticle,
  FastHtmlParser,

  // UI Component Props & Types
  FastHtmlViewProps,
  NativeHtmlViewProps,
  NativeHtmlViewMethods,
  NativeTextStyle,
  CustomBlockRenderer,
  CustomInlineRenderer,

  // Canonical Adapter Types
  CanonicalAdapterConfig,
  BlockTransformer,

  // JSON AST Data Models
  InlineNodeData,
  BaseBlockData,
  HeadingBlockData,
  ParagraphBlockData,
  ListItemData,
  ListBlockData,
  TableCellData,
  TableRowData,
  TableBlockData,
  ImageBlockData,
  CodeBlockData,
  QuoteBlockData,
  CustomBlockData,
  ContentBlockData,
  ParsedArticleData,
} from 'react-native-fast-html-parser';
```

---

## 📋 HTML Compatibility Matrix

For the complete 60+ HTML tag mapping specifications, attributes fidelity table, semantic normalization rules, and test verification suite, see:

👉 **[HTML_COMPATIBILITY_MATRIX.md](./HTML_COMPATIBILITY_MATRIX.md)**

---

## 📄 License

MIT © [abhishekce17](https://github.com/abhishekce17)
