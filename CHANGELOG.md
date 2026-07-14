# Changelog

Versions are what `./scripts/build-release.sh <version>` stamps into the bundle and
what `GET /api/version` reports on the running box. If the two disagree, the update
did not land.

## 1.2.0

### Fixed — a device could not be booked into the store

The frontend carried its own `DeviceStatus` union and it had no `'In Stock'`. The
backend has always had it; it is the state the entire Allocation Queue is built on.
So the type made the one status IT needs most unrepresentable in the UI: the Add
Device form offered only Active / In Repair / Retired / Lost, hardware could not be
booked into the store at all, and every device created through the form was born
"Active" while held by nobody — the orphan state `device_assignments` exists to
prevent.

`'In Stock'` is now the default. Hardware arrives before it is issued.

### Fixed — search could not find a record by its identifier

Both repositories matched with `FULLTEXT ... AGAINST (NATURAL LANGUAGE MODE)` alone.
Fulltext tokenises on word boundaries, so `GR-2026-0001` is not a word and never
matched. `code` was not in the ticket index at all, and `asset_code` — the number
printed on the sticker — was in no index anywhere. Pasting a reference into search
returned nothing.

Fixed with a `LIKE` over the identifier columns, OR-ed inside the fulltext clause and
AND-ed with the requester scope. Deliberately not boolean mode: it reads the hyphen in
every code and serial we have as a NOT operator.

### Added — a navigation rail and a global command bar

Navigation moved from a horizontal tab row (already two levels deep, about to grow a
third) to a vertical rail, per the reference design. Below `lg` it is a drawer — the
tab bars worked at every width and a rail that merely hides on a phone takes the whole
of navigation with it.

`Ctrl/Cmd+K` searches tickets and devices from anywhere and deep-links to the record.
Requesters are never offered the device inventory.

### Changed — elevation, cards and tables are defined once

`.surface` / `.surface-2` / `.surface-3` / `.surface-header` / `.data-table` in
`src/index.css`, from the design spec's own numbers. Previously every card improvised
its own shadow. Tables have zebra rows; chips are 4px, not pills.

### Accessibility

Both overlays claimed `aria-modal="true"` while Tab walked straight out of them and
the page scrolled underneath. There is a focus-trap stack now: only the topmost
overlay owns Tab and Escape, and the scroll lock is released only when the last one
closes. (The lock had also been written to `document.body`, which does nothing here —
`html` is the scrolling box.)

### Tests

The E2E suite could not run at all: it pointed at ports nothing listened on, and its
login helper waited for a string that is also on the login page, so a *failed* sign-in
reported success. 19 of 19 pass now, and `scripts/release-gate.sh` runs them — the
suite rotted precisely because nothing ran it.

`scripts/e2e-stack.sh` brings up a stack of its own (throwaway MySQL, backend from
source) rather than testing against whatever happens to be running.

### Known, not fixed

The API's response envelope is inconsistent: `POST /tickets` answers `{ ticket }`,
devices answer `{ data }`, approvals answer `{ chain }`. It is what made the E2E
suite's assumptions wrong for years without anyone noticing. Standardising it touches
every endpoint and the whole client, so it is not being done in the same release that
made everything green.
