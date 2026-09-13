import type {
  ParsedArticle,
  ContentBlock,
  InlineNode,
  ListItem,
  TableRow,
  TableCell,
  DefinitionItem,
} from './FastHtmlParser.nitro';

/**
 * Returns all top-level content blocks from a ParsedArticle as a standard JavaScript array.
 */
export function getBlocks(
  article: ParsedArticle | null | undefined
): ContentBlock[] {
  if (!article) return [];
  const blocks: ContentBlock[] = [];
  const len = article.length;
  for (let i = 0; i < len; i++) {
    const block = article.getBlock(i);
    if (block) blocks.push(block);
  }
  return blocks;
}

/**
 * Returns all inline child nodes from a block, inline node, or table cell as a standard JavaScript array.
 */
export function getChildren(
  node: ContentBlock | InlineNode | TableCell | ListItem | null | undefined
): InlineNode[] {
  if (!node) return [];
  const children: InlineNode[] = [];
  const len = node.childCount;
  for (let i = 0; i < len; i++) {
    const child = node.getChild(i);
    if (child) children.push(child);
  }
  return children;
}

/**
 * Returns all list items from an ordered or unordered List ContentBlock.
 */
export function getItems(block: ContentBlock | null | undefined): ListItem[] {
  if (!block || block.type !== 'List') return [];
  const items: ListItem[] = [];
  const len = block.itemCount;
  for (let i = 0; i < len; i++) {
    const item = block.getItem(i);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Returns all nested sub-blocks inside a ListItem.
 */
export function getNestedBlocks(
  item: ListItem | null | undefined
): ContentBlock[] {
  if (!item) return [];
  const nested: ContentBlock[] = [];
  const len = item.nestedCount;
  for (let i = 0; i < len; i++) {
    const block = item.getNested(i);
    if (block) nested.push(block);
  }
  return nested;
}

/**
 * Returns all table rows from a Table ContentBlock.
 */
export function getRows(block: ContentBlock | null | undefined): TableRow[] {
  if (!block || block.type !== 'Table') return [];
  const rows: TableRow[] = [];
  const len = block.rowCount;
  for (let i = 0; i < len; i++) {
    const row = block.getRow(i);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Returns all cells from a TableRow.
 */
export function getCells(row: TableRow | null | undefined): TableCell[] {
  if (!row) return [];
  const cells: TableCell[] = [];
  const len = row.cellCount;
  for (let i = 0; i < len; i++) {
    const cell = row.getCell(i);
    if (cell) cells.push(cell);
  }
  return cells;
}

/**
 * Returns all nested ContentBlocks from a Quote ContentBlock.
 */
export function getQuoteChildren(
  block: ContentBlock | null | undefined
): ContentBlock[] {
  if (!block || block.type !== 'Quote') return [];
  const quoteChildren: ContentBlock[] = [];
  const len = block.quoteChildCount;
  for (let i = 0; i < len; i++) {
    const child = block.getQuoteChild(i);
    if (child) quoteChildren.push(child);
  }
  return quoteChildren;
}

/**
 * Returns all definition items from a DefinitionList ContentBlock.
 */
export function getDefItems(
  block: ContentBlock | null | undefined
): DefinitionItem[] {
  if (!block || block.type !== 'DefinitionList') return [];
  const defItems: DefinitionItem[] = [];
  const len = block.defItemCount;
  for (let i = 0; i < len; i++) {
    const item = block.getDefItem(i);
    if (item) defItems.push(item);
  }
  return defItems;
}

/**
 * Returns all term inline nodes from a DefinitionItem.
 */
export function getTerms(item: DefinitionItem | null | undefined): InlineNode[] {
  if (!item) return [];
  const terms: InlineNode[] = [];
  const len = item.termCount;
  for (let i = 0; i < len; i++) {
    const term = item.getTerm(i);
    if (term) terms.push(term);
  }
  return terms;
}

/**
 * Returns all definition inline nodes from a DefinitionItem.
 */
export function getDefs(item: DefinitionItem | null | undefined): InlineNode[] {
  if (!item) return [];
  const defs: InlineNode[] = [];
  const len = item.defCount;
  for (let i = 0; i < len; i++) {
    const def = item.getDef(i);
    if (def) defs.push(def);
  }
  return defs;
}
