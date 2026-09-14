import type { HybridObject } from 'react-native-nitro-modules';
import type { NativeTextStyle } from './NativeHtmlView.nitro';

export interface InlineNode extends HybridObject<{
  ios: 'c++';
  android: 'c++';
}> {
  readonly type: string;
  readonly text: string;
  readonly url: string;
  readonly fontSize: number;
  readonly color: string;
  readonly backgroundColor: string;
  readonly fontFamily: string;
  readonly fontWeight: string;
  readonly fontStyle: string;
  readonly isUnderline: boolean;
  readonly isStrikethrough: boolean;
  readonly isLink: boolean;
  readonly baselineShift: number;
  readonly childCount: number;
  getChild(index: number): InlineNode | null;
}

export interface ListItem extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly childCount: number;
  getChild(index: number): InlineNode | null;
  readonly nestedCount: number;
  getNested(index: number): ContentBlock | null;
}

export interface TableCell extends HybridObject<{
  ios: 'c++';
  android: 'c++';
}> {
  readonly childCount: number;
  getChild(index: number): InlineNode | null;
}

export interface TableRow extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly cellCount: number;
  getCell(index: number): TableCell | null;
}

export interface DefinitionItem extends HybridObject<{
  ios: 'c++';
  android: 'c++';
}> {
  readonly termCount: number;
  getTerm(index: number): InlineNode | null;
  readonly defCount: number;
  getDef(index: number): InlineNode | null;
}

export interface ContentBlock extends HybridObject<{
  ios: 'c++';
  android: 'c++';
}> {
  readonly type: string;
  readonly level: number;
  readonly fontSize: number;
  readonly color: string;
  readonly backgroundColor: string;
  readonly fontFamily: string;
  readonly fontWeight: string;
  readonly fontStyle: string;
  readonly lineHeight: number;
  readonly marginTop: number;
  readonly marginBottom: number;
  readonly paddingLeft: number;
  readonly url: string;
  readonly alt: string;
  readonly caption: string;
  readonly linkUrl: string;
  readonly code: string;
  readonly language: string;
  readonly src: string;
  readonly poster: string;
  readonly title: string;
  readonly html: string;

  readonly childCount: number;
  getChild(index: number): InlineNode | null;
  readonly quoteChildCount: number;
  getQuoteChild(index: number): ContentBlock | null;

  readonly ordered: boolean;
  readonly itemCount: number;
  getItem(index: number): ListItem | null;

  readonly rowCount: number;
  getRow(index: number): TableRow | null;

  readonly defItemCount: number;
  getDefItem(index: number): DefinitionItem | null;
}

export interface ParsedArticle extends HybridObject<{
  ios: 'c++';
  android: 'c++';
}> {
  readonly length: number;
  getBlock(index: number): ContentBlock | null;
}

export interface HtmlLayoutMeasurement {
  height: number;
  astId: string;
}

export interface FastHtmlParser extends HybridObject<{
  ios: 'c++';
  android: 'c++';
}> {
  // Synchronous HTML parse — returns ParsedArticle directly via JSI
  parse(html: string): ParsedArticle | null;

  // Asynchronous HTML parse — dispatches to background thread and returns Promise
  parseAsync(html: string): Promise<ParsedArticle | null>;

  // Normalizes HTML via compiled C++ Lexbor into clean, standard markup with pre-formatted list bullets & quotes
  normalizeHtml(html: string): string;

  // Measures layout, computes styles, buffers the AST, and returns measured height and astId
  calculateHtmlLayout(
    html: string,
    width: number,
    baseStyle?: NativeTextStyle,
    tagsStyles?: Record<string, NativeTextStyle>,
    fontScale?: number
  ): HtmlLayoutMeasurement;

  // Measures layout, computes styles, buffers the AST asynchronously on a background thread and returns Promise<{ height, astId }>
  calculateHtmlLayoutAsync(
    html: string,
    width: number,
    baseStyle?: NativeTextStyle,
    tagsStyles?: Record<string, NativeTextStyle>,
    fontScale?: number
  ): Promise<HtmlLayoutMeasurement>;

  // Generates deterministic AST cache identifier from HTML and styles
  getAstId(
    html: string,
    baseStyle?: NativeTextStyle,
    tagsStyles?: Record<string, NativeTextStyle>
  ): string;

  // Stores a parsed article into C++ memory buffer and returns its astId
  storeAst(article: ParsedArticle): string;

  // Retrieves a parsed article from C++ memory buffer by astId
  getAst(astId: string): ParsedArticle | null;

  // Clears all entries from the C++ AST memory buffer
  clearAstCache(): void;
}
