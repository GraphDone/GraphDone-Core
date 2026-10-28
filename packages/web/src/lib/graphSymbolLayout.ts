export const GRAPH_FONT_FAMILY = 'system-ui, sans-serif';
export const ITEM_TITLE_SIZE = 18;
export const ITEM_TITLE_LINE = 24;
export const ITEM_HEADER_HEIGHT = 34;
export const EDGE_LABEL_SIZE = 14;
export const ITEM_WIRE_WIDTH = 3;
export const EDGE_LABEL_HEIGHT = 30;

export type TextMeasure = (
  text: string,
  size: number,
  weight?: number
) => number;

export function fitGraphText(
  text: string,
  width: number,
  size: number,
  measure: TextMeasure,
  maxLines = 3
) {
  let remaining = text.replace(/\s+/g, ' ').trim();
  const lines: string[] = [];
  while (remaining && lines.length < maxLines) {
    if (measure(remaining, size, 600) <= width) {
      lines.push(remaining);
      remaining = '';
      break;
    }
    const last = lines.length === maxLines - 1;
    const chars = Array.from(remaining);
    let low = 0,
      high = chars.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (
        measure(
          chars.slice(0, middle).join('') + (last ? '…' : ''),
          size,
          600
        ) <= width
      )
        low = middle;
      else high = middle - 1;
    }
    if (!low) return { lines: [...lines, '…'], truncated: true };
    let take = low;
    const prefix = chars.slice(0, low).join('');
    const space = prefix.lastIndexOf(' ');
    if (!last && space > 0) take = Array.from(prefix.slice(0, space)).length;
    lines.push(chars.slice(0, take).join('').trimEnd() + (last ? '…' : ''));
    remaining = chars.slice(take).join('').trimStart();
  }
  return {
    lines: lines.length ? lines : ['Untitled'],
    truncated: remaining.length > 0,
  };
}

export function graphItemLayout(
  item: {
    title: string;
    type: string;
    description?: string | null;
    subgraphId?: string | null;
  },
  measure: TextMeasure,
  scale = 1
) {
  const compact = scale < 1;
  const titleScale = compact
    ? Math.max(1, 14 / (ITEM_TITLE_SIZE * Math.max(0.3, scale)))
    : 1;
  const width = Math.min(
    compact ? 240 : 320,
    Math.max(
      210,
      measure(item.title, ITEM_TITLE_SIZE, 600) + 28,
      measure(item.type, 14, 700) + 116
    )
  );
  const title = fitGraphText(
    item.title,
    (width - 28) / titleScale,
    ITEM_TITLE_SIZE,
    measure
  );
  const description = item.description
    ? fitGraphText(item.description, width - 28, 14, measure, 1).lines[0]
    : '';
  const height = compact
    ? title.lines.length * ITEM_TITLE_LINE * titleScale + 24
    : ITEM_HEADER_HEIGHT +
      8 +
      title.lines.length * ITEM_TITLE_LINE +
      (description ? 22 : 0) +
      8 +
      28 +
      (item.subgraphId ? 24 : 0);
  const titleY = compact
    ? (-(title.lines.length - 1) * ITEM_TITLE_LINE) / 2
    : -height / 2 + ITEM_HEADER_HEIGHT + 8 + ITEM_TITLE_LINE / 2;
  return {
    width,
    height,
    compact,
    titleVisible: scale >= 0.3,
    titleScale,
    title: title.lines,
    truncated: title.truncated,
    titleLines: title.lines.length,
    maxCharsPerLine: Math.floor((width - 28) / 9),
    titleY,
    titleCenterY: titleY + ((title.lines.length - 1) * ITEM_TITLE_LINE) / 2,
    description,
    descriptionY: titleY + (title.lines.length - 1) * ITEM_TITLE_LINE + 24,
    footerY: height / 2 - 18 - (item.subgraphId ? 24 : 0),
  };
}

export function edgeLabelDimensions(
  textWidth: number,
  textHeight = EDGE_LABEL_SIZE
) {
  return {
    width: Math.ceil(textWidth) + 40,
    height: Math.max(EDGE_LABEL_HEIGHT, Math.ceil(textHeight) + 10),
  };
}

let context: CanvasRenderingContext2D | null | undefined;
export const measureGraphText: TextMeasure = (text, size, weight = 600) => {
  if (context === undefined)
    context =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d');
  if (!context) return Array.from(text).length * size * 0.65;
  context.font = `${weight} ${size}px ${GRAPH_FONT_FAMILY}`;
  const metrics = context.measureText(text);
  return Math.max(
    metrics.width,
    (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0)
  );
};
