import { NitroModules } from 'react-native-nitro-modules';
import type { FastHtmlParser, ParsedArticle } from './FastHtmlParser.nitro';

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

export function calculateHTMLHeight(
  html: string,
  width: number,
  baseFontSize: number = 0,
  baseLineHeight: number = 0,
  fontScale: number = 1.0
): number {
  return FastHtmlParserInstance.calculateHtmlHeight(
    html,
    width,
    baseFontSize,
    baseLineHeight,
    fontScale
  );
}
