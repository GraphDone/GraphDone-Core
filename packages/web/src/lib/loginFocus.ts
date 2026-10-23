/**
 * Decide which field should receive focus when the passwordless (magic-link)
 * sign-in form becomes active. Pure so it can be unit-tested without the DOM.
 *
 * Rule (per UX): when entering passwordless mode, focus the EMAIL field first if
 * no email has been entered yet; if an email is already present, skip ahead to
 * the CAPTCHA. While the form is inactive or the link has already been sent,
 * nothing should grab focus.
 */
export type LoginFocusTarget = 'email' | 'captcha' | 'none';

export function magicLinkFocusTarget(opts: {
  active: boolean;
  magicLinkSent: boolean;
  hasEmail: boolean;
}): LoginFocusTarget {
  if (!opts.active || opts.magicLinkSent) return 'none';
  return opts.hasEmail ? 'captcha' : 'email';
}

/** Whether a raw email field value counts as "an email has been entered". */
export function hasEnteredEmail(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}
