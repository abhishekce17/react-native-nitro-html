/**
 * react-native-fast-html-parser — Comprehensive Example App
 *
 * Tabs:
 *  1. FastHtmlView       — Native Fabric RichText Engine with tagsStyles + Custom Renderer Injection
 *  2. Infinite Scale     — Massive 40+ paragraph HTML doc rendered 100% natively at 120 FPS
 *  3. Wrappers           — getBlocks / getChildren / getItems / getRows / getCells /
 *                          getQuoteChildren / getDefItems used directly
 *  4. JSON Pipeline      — parseHTMLToJSON / article.toJSON() / createCanonicalAdapter
 */

import { useMemo, useState, useCallback } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getBlocks,
  getCells,
  getChildren,
  getDefItems,
  getItems,
  getNestedBlocks,
  getQuoteChildren,
  getRows,
  FastHtmlView,
  parseHTML,
  parseHTMLAsync,
  type ContentBlock,
  type ParsedArticle,
} from 'react-native-fast-html-parser';

// ─── Shared HTML samples ─────────────────────────────────────────────────────

const RICH_HTML = `
<h1>⚡ react-native-fast-html-parser</h1>
<p>A high-performance HTML pipeline powered by a compiled <b>C++ (Lexbor)</b> core
and direct <i>C++ JSI</i> via <a href="https://nitro.margelo.com">Nitro Modules</a>.</p>

<blockquote>
  <p>"Zero-copy JSI access bypasses bridge serialization entirely."</p>
  <p>— Architecture Design Doc</p>
</blockquote>

<h2>Features</h2>
<ul>
  <li>Sub-millisecond native parsing</li>
  <li>100% Native Fabric RichText View (TextKit 2 & Android Spannables)</li>
  <li>Continuous text selection across paragraphs, headings & lists</li>
  <li>1-pass <code>parseHTMLToJSON()</code> for caching
    <ol>
      <li>SQLite / MMKV storage</li>
      <li>Redux / Zustand state slices</li>
    </ol>
  </li>
  <li>Drop-in <code>&lt;FastHtmlView /&gt;</code> component</li>
</ul>

<h2>Benchmark (100 KB payload)</h2>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Parse time</td><td>0.353 ms</td></tr>
  <tr><td>JSON serialization</td><td>0.128 ms</td></tr>
  <tr><td>Throughput</td><td>204.48 MB/s</td></tr>
  <tr><td>Blocks extracted</td><td>488 blocks</td></tr>
</table>

<h2>Quick Start</h2>
<pre><code class="typescript">import { FastHtmlView } from 'react-native-fast-html-parser';

export function ArticleScreen({ html }: { html: string }) {
  return &lt;FastHtmlView html={html} /&gt;;
}</code></pre>

<h2>Definition List</h2>
<dl>
  <dt>JSI</dt><dd>JavaScript Interface — direct C++ ↔ JS bridge, no serialization.</dd>
  <dt>Nitro Modules</dt><dd>Next-gen RN native module framework built on JSI.</dd>
  <dt>HybridObject</dt><dd>C++ object with a JS-facing facade, zero memory copy.</dd>
</dl>

<figure>
  <img src="https://picsum.photos/seed/rn-parser/800/300" alt="Architecture diagram" />
  <figcaption>Lexbor C++ parser → Nitro JSI bridge → React Native UI</figcaption>
</figure>

<hr />

<p>Built with ❤️ for the React Native community.</p>
`;

const NEW_FEATURES_HTML = `
<style>
  .highlight { color: #8b5cf6; font-weight: bold; }
  .box { background-color: #f1f5f9; padding: 8px; border-left: 4px solid #8b5cf6; }
</style>

<h2>🔥 All 11 Native Optimizations Live</h2>

<div class="box">
  <p class="highlight">✨ Embedded CSS &lt;style&gt; Sheet Engine in C++ (Lexbor)</p>
  <p>Class selectors, compound rules, and element cascades are resolved in C++ at parse-time with 0 JS overhead.</p>
</div>

<h3>1. HTML5 Named & Numeric Entities</h3>
<p>Entity decoding in C++ ($O(1)$ static table): &ldquo;Double Quotes&rdquo;, &mdash; (em-dash), &hellip; (ellipsis), &euro;100 (Euro), &infin; (Infinity), &copy; 2026, &Delta; (Delta), &#9733; (Star), &hearts; (Hearts).</p>

<h3>2. OpenType Numeric & Tabular Figures</h3>
<p>Invoice #98214: Total = $1,429.50 | 1/2 + 3/4 = 5/4 (Fractions & Tabular Numbers)</p>

<h3>3. Wide Data Table (Horizontal Scroll)</h3>
<table>
  <tr><th>ID</th><th>Service</th><th>Latency</th><th>Throughput</th><th>Status</th><th>Region</th><th>Uptime</th><th>Score</th></tr>
  <tr><td>001</td><td>Lexbor C++</td><td>0.08ms</td><td>150 MB/s</td><td>Active</td><td>us-east</td><td>99.99%</td><td>100</td></tr>
  <tr><td>002</td><td>Nitro JSI</td><td>0.01ms</td><td>950 MB/s</td><td>Active</td><td>eu-central</td><td>99.999%</td><td>100</td></tr>
  <tr><td>003</td><td>TextKit 2</td><td>0.45ms</td><td>60 FPS</td><td>Active</td><td>ap-south</td><td>99.95%</td><td>98</td></tr>
</table>
`;

// Long document for Infinite Scale tab — 40+ paragraphs
const LONG_HTML = Array.from(
  { length: 40 },
  (_, i) => `
<h${(i % 3) + 2}>Section ${i + 1}: Native Performance</h${(i % 3) + 2}>
<p>This is paragraph ${i + 1}. The <b>FastHtmlView</b> uses
native text fragment rendering with <b>0 React Virtual DOM nodes</b>.
Long articles of any length stay at <code>120 FPS</code> smooth scrolling with continuous text selection.</p>
${i % 5 === 0 ? `<blockquote><p>Native milestone at block ${i + 1}.</p></blockquote>` : ''}
${i % 7 === 0 ? `<ul><li>Item A in section ${i + 1}</li><li>Item B</li></ul>` : ''}
`
).join('');

// Comprehensive showcase HTML covering every block type, inline element,
// malformed HTML resiliency, props, standard attributes, and custom attributes.
const ALL_BLOCKS_HTML = `
<h1>📦 Comprehensive HTML Content Blocks Showcase</h1>
<p>This test suite contains every supported and normalized content block type rendered with 100% pure raw HTML — zero CSS injection.</p>

<h2>1. Block: Heading (&lt;h1&gt; to &lt;h6&gt;)</h2>
<p>Headings with standard <code>id</code>, <code>class</code>, and <code>data-*</code> attributes:</p>
<h1 id="heading-h1" class="editorial-title" data-level="1">Heading Level 1 (&lt;h1&gt;)</h1>
<h2 id="heading-h2" class="section-title" data-level="2">Heading Level 2 (&lt;h2&gt;)</h2>
<h3 id="heading-h3" class="subsection-title" data-level="3">Heading Level 3 (&lt;h3&gt;)</h3>
<h4 id="heading-h4" data-level="4">Heading Level 4 (&lt;h4&gt;)</h4>
<h5 id="heading-h5" data-level="5">Heading Level 5 (&lt;h5&gt;)</h5>
<h6 id="heading-h6" data-level="6">Heading Level 6 (&lt;h6&gt;)</h6>

<h2>2. Block: Paragraph &amp; Inline Typography</h2>
<p id="main-para" class="body-text" data-testid="para-sample" aria-label="Paragraph sample">
  This is a standard paragraph demonstrating all inline phrasing tags:
  <b>bold (&lt;b&gt;)</b>, <strong>strong (&lt;strong&gt;)</strong>,
  <i>italic (&lt;i&gt;)</i>, <em>emphasis (&lt;em&gt;)</em>,
  <u>underline (&lt;u&gt;)</u>, <ins>inserted (&lt;ins&gt;)</ins>,
  <s>strikethrough (&lt;s&gt;)</s>, <del>deleted (&lt;del&gt;)</del>,
  <code>inline code (&lt;code&gt;)</code>, <mark>mark highlight (&lt;mark&gt;)</mark>,
  <sub>subscript (&lt;sub&gt;: H<sub>2</sub>O)</sub>,
  <sup>superscript (&lt;sup&gt;: E=mc<sup>2</sup>)</sup>, and a link:
  <a href="https://nitro.margelo.com" target="_blank" rel="noopener" data-track="link_click">Nitro Modules Link (&lt;a&gt;)</a>.<br />
  A manual line break (&lt;br /&gt;) splits this line.
</p>

<h2>3. Block: Blockquote &amp; Nested Quotes</h2>
<blockquote cite="https://example.com" class="featured-quote" data-author="Lexbor Core" aria-label="Core Architecture Quote">
  <p><b>"Zero-copy C++ JSI direct memory access delivers sub-millisecond parsing on mobile devices."</b></p>
  <p>— Fast HTML Architecture Whitepaper</p>
  <blockquote>
    <p>Nested quote level 2: <i>"Inner quotes maintain correct hierarchy and margin indentation."</i></p>
  </blockquote>
</blockquote>

<h2>4. Block: Lists (Unordered, Ordered &amp; Nested)</h2>
<p><b>Unordered List (&lt;ul&gt; &amp; &lt;li&gt;):</b></p>
<ul class="feature-list" data-list="unordered" role="list">
  <li id="li-1" data-index="0">First bullet item with plain text</li>
  <li id="li-2" data-index="1">Second bullet item with <b>bold text</b> and <a href="https://github.com">link</a></li>
  <li id="li-3" data-index="2">
    Third bullet item containing a nested list:
    <ul class="nested-list">
      <li>Nested sub-item A</li>
      <li>Nested sub-item B with <code>nested code</code></li>
    </ul>
  </li>
</ul>

<p><b>Ordered List (&lt;ol&gt; &amp; &lt;li&gt;):</b></p>
<ol start="1" type="1" class="step-list" data-list="ordered">
  <li data-step="1">Step 1: HTML string passed to native parser</li>
  <li data-step="2">Step 2: C++ Lexbor engine normalizes DOM tree</li>
  <li data-step="3">Step 3: Fabric view renders native text fragments</li>
</ol>

<h2>5. Block: CodeBlock (&lt;pre&gt; &amp; &lt;code&gt;)</h2>
<pre><code class="language-typescript" data-lang="typescript" data-source="sample.ts">// TypeScript CodeBlock example with class &amp; data attributes
import { FastHtmlView } from 'react-native-fast-html-parser';

export function DocumentViewer({ html }: { html: string }) {
  return (
    &lt;FastHtmlView
      html={html}
      onLinkPress={(url) =&gt; console.log(url)}
    /&gt;
  );
}</code></pre>

<h2>6. Block: 2D Data Table (&lt;table&gt;)</h2>
<table border="1" cellpadding="8" cellspacing="0" class="performance-table" data-table="benchmarks" aria-label="Benchmark Table">
  <thead>
    <tr>
      <th scope="col" data-col="engine">Engine Layer</th>
      <th scope="col" data-col="tech">Technology</th>
      <th scope="col" data-col="time">Parse Time</th>
      <th scope="col" data-col="fps">Framerate</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Parser Core</b></td>
      <td>Lexbor (Compiled C++)</td>
      <td><code>0.08 ms</code></td>
      <td>120 FPS</td>
    </tr>
    <tr>
      <td><b>Bridge Layer</b></td>
      <td>Nitro Modules (Direct JSI)</td>
      <td><code>0.01 ms</code></td>
      <td>120 FPS</td>
    </tr>
    <tr>
      <td><b>Native View</b></td>
      <td>TextKit 2 / Spannables</td>
      <td><code>0.35 ms</code></td>
      <td>120 FPS</td>
    </tr>
  </tbody>
</table>

<h2>7. Block: Definition List (&lt;dl&gt;, &lt;dt&gt;, &lt;dd&gt;)</h2>
<dl class="glossary" data-section="glossary">
  <dt id="term-jsi"><b>JSI</b></dt>
  <dd data-def-for="jsi">JavaScript Interface — direct C++ to JavaScript engine bridge without serialization.</dd>
  <dt id="term-nitro"><b>Nitro Modules</b></dt>
  <dd data-def-for="nitro">Next-generation native modules architecture offering direct C++ type bindings.</dd>
  <dt id="term-lexbor"><b>Lexbor</b></dt>
  <dd data-def-for="lexbor">High-performance thread-safe C HTML5 parser and layout engine.</dd>
</dl>

<h2>8. Block: Media, Image &amp; Figure (&lt;img&gt;, &lt;figure&gt;, &lt;figcaption&gt;)</h2>
<p><b>Standard Image with attributes:</b></p>
<img src="https://picsum.photos/seed/block-demo/600/200" alt="Sample landscape" width="100%" class="banner-image" data-zoomable="true" />

<p><b>Figure with Caption:</b></p>
<figure class="article-figure" data-figure-id="fig-1">
  <img src="https://picsum.photos/seed/figure-demo/600/200" alt="Figure demonstration" width="100%" />
  <figcaption><i>Figure 1: Visual representation of native zero-copy HTML rendering pipeline.</i></figcaption>
</figure>

<h2>9. Block: Horizontal Separator (&lt;hr&gt;)</h2>
<p>Content block above the horizontal separator line.</p>
<hr class="section-divider" data-divider-style="solid" />
<p>Content block below the horizontal separator line.</p>

<h2>10. Malformed HTML Recovery &amp; Resiliency</h2>
<p><b>A. Unclosed Tags (Auto-closed by Parser):</b></p>
<p>This paragraph contains an <b>unclosed bold tag and an <i>unclosed italic tag without closing tags.</i></b></p>

<p><b>B. Mismatched Nesting Order:</b></p>
<p><b><i>Mismatched tags order (b &gt; i &gt; /b &gt; /i)</b></i> normalized seamlessly.</p>

<p><b>C. Stray / Orphan Closing Tags:</b></p>
<p>Parser recovered cleanly after stray closing tags.</p>

<p><b>D. Malformed Attribute Quotes:</b></p>
<p><a href="https://example.com/broken" class="unclosed-attr">Link with malformed attributes</a></p>

<p><b>E. Unclosed List &amp; Table Rows:</b></p>
<ul><li>Item 1 without closing li tag<li>Item 2 without closing li tag</ul>

<h2>11. Props, Standard Attributes &amp; Custom Attributes</h2>
<p>Elements with <code>id</code>, <code>class</code>, <code>style</code>, <code>data-*</code>, <code>aria-*</code>, <code>role</code>, and custom tags:</p>

<custom-banner id="promo-banner" class="highlight-banner" data-campaign="2026-launch" data-discount="40%" aria-live="polite" role="region">
  <p><b>&lt;custom-banner&gt;</b> custom tag with <code>data-campaign="2026-launch"</code> and <code>data-discount="40%"</code>.</p>
</custom-banner>

<user-card user-id="usr_8821" role="author" data-verified="true" data-role="contributor" style="padding: 8px;">
  <p><b>&lt;user-card&gt;</b> custom component tag with attributes <code>user-id="usr_8821"</code> and <code>data-verified="true"</code>.</p>
</user-card>

<h2>12. HTML5 Entities &amp; Special Characters</h2>
<p>
  <b>Named Entities:</b> &ldquo;Quotes&rdquo;, &lsquo;Single&rsquo;, &mdash; (em-dash), &ndash; (en-dash), &hellip; (ellipsis), &copy; 2026, &reg;, &trade;<br />
  <b>Currency &amp; Math:</b> &dollar;1,250.00 &euro;850.00 &pound;720.00 &yen;120,000 | &infin; &Delta; &pi; &plusmn; &times; &divide;<br />
  <b>Symbols &amp; Unicode:</b> &hearts; &#9733; &#9734; &#x1F680; &#x1F525; &#x2705; &#x26A1;
</p>
`;

// ─── Custom Renderers Sample HTML ────────────────────────────────────────────

const CUSTOM_HTML = `
<h1>⚡ Custom Component Injection</h1>
<p>Standard HTML blocks render 100% natively, while custom renderers intercept specific block types (like interactive CodeBlocks, Video Players, or custom Web Components) without breaking surrounding native layout!</p>

<hr />
<h2>1. Custom Interactive CodeBlock</h2>
<pre><code class="language-typescript">// TypeScript Native Module Example
import { NitroModules } from 'react-native-nitro-modules';

export const parser = NitroModules.createHybridObject('FastHtmlParser');
const article = parser.parse('<p>Hello from compiled Lexbor C++!</p>');</code></pre>

<hr />
<h2>2. Custom Video Player Component</h2>
<video src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" poster="https://picsum.photos/600/300" title="Big Buck Bunny Demo"></video>

<hr />
<h2>3. Custom Interactive Poll Widget (&lt;custom-poll&gt;)</h2>
<custom-poll title="Which engine performs best?" id="poll-01">
  <p>Vote for your favorite React Native HTML architecture:</p>
</custom-poll>

<hr />
<h2>4. Native Content Immediately Following Custom Components</h2>
<p>This paragraph is placed directly below the custom React components and continues rendering seamlessly through the high-performance native host view with continuous text selection support!</p>
`;

// ─── Tab navigation ──────────────────────────────────────────────────────────

const TABS = [
  'All Blocks',
  'FastHtmlView',
  'Custom Renderers',
  'New Features',
  'Infinite Scale',
  'Wrappers',
  'JSON',
] as const;
type Tab = (typeof TABS)[number];

// ─── Tab 0: All Blocks Showcase ──────────────────────────────────────────────

function AllBlocksTab() {
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionLabel}>
        All HTML Content Blocks &amp; Tags Showcase
      </Text>
      <Text style={styles.sectionHint}>
        Every block type, inline typography, malformed HTML resiliency, props,
        standard &amp; custom attributes rendered 100% natively with pure raw
        HTML.
      </Text>
      <View style={styles.card}>
        <FastHtmlView
          html={ALL_BLOCKS_HTML}
          onLinkPress={(url: string) => Alert.alert('Link Clicked', url)}
        />
      </View>
    </ScrollView>
  );
}

// ─── Tab 1: FastHtmlView ─────────────────────────────────────────────────────

function RenderedTab() {
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionLabel}>
        Using &lt;FastHtmlView html=&#123;RICH_HTML&#125; /&gt;
      </Text>
      <Text style={styles.sectionHint}>
        Pure raw HTML passed directly to NativeHtmlView with zero custom styles
        or CSS.
      </Text>
      <View style={styles.card}>
        <FastHtmlView
          html={RICH_HTML}
          onLinkPress={(url: string) => Alert.alert('onLinkPress', url)}
        />
      </View>
    </ScrollView>
  );
}

// ─── Tab: Custom Renderers ───────────────────────────────────────────────────

function CustomRenderersTab() {
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({
    'Compiled C++ (Lexbor)': 42,
    '100% Native Fabric View': 38,
    'Zero-Hook JS Facade': 29,
  });
  const [selectedVote, setSelectedVote] = useState<string | null>(null);

  const handleVote = (option: string) => {
    if (selectedVote === option) return;
    setPollVotes((prev) => ({
      ...prev,
      [option]: (prev[option] ?? 0) + 1,
      ...(selectedVote
        ? { [selectedVote]: Math.max(0, (prev[selectedVote] ?? 1) - 1) }
        : {}),
    }));
    setSelectedVote(option);
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionLabel}>
        Custom Component Renderer Injection
      </Text>
      <Text style={styles.sectionHint}>
        Demonstrating custom interactive CodeBlocks, Video Players, and custom
        widget elements injected directly into the native rendering stream.
      </Text>
      <View style={styles.card}>
        <FastHtmlView
          html={CUSTOM_HTML}
          renderers={{
            'CodeBlock': ({ block }: { block: ContentBlock }) => (
              <View style={styles.customCodeBox}>
                <View style={styles.customCodeHeader}>
                  <View style={styles.customCodeBadge}>
                    <Text style={styles.customCodeBadgeText}>
                      {(block.language || 'typescript').toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.customCodeCopyBtn}
                    onPress={() =>
                      Alert.alert('Copied to Clipboard!', block.code)
                    }
                  >
                    <Text style={styles.customCodeCopyText}>📋 Copy Code</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.customCodeText}>{block.code}</Text>
                </ScrollView>
              </View>
            ),
            'Video': ({ block }: { block: ContentBlock }) => (
              <View style={styles.customVideoContainer}>
                <View style={styles.customVideoHeader}>
                  <Text style={styles.customVideoTitle}>
                    🎬 {block.title || 'Featured Video'}
                  </Text>
                  <Text style={styles.customVideoPill}>HD 1080p</Text>
                </View>
                <TouchableOpacity
                  style={styles.customVideoPlaceholder}
                  onPress={() =>
                    Alert.alert('Playback Triggered', `Source: ${block.src}`)
                  }
                >
                  <View style={styles.customVideoPlayIcon}>
                    <Text style={styles.customVideoPlayText}>▶</Text>
                  </View>
                  <Text style={styles.customVideoPlayLabel}>
                    Tap to Stream Video
                  </Text>
                </TouchableOpacity>
                <Text style={styles.customVideoSrcText} numberOfLines={1}>
                  {block.src}
                </Text>
              </View>
            ),
            'custom-poll': ({ block }: { block: ContentBlock }) => (
              <View style={styles.customPollContainer}>
                <Text style={styles.customPollTitle}>
                  📊 {block.title || 'Community Poll'}
                </Text>
                {Object.entries(pollVotes).map(([option, count]) => {
                  const isSelected = selectedVote === option;
                  const total = Object.values(pollVotes).reduce(
                    (a, b) => a + b,
                    0
                  );
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.customPollOption,
                        isSelected && styles.customPollOptionSelected,
                      ]}
                      onPress={() => handleVote(option)}
                    >
                      <View
                        style={[
                          styles.customPollBar,
                          { width: `${pct}%` },
                          isSelected && styles.customPollBarSelected,
                        ]}
                      />
                      <Text
                        style={[
                          styles.customPollText,
                          isSelected && styles.customPollTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                      <Text
                        style={[
                          styles.customPollCount,
                          isSelected && styles.customPollCountSelected,
                        ]}
                      >
                        {pct}% ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ),
          }}
          onLinkPress={(url: string) => Alert.alert('onLinkPress', url)}
        />
      </View>
    </ScrollView>
  );
}

// ─── Tab 2: New Features (All 11 Optimizations) ──────────────────────────────

function NewFeaturesTab({
  parsedAst: _parsedAst,
}: {
  parsedAst: ParsedArticle | null;
}) {
  const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>('auto');
  const [fontFeature, setFontFeature] = useState<
    'normal' | 'tnum' | 'frac' | 'smcp'
  >('tnum');
  const [asyncTime, setAsyncTime] = useState<number | null>(null);

  const handleAsyncParse = useCallback(async () => {
    const t0 = performance.now();
    const result = await parseHTMLAsync(NEW_FEATURES_HTML);
    const elapsed = performance.now() - t0;
    setAsyncTime(elapsed);
    Alert.alert(
      'Off-Thread Async Parse Succeeded',
      `Parsed in ${elapsed.toFixed(3)} ms on Nitro background thread.\nBlocks extracted: ${getBlocks(result).length}`
    );
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Controls Card */}
      <View style={[styles.card, styles.controlCard]}>
        <Text style={styles.sectionLabel}>Live Optimizations Engine</Text>

        {/* Theme Mode Toggle */}
        <Text style={styles.controlLabel}>
          Native Dynamic Color / Dark Mode:
        </Text>
        <View style={styles.controlRow}>
          {(['auto', 'light', 'dark'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.smallBtn,
                themeMode === m && styles.activeSmallBtn,
              ]}
              onPress={() => setThemeMode(m)}
            >
              <Text
                style={[
                  styles.smallBtnText,
                  themeMode === m && styles.activeSmallBtnText,
                ]}
              >
                {m.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* OpenType Features Toggle */}
        <Text style={styles.controlLabel}>OpenType Typography Features:</Text>
        <View style={styles.controlRow}>
          {(['normal', 'tnum', 'frac', 'smcp'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.smallBtn,
                fontFeature === f && styles.activeSmallBtn,
              ]}
              onPress={() => setFontFeature(f)}
            >
              <Text
                style={[
                  styles.smallBtnText,
                  fontFeature === f && styles.activeSmallBtnText,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={handleAsyncParse}
          >
            <Text style={styles.actionBtnText}>
              ⚡ parseHTMLAsync
              {asyncTime != null ? ` (${asyncTime.toFixed(2)}ms)` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rendered HTML */}
      <View
        style={[styles.card, themeMode === 'dark' ? styles.cardDark : null]}
      >
        <FastHtmlView
          html={NEW_FEATURES_HTML}
          onLinkPress={(url: string) => Alert.alert('Link Press', url)}
        />
      </View>
    </ScrollView>
  );
}

// ─── Tab 3: Infinite Scale (Long Document) ───────────────────────────────────

function InfiniteScaleTab() {
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.virtualHeader}>
        <Text style={styles.virtualHeaderTitle}>
          Infinite Scale FastHtmlView
        </Text>
        <Text style={styles.virtualHeaderSub}>
          40 Sections · 0 React VDOM Nodes · 100% Native Viewport Layout
        </Text>
      </View>
      <View style={styles.card}>
        <FastHtmlView
          html={LONG_HTML}
          onLinkPress={(url: string) => Alert.alert('Link Clicked', url)}
        />
      </View>
    </ScrollView>
  );
}

// ─── Tab 3: Wrappers ─────────────────────────────────────────────────────────

interface WrapperRow {
  label: string;
  value: string;
}

function WrappersTab({ parsedAst }: { parsedAst: ParsedArticle | null }) {
  const rows = useMemo<WrapperRow[]>(() => {
    if (!parsedAst) return [];

    // getBlocks
    const blocks = getBlocks(parsedAst);
    const result: WrapperRow[] = [
      { label: 'getBlocks(article).length', value: String(blocks.length) },
    ];

    // getChildren — from first Paragraph
    const para = blocks.find((b: ContentBlock) => b.type === 'Paragraph');
    if (para) {
      const inlines = getChildren(para);
      result.push({
        label: 'getChildren(paragraph).length',
        value: String(inlines.length),
      });
      result.push({
        label: 'getChildren types',
        value: inlines.map((n) => n.type).join(', '),
      });
    }

    // getItems — from first List
    const list = blocks.find((b: ContentBlock) => b.type === 'List');
    if (list) {
      const items = getItems(list);
      result.push({
        label: 'getItems(list).length',
        value: String(items.length),
      });

      // getNestedBlocks — from items
      items.forEach((item, i) => {
        const nested = getNestedBlocks(item);
        if (nested.length > 0) {
          result.push({
            label: `getNestedBlocks(item[${i}]).length`,
            value: String(nested.length),
          });
        }
      });
    }

    // getRows + getCells — from Table
    const table = blocks.find((b: ContentBlock) => b.type === 'Table');
    if (table) {
      const rows2 = getRows(table);
      result.push({
        label: 'getRows(table).length',
        value: String(rows2.length),
      });
      if (rows2[0]) {
        const cells = getCells(rows2[0]);
        result.push({
          label: 'getCells(row[0]).length',
          value: String(cells.length),
        });
        result.push({
          label: 'Cell[0] text',
          value: getChildren(cells[0] ?? null)
            .map((c) => c.text)
            .join(''),
        });
      }
    }

    // getQuoteChildren — from Quote
    const quote = blocks.find((b: ContentBlock) => b.type === 'Quote');
    if (quote) {
      const qc = getQuoteChildren(quote);
      result.push({
        label: 'getQuoteChildren(quote).length',
        value: String(qc.length),
      });
    }

    // getDefItems — from DefinitionList
    const dl = blocks.find((b: ContentBlock) => b.type === 'DefinitionList');
    if (dl) {
      const defs = getDefItems(dl);
      result.push({
        label: 'getDefItems(dl).length',
        value: String(defs.length),
      });
      if (defs[0]) {
        result.push({
          label: 'defItems[0] term',
          value: defs[0].getTerm(0)?.text ?? '—',
        });
        result.push({
          label: 'defItems[0] definition',
          value: defs[0].getDef(0)?.text
            ? defs[0].getDef(0)!.text.slice(0, 40) + '…'
            : '—',
        });
      }
    }

    return result;
  }, [parsedAst]);

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionLabel}>AST Traversal Wrappers</Text>
      <Text style={styles.sectionHint}>
        getBlocks · getChildren · getItems · getNestedBlocks · getRows ·
        getCells · getQuoteChildren · getDefItems — all called on the same
        ParsedArticle.
      </Text>
      {rows.map((row, i) => (
        <View key={i} style={styles.wrapperRow}>
          <Text style={styles.wrapperLabel}>{row.label}</Text>
          <Text style={styles.wrapperValue}>{row.value}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Tab 4: AST JSON Tree ───────────────────────────────────────────────────

function JsonTab({ parsedAst }: { parsedAst: ParsedArticle | null }) {
  const blocks = useMemo(() => getBlocks(parsedAst), [parsedAst]);

  const displayJson = useMemo(() => {
    const rawData = {
      totalBlocks: blocks.length,
      blocks: blocks.map((b) => ({
        type: b.type,
        level: b.level > 0 ? b.level : undefined,
        url: b.url || undefined,
        code: b.code || undefined,
        language: b.language || undefined,
        children: getChildren(b).map((c) => ({
          type: c.type,
          text: c.text || undefined,
          url: c.url || undefined,
        })),
      })),
    };
    return JSON.stringify(rawData, null, 2);
  }, [blocks]);

  return (
    <View style={styles.jsonTab}>
      {/* Description */}
      <Text style={styles.jsonDesc}>
        Inspecting parsed AST blocks and inline nodes extracted natively by C++
        (Lexbor).
      </Text>

      {/* JSON output */}
      <ScrollView
        style={styles.jsonScroll}
        contentContainerStyle={styles.jsonScrollContent}
      >
        <Text style={styles.jsonText}>{displayJson}</Text>
      </ScrollView>
    </View>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('All Blocks');

  // Parse once — shared across tabs
  const parsedAst = useMemo(() => parseHTML(RICH_HTML), []);
  const blockCount = useMemo(() => getBlocks(parsedAst).length, [parsedAst]);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>react-native-fast-html-parser</Text>
        <Text style={styles.headerSub}>
          {blockCount} blocks · C++ (Lexbor) core · 100% Native FastHtmlView
        </Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === tab && styles.activeTabBtnText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Active tab */}
      <View style={styles.tabBody}>
        {activeTab === 'All Blocks' && <AllBlocksTab />}
        {activeTab === 'FastHtmlView' && <RenderedTab />}
        {activeTab === 'Custom Renderers' && <CustomRenderersTab />}
        {activeTab === 'New Features' && (
          <NewFeaturesTab parsedAst={parsedAst} />
        )}
        {activeTab === 'Infinite Scale' && <InfiniteScaleTab />}
        {activeTab === 'Wrappers' && <WrappersTab parsedAst={parsedAst} />}
        {activeTab === 'JSON' && <JsonTab parsedAst={parsedAst} />}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // Header
  header: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#ddd6fe',
    marginTop: 2,
  },

  // Tab bar
  tabBarWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  activeTabBtn: {
    borderBottomWidth: 2,
    borderBottomColor: '#7c3aed',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabBtnText: {
    color: '#7c3aed',
  },
  tabBody: {
    flex: 1,
  },

  htmlBaseStyle: {
    color: '#1e293b',
    fontSize: 15,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // ─── Custom Renderers Styles ───────────────────────────────────────────────
  customCodeBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customCodeBadge: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#38bdf840',
  },
  customCodeBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  customCodeCopyBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  customCodeCopyText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  customCodeText: {
    fontFamily: 'Courier',
    color: '#f8fafc',
    fontSize: 12,
    lineHeight: 18,
  },

  customVideoContainer: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  customVideoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customVideoTitle: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '700',
  },
  customVideoPill: {
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  customVideoPlaceholder: {
    height: 140,
    backgroundColor: '#09090b',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
    marginVertical: 4,
  },
  customVideoPlayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  customVideoPlayText: {
    color: '#ffffff',
    fontSize: 18,
    marginLeft: 3,
  },
  customVideoPlayLabel: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  customVideoSrcText: {
    color: '#71717a',
    fontSize: 10,
    fontFamily: 'Courier',
    marginTop: 8,
  },

  customPollContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customPollTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  customPollOption: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  customPollOptionSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#faf5ff',
  },
  customPollBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#f1f5f9',
  },
  customPollBarSelected: {
    backgroundColor: '#ede9fe',
  },
  customPollText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    zIndex: 1,
  },
  customPollTextSelected: {
    color: '#7c3aed',
    fontWeight: '700',
  },
  customPollCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    zIndex: 1,
  },
  customPollCountSelected: {
    color: '#7c3aed',
    fontWeight: '700',
  },

  // Virtualized / Infinite Scale tab
  virtualHeader: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  virtualHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  virtualHeaderSub: {
    fontSize: 13,
    color: '#ddd6fe',
    marginTop: 4,
  },

  // Wrappers tab
  wrapperRow: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  wrapperLabel: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#475569',
    flex: 1,
    flexWrap: 'wrap',
  },
  wrapperValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7c3aed',
    marginLeft: 10,
    flexShrink: 1,
    textAlign: 'right',
  },

  // JSON tab
  jsonTab: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  jsonModeRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 6,
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeModeBtn: {
    backgroundColor: '#7c3aed',
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeModeBtnText: {
    color: '#ffffff',
  },
  jsonDesc: {
    fontSize: 11,
    color: '#64748b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    lineHeight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  jsonScroll: {
    flex: 1,
  },
  jsonScrollContent: {
    padding: 14,
  },
  jsonText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 18,
  },
  virtualBaseStyle: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 24,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  activeSmallBtn: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  activeSmallBtnText: {
    color: '#ffffff',
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#7c3aed',
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#0284c7',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  controlCard: {
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cardDark: {
    backgroundColor: '#1e293b',
  },
});
