export async function measureGraphZoom({
  x,
  y,
  scale,
}: {
  x: number;
  y: number;
  scale: number;
}) {
  const start = performance.now();
  const host = document.querySelector('.graph-container')!;
  const svg = host.querySelector(':scope > svg') as SVGSVGElement & {
    __zoom: { k: number };
  };
  const group = host.querySelector('.main-graph-group')!;
  const overview = host.querySelector('.semantic-overview')!;
  const viewport = host.getBoundingClientRect();
  const contains = (a: DOMRect, b: DOMRect) =>
    b.width > 0 &&
    b.height > 0 &&
    b.left >= a.left - 0.5 &&
    b.right <= a.right + 0.5 &&
    b.top >= a.top - 0.5 &&
    b.bottom <= a.bottom + 0.5;
  const visible = (element: Element, stroked = false) => {
    for (
      let current: Element | null = element;
      current;
      current = current.parentElement
    ) {
      const style = getComputedStyle(current);
      if (
        style.display === 'none' ||
        style.visibility !== 'visible' ||
        Number(style.opacity) < 0.99
      )
        return false;
    }
    const box = element.getBoundingClientRect();
    return (
      (stroked
        ? box.width > 0 || box.height > 0
        : box.width > 0 && box.height > 0) &&
      box.right > viewport.left &&
      box.left < viewport.right &&
      box.bottom > viewport.top &&
      box.top < viewport.bottom
    );
  };
  const readable = (element: SVGGraphicsElement) => {
    const matrix = element.getScreenCTM();
    return (
      visible(element) &&
      matrix &&
      parseFloat(getComputedStyle(element).fontSize) *
        Math.hypot(matrix.a, matrix.b) >=
        13.9
    );
  };
  const ready = () => {
    const local = host.querySelector(
      '.local-item-neighborhood[data-active="true"]'
    );
    if (
      Math.abs(svg.__zoom.k - scale) >= 0.00001 ||
      group.getAttribute('data-presentation-scale') !== String(scale) ||
      (overview?.getAttribute('data-active') === 'true') !== scale < 1 ||
      (host.getAttribute('data-overview') === 'true') !== (scale < 1 || !!local)
    )
      return false;
    if (scale < 1) {
      const summaries = Array.from(
        overview.querySelectorAll('[data-lod-group]')
      );
      return (
        summaries.length > 0 &&
        summaries.every(
          card =>
            visible(card) && contains(viewport, card.getBoundingClientRect())
        )
      );
    }
    if (local) {
      const cards = Array.from(
        local.querySelectorAll('[data-local-item-card]')
      );
      const originals = local.querySelectorAll('[data-original-item]');
      const wires = Array.from(local.querySelectorAll('[data-lod-bundle]'));
      return (
        originals.length >= 2 &&
        cards.length <= 7 &&
        cards.every(card => {
          const title = card.querySelector('[data-local-open]')!;
          return (
            visible(card) &&
            contains(viewport, card.getBoundingClientRect()) &&
            parseFloat(getComputedStyle(title).fontSize) >= 18 &&
            Number(getComputedStyle(title).fontWeight) >= 600 &&
            contains(
              card.getBoundingClientRect(),
              title.getBoundingClientRect()
            )
          );
        }) &&
        wires.length > 0 &&
        wires.every(
          wire =>
            visible(wire, true) &&
            getComputedStyle(wire).stroke !== 'none' &&
            Number(getComputedStyle(wire).strokeOpacity) > 0
        )
      );
    }
    const nodes = Array.from(
      host.querySelectorAll<SVGGraphicsElement>('.node')
    ).filter(node => node.style.display !== 'none' && visible(node));
    if (!nodes.length || nodes.length >= 100) return false;
    const cardsReady = nodes.some(node => {
      const box = node.querySelector('.node-bg')!.getBoundingClientRect();
      const titles = Array.from(
        node.querySelectorAll<SVGGraphicsElement>('.node-title-text')
      );
      return (
        node.getAttribute('data-detail') === 'full' &&
        contains(viewport, box) &&
        titles.length > 0 &&
        titles.every(
          title =>
            readable(title) && contains(box, title.getBoundingClientRect())
        )
      );
    });
    const labels = Array.from(
      host.querySelectorAll<SVGGraphicsElement>('.edge-label-group')
    ).filter(label => label.style.display !== 'none' && visible(label));
    return (
      cardsReady &&
      labels.length > 0 &&
      labels.length <= 32 &&
      labels.every(label => {
        const box = label.querySelector('rect')!.getBoundingClientRect();
        const text = label.querySelector<SVGGraphicsElement>('.edge-label')!;
        return (
          contains(viewport, box) &&
          readable(text) &&
          contains(box, text.getBoundingClientRect())
        );
      })
    );
  };
  (window as any).miniMapZoom(x, y, scale);
  return await new Promise<number>((resolve, reject) => {
    let settledFrames = 0;
    const check = () => {
      if (performance.now() - start > 15000) {
        reject(
          new Error('Zoom did not paint readable content within 15 seconds')
        );
        return;
      }
      try {
        settledFrames = ready() ? settledFrames + 1 : 0;
      } catch (error) {
        reject(error);
        return;
      }
      if (settledFrames >= 2) resolve(performance.now() - start);
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}
