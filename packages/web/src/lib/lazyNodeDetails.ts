export type DetailViewport = { width: number; height: number };
export type DetailCamera = { x: number; y: number; k: number };
export type DetailPosition = { x?: number; y?: number };

/** True when a card is in (or close enough to pan into) the visible viewport. */
export function shouldCreateNodeDetails(
  node: DetailPosition,
  camera: DetailCamera,
  viewport: DetailViewport,
  marginPx = 300,
) {
  const x = (node.x ?? 0) * camera.k + camera.x;
  const y = (node.y ?? 0) * camera.k + camera.y;
  return x >= -marginPx && x <= viewport.width + marginPx &&
    y >= -marginPx && y <= viewport.height + marginPx;
}

export function beginNodeDetails(element: Element) {
  if (element.hasAttribute('data-node-details')) return false;
  element.setAttribute('data-node-details', 'true');
  return true;
}

export function releaseNodeDetails(element: Element, retained: boolean, remove: () => void) {
  if (retained || !element.hasAttribute('data-node-details')) return false;
  remove();
  element.removeAttribute('data-node-details');
  return true;
}
