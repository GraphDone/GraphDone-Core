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

/** Scripts written without spaces between words: a line may break between any two characters there. */
const UNSPACED_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
/**
 * A path, URL, identifier or number rather than a word: inside its leading and
 * trailing punctuation it has something other than letters, or a capital after
 * a small letter (camelCase).
 */
const isToken = (word: string) => /[^\p{L}'’]|\p{Ll}\p{Lu}/u.test(word.replace(/^\p{P}+|\p{P}+$/gu, ''));
/** Where a token breaks best: after a separator, or before a capital in camelCase. */
const tokenBreak = (chars: string[], at: number) =>
  /[\/\\._:?=&#,;+~|@-]/.test(chars[at - 1]) || (/[\p{Ll}\p{N}]/u.test(chars[at - 1]) && /\p{Lu}/u.test(chars[at]));

/**
 * `text` in at most `maxLines` lines no wider than `width`, broken at spaces.
 * A word wider than a line is never split across lines: it is cut and ends in
 * "…". A path, URL or identifier wider than a line breaks inside instead
 * (after a separator or before a capital where it can) and shows in full while
 * lines are left, as do scripts written without spaces. When more text
 * follows the last line, that line ends in "…".
 */
export function fitGraphText(
  text: string,
  width: number,
  size: number,
  measure: TextMeasure,
  maxLines = 3
) {
  const fits = (line: string) => measure(line, size, 600) <= width;
  /** How many of `chars` fit on a line followed by `suffix`. */
  const longest = (chars: string[], suffix: string) => {
    let low = 0,
      high = chars.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fits(chars.slice(0, middle).join('') + suffix)) low = middle;
      else high = middle - 1;
    }
    return low;
  };
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let next = 0,
    truncated = false;
  while (next < words.length && lines.length < maxLines) {
    const last = lines.length === maxLines - 1;
    let end = next;
    while (end < words.length && fits(words.slice(next, end + 1).join(' ')))
      end++;
    if (end === words.length) {
      lines.push(words.slice(next).join(' '));
      next = end;
      break;
    }
    if (last && end > next) {
      // More follows: as many whole words as fit with the "…".
      let keep = end - next;
      while (keep > 0 && !fits(`${words.slice(next, next + keep).join(' ')}…`))
        keep--;
      if (keep > 0) {
        lines.push(`${words.slice(next, next + keep).join(' ')}…`);
        truncated = true;
        break;
      }
    } else if (end > next) {
      lines.push(words.slice(next, end).join(' '));
      next = end;
      continue;
    }
    // The next word alone is wider than the line (or the last line has room
    // for none of the words and the "…").
    const chars = Array.from(words[next]);
    if (!last && (UNSPACED_SCRIPT.test(words[next]) || isToken(words[next]))) {
      let take = longest(chars, '');
      if (!take) return { lines: [...lines, '…'], truncated: true };
      for (let at = take; at > 0; at--)
        if (tokenBreak(chars, at)) {
          take = at;
          break;
        }
      lines.push(chars.slice(0, take).join(''));
      words[next] = chars.slice(take).join('');
      continue;
    }
    const take = longest(chars, '…');
    if (!take) return { lines: [...lines, '…'], truncated: true };
    lines.push(chars.slice(0, take).join('') + '…');
    truncated = true;
    next++;
    if (last) break;
  }
  return {
    lines: lines.length ? lines : ['Untitled'],
    truncated: truncated || next < words.length,
  };
}

/**
 * Compact cards (below 100%) enlarge their title so it stays readable on
 * screen. Card geometry depends on scale only through this value.
 */
export function itemTitleScale(scale: number) {
  return scale < 1
    ? Math.max(1, 14 / (ITEM_TITLE_SIZE * Math.max(0.3, scale)))
    : 1;
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
  const titleScale = itemTitleScale(scale);
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
