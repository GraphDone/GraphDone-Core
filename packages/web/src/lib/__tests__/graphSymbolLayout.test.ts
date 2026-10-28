import { describe, expect, it } from 'vitest';
import {
  fitGraphText,
  graphItemLayout,
  edgeLabelDimensions,
  ITEM_TITLE_SIZE,
  ITEM_TITLE_LINE,
  type TextMeasure,
} from '../graphSymbolLayout';

const measure: TextMeasure = (text, size) =>
  Array.from(text).reduce(
    (sum, char) =>
      sum + (char === 'W' ? 0.95 : char === 'i' ? 0.25 : 0.6) * size,
    0
  );

describe('graph symbol content geometry', () => {
  it('fits unequal-width words and unbroken identifiers without losing an unmarked suffix', () => {
    for (const value of [
      'WWW iii WWW iii WWW',
      'PaymentGatewayRetryReconciliationHandler'.repeat(3),
      '付款网关验证重试与结算协调服务'.repeat(5),
    ]) {
      const result = fitGraphText(value, 110, ITEM_TITLE_SIZE, measure);
      expect(result.lines.length).toBeLessThanOrEqual(3);
      for (const line of result.lines)
        expect(measure(line, ITEM_TITLE_SIZE)).toBeLessThanOrEqual(110);
      if (result.truncated)
        expect(result.lines[result.lines.length - 1]).toMatch(/…$/);
    }
  });

  it('makes short cards compact and reserves title, description and metadata rows', () => {
    const short = graphItemLayout({ title: 'Review', type: 'TASK' }, measure);
    const long = graphItemLayout(
      {
        title: 'Review the gateway settlement reconciliation and retry policy',
        type: 'FEATURE',
        description:
          'A complete readable summary with more detail available in the inspector.',
      },
      measure
    );
    expect(short.height).toBeLessThan(100);
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.width).toBeLessThanOrEqual(300);
    expect(long.titleY - ITEM_TITLE_SIZE / 2).toBeGreaterThan(
      -long.height / 2 + 30
    );
    expect(long.descriptionY - 6).toBeGreaterThan(
      long.titleY +
        (long.title.length - 1) * ITEM_TITLE_LINE +
        ITEM_TITLE_SIZE / 2
    );
    expect(long.footerY - 6).toBeGreaterThan(long.descriptionY + 6);
    for (const line of long.title)
      expect(measure(line, ITEM_TITLE_SIZE)).toBeLessThanOrEqual(
        long.width - 28
      );
  });

  it('reserves a separate row for subgraph navigation', () => {
    const plain = graphItemLayout({ title: 'API', type: 'EPIC' }, measure);
    const sheet = graphItemLayout(
      { title: 'API', type: 'EPIC', subgraphId: 'child' },
      measure
    );
    expect(sheet.height - plain.height).toBe(24);
    expect(sheet.height / 2 - sheet.footerY).toBe(40);
  });

  it('reserves compact title width and height at readable zoom sizes', () => {
    for (const scale of [0.3, 0.45, 0.6, 0.9]) {
      const layout = graphItemLayout({ title: 'WWW PaymentGatewayRetryReconciliationHandler WWW', type: 'FEATURE' }, measure, scale);
      expect(layout.compact).toBe(true);
      expect(ITEM_TITLE_SIZE * layout.titleScale * scale).toBeGreaterThanOrEqual(12);
      expect(layout.titleCenterY).toBe(0);
      for (const line of layout.title)
        expect(measure(line, ITEM_TITLE_SIZE) * layout.titleScale).toBeLessThanOrEqual(layout.width - 28);
      expect(layout.title.length * ITEM_TITLE_LINE * layout.titleScale).toBeLessThan(layout.height);
    }
  });

  it('rounds label ink upward and preserves horizontal and vertical padding', () => {
    expect(edgeLabelDimensions(94.9, 18.2)).toEqual({ width: 135, height: 29 });
    expect(edgeLabelDimensions(0, 0)).toEqual({ width: 40, height: 26 });
  });
});
