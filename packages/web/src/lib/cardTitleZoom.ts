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
