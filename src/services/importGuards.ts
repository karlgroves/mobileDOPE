/**
 * Input bounds for the only untrusted data this app accepts.
 *
 * `ImportService` reads a JSON file chosen from a document picker. The user picks
 * it, but nothing guarantees this app wrote it, so it is the whole external attack
 * surface. These guards run before the file is parsed and before it is walked.
 *
 * Kept separate from ImportService so they can be exercised directly, and so the
 * limits are readable in one place rather than buried in the picker.
 *
 * See security/tests/import.security.spec.ts and issue #45 item 8.
 */

/**
 * Largest import accepted, in UTF-16 code units.
 *
 * A full backup of a heavy user is a few megabytes; 25 MB is generous by an order
 * of magnitude while still bounding the parse. `JSON.parse` on an unbounded string
 * is a memory-exhaustion primitive.
 */
export const MAX_IMPORT_CHARS = 25_000_000;

/** Deepest structure accepted. Real backups nest 4 levels; 32 is far beyond that. */
export const MAX_IMPORT_DEPTH = 32;

/**
 * Whether file content is too large to parse.
 *
 * @param content - Raw file text, before `JSON.parse`.
 */
export const exceedsMaxSize = (content: string): boolean => content.length > MAX_IMPORT_CHARS;

/**
 * Whether a parsed value nests deeper than the limit.
 *
 * Iterative rather than recursive on purpose: a recursive depth check on a hostile
 * input overflows the stack while measuring it, which is the failure it exists to
 * prevent. `JSON.parse` itself tolerates deep nesting; the walks downstream of it
 * do not.
 *
 * @param value - A parsed JSON value.
 * @param limit - Maximum depth, defaulting to {@link MAX_IMPORT_DEPTH}.
 */
export const exceedsMaxDepth = (value: unknown, limit: number = MAX_IMPORT_DEPTH): boolean => {
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];

  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: unknown; depth: number };
    if (depth > limit) return true;
    if (node === null || typeof node !== 'object') continue;
    for (const child of Object.values(node as Record<string, unknown>)) {
      stack.push({ node: child, depth: depth + 1 });
    }
  }

  return false;
};

/** Human-readable refusal for an oversized file. */
export const oversizedMessage = (): string =>
  `That file is too large to import (limit ${Math.floor(MAX_IMPORT_CHARS / 1_000_000)} MB).`;
