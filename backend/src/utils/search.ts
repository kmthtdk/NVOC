// Search term handling, shared by the ticket and device repositories.
//
// Both tables carry a FULLTEXT index, and fulltext alone cannot find a record by
// its identifier: `ft_t_search` covers (title, description, requester_name) — not
// `code` — and the device index covers (code, model, serial_number) but not the
// `asset_code` we added later. Worse, NATURAL LANGUAGE MODE tokenises on word
// boundaries, so "GR-2026-0001" never matches even where `code` *is* indexed.
//
// The global command bar exists to be handed an identifier, so the repositories
// OR a LIKE over the identifier columns alongside the fulltext match. Deliberately
// NOT boolean mode with a trailing wildcard: boolean mode reads the hyphen in
// every code and serial we have as a NOT operator, which would quietly turn
// "SN-123" into "SN and not 123".

/**
 * The LIKE escape character, to be BOUND as a parameter (`LIKE ? ESCAPE ?`).
 *
 * Writing it into the SQL text as `ESCAPE '\\'` looked equivalent and was not.
 * That literal only collapses to a single backslash because MySQL's string parser
 * treats backslash as an escape — the very behaviour `NO_BACKSLASH_ESCAPES`
 * turns off. Under that sql_mode the literal stays two characters, and
 * `LIKE ... ESCAPE` demands exactly one, so the query would fail outright. Bound
 * as a parameter, the driver escapes the value the way the server expects and
 * the statement means the same thing under either mode.
 */
export const LIKE_ESCAPE = '\\';

/**
 * Wrap a user term for a LIKE comparison, neutralising the wildcards.
 *
 * `%` and `_` are LIKE metacharacters. A code never contains them, but a user who
 * types `%` should match nothing rather than every row in the table, and `_` is
 * the quiet one — unescaped, "SN_123" matches "SN-123".
 */
export function likeContains(term: string): string {
  const escaped = term.trim().replace(/[\\%_]/g, (ch) => `${LIKE_ESCAPE}${ch}`);
  return `%${escaped}%`;
}
