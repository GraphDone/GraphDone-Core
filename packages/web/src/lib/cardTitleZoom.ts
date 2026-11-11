/**
 * The zoom below which card titles stop being readable. Relationship labels
 * follow the same cutoff: they show while card titles show, so zooming out
 * never leaves labels floating over unreadable cards (#277).
 *
 * Shared by the zoom-out levels (graphZoomContext) and the label layout
 * (labelClearance); change it in one place.
 */
export const CARD_TITLES_HIDE_BELOW = 0.34;
/** Titles come back above this zoom (a little higher, so they never flicker). */
export const CARD_TITLES_SHOW_ABOVE = 0.38;
/**
 * The smallest zoom a phone frames a small graph at (Organize keeps its own,
 * higher floor there): a compact card's title, kept at 14 px on screen, still
 * fits its card whole. Below about 0.45 a narrow card cuts words like
 * "coordinator" short ("coordinat…").
 */
export const PHONE_READABLE_SCALE = 0.5;
