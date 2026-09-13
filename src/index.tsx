export {
  parseHTML,
  parseHTMLAsync,
  normalizeHTML,
  calculateHTMLHeight,
} from './parser';

export { FastHtmlView, NativeHtmlView } from './renderer/FastHtmlView';
export * from './renderer/types';

export {
  getBlocks,
  getChildren,
  getItems,
  getNestedBlocks,
  getRows,
  getCells,
  getQuoteChildren,
  getDefItems,
} from './wrappers';

export type {
  InlineNode,
  ListItem,
  TableCell,
  TableRow,
  DefinitionItem,
  ContentBlock,
  ParsedArticle,
  FastHtmlParser,
} from './FastHtmlParser.nitro';

export type {
  NativeHtmlViewProps,
  NativeHtmlViewMethods,
  NativeTextStyle,
  NativeHtmlView as NativeHtmlViewType,
} from './NativeHtmlView.nitro';
