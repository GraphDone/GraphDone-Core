/**
 * Emailed one-time sign-in CODE (type-in alternative to the magic link). Lets a
 * user sign in on a device where they don't want to open their email: read the
 * code on their phone, type it here.
 *
 * Format: 12 characters, shown grouped as XXXX-XXXX-XXXX. Alphabet is uppercase
 * letters + digits with the confusable glyphs removed — no letter O and no digit
 * 0 (so there's no O/0 ambiguity). Users may type lowercase and may omit the
 * dashes; we normalise both before matching. Keep this normalisation byte-for-
 * byte identical to the Worker's apps/api/src/loginCode.ts — the server hashes
 * the normalised code, so a divergence would reject valid codes.
 */
export const LOGIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // A–Z minus O, 1–9 (no 0)
export const LOGIN_CODE_LENGTH = 12;
export const LOGIN_CODE_GROUP = 4;

/** Canonical form: uppercase, separators stripped, only A–Z/0–9 kept, max 12. */
export function normalizeLoginCode(input: string | null | undefined): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LOGIN_CODE_LENGTH);
}

/** Group a canonical code into dashed display form, e.g. ABCD-EFGH-JKMN. */
export function formatLoginCode(canonical: string): string {
  const groups: string[] = [];
  for (let i = 0; i < canonical.length; i += LOGIN_CODE_GROUP) {
    groups.push(canonical.slice(i, i + LOGIN_CODE_GROUP));
  }
  return groups.join('-');
}

/** Format raw user input live as they type (normalise then re-insert dashes). */
export function formatLoginCodeInput(raw: string): string {
  return formatLoginCode(normalizeLoginCode(raw));
}

/** True once a full 12-character code has been entered. */
export function isCompleteLoginCode(raw: string): boolean {
  return normalizeLoginCode(raw).length === LOGIN_CODE_LENGTH;
}
