import { NitroModules } from 'react-native-nitro-modules';
import type {
  FastHtmlParser,
  ParsedArticle,
  HtmlLayoutMeasurement,
} from './FastHtmlParser.nitro';
import type { NativeTextStyle } from './NativeHtmlView.nitro';

export const FastHtmlParserInstance =
  NitroModules.createHybridObject<FastHtmlParser>('FastHtmlParser');

export function parseHTML(html: string): ParsedArticle | null {
  return FastHtmlParserInstance.parse(html);
}

export async function parseHTMLAsync(
  html: string
): Promise<ParsedArticle | null> {
  return FastHtmlParserInstance.parseAsync(html);
}

export function normalizeHTML(html: string): string {
  return FastHtmlParserInstance.normalizeHtml(html);
}

export function calculateHTMLLayout(
  html: string,
  width: number,
  baseStyle?: NativeTextStyle,
  tagsStyles?: Record<string, NativeTextStyle>,
  fontScale: number = 1.0
): HtmlLayoutMeasurement {
  return FastHtmlParserInstance.calculateHtmlLayout(
    html,
    width,
    baseStyle,
    tagsStyles,
    fontScale
  );
}

export async function calculateHTMLLayoutAsync(
  html: string,
  width: number,
  baseStyle?: NativeTextStyle,
  tagsStyles?: Record<string, NativeTextStyle>,
  fontScale: number = 1.0
): Promise<HtmlLayoutMeasurement> {
  return FastHtmlParserInstance.calculateHtmlLayoutAsync(
    html,
    width,
    baseStyle,
    tagsStyles,
    fontScale
  );
}

export function getAstId(
  html: string,
  baseStyle?: NativeTextStyle,
  tagsStyles?: Record<string, NativeTextStyle>
): string {
  return FastHtmlParserInstance.getAstId(html, baseStyle, tagsStyles);
}

export function storeAst(article: ParsedArticle): string {
  return FastHtmlParserInstance.storeAst(article);
}

export function getAst(astId: string): ParsedArticle | null {
  return FastHtmlParserInstance.getAst(astId);
}

export function clearAstCache(): void {
  FastHtmlParserInstance.clearAstCache();
}
