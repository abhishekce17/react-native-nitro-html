import type React from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import type {
  ContentBlock,
  InlineNode,
  ParsedArticle,
} from '../FastHtmlParser.nitro';
import type { NativeTextStyle } from '../NativeHtmlView.nitro';

export type { NativeTextStyle };

export type CustomBlockRenderer = React.ComponentType<{
  block: ContentBlock;
  baseStyle?: TextStyle;
  tagStyle?: TextStyle | ViewStyle;
}>;

export type CustomInlineRenderer = React.ComponentType<{
  node: InlineNode;
  baseStyle?: TextStyle;
}>;

export interface FastHtmlViewProps {
  /**
   * The raw HTML string to parse and render natively.
   */
  html?: string;

  /**
   * Parsing execution mode: 'sync' (default) or 'async' (dispatched to C++ worker).
   */
  mode?: 'sync' | 'async';

  /**
   * An already-parsed AST object (optional, if parsed ahead of time).
   */
  parsedAst?: ParsedArticle | null;

  /**
   * Base text style applied to all rendered inline content.
   */
  baseStyle?: TextStyle & { fontFeatureSettings?: string };

  /**
   * Custom style overrides for specific tags/blocks (e.g. `h1`, `h2`, `p`, `a`, `code`).
   */
  tagsStyles?: Record<string, TextStyle | ViewStyle>;

  /**
   * Custom component renderers for block elements (e.g., custom Video player, CodeBlock, Polls).
   */
  renderers?: {
    Paragraph?: CustomBlockRenderer;
    Heading?: CustomBlockRenderer;
    Image?: CustomBlockRenderer;
    Figure?: CustomBlockRenderer;
    CodeBlock?: CustomBlockRenderer;
    List?: CustomBlockRenderer;
    Table?: CustomBlockRenderer;
    Quote?: CustomBlockRenderer;
    DefinitionList?: CustomBlockRenderer;
    Video?: CustomBlockRenderer;
    Audio?: CustomBlockRenderer;
    Embed?: CustomBlockRenderer;
    Separator?: CustomBlockRenderer;
    [key: string]: CustomBlockRenderer | undefined;
  };

  /**
   * Enable or disable native continuous text selection. Defaults to `true`.
   */
  selectable?: boolean;

  /**
   * OpenType font feature settings (e.g. '"tnum" 1', '"liga" 1', '"frac" 1').
   */
  fontFeatureSettings?: string;

  /**
   * Callback fired when an `<a>` link node is pressed.
   */
  onLinkPress?: (url: string) => void;

  /**
   * Style for the outer container.
   */
  style?: ViewStyle;
}
