# Changelog

## v1.0
- Initial PWA
- Google Sheets integration
## v1.1
- Active 5v5 / 3v3 mode highlighting
## v1.2
- Tier colour coding
## v1.3
- Sorting
## v1.4
- Reset round
- Search bar
- More colour coding
## v1.5
- Roster import foundations
## v1.6
- Manual roster
## v1.65
- Banner tracking (manual score, opponent score, remaining, projected final)
## v1.7
- Slimmed header (subtitle removed, single-line)
- Available counters filter — "Show available only" toggle above results
- Unavailable counters collapse to a tappable count line when filter is on
- Toggle state persists across sessions (localStorage)
- Toggle disabled with hint when roster is empty
- Empty-result state when no available counters exist for selected team
## v1.8
- Tri-state counter status: Available / Used / Not owned
- Three-segment filter: [All] [Owned] [Available]
- Counters sorted by status group (Available → Used → Not owned), then tier and banner score
- Ownership vocabulary: "Owned / Not owned" replaces "Available / Unavailable"
- CURRENT ROUND card: Reset Round moved inline
## v1.9
- roster persistence hardening (versioned storage schema, single save/load path, migration from old format)
- "last saved" indicator on roster screen
- export roster to clipboard
- import roster (validate-before-apply, replaces current roster, reports skipped unrecognised characters)
- undo import (restores previous roster within the session)
- best-effort persistent-storage request to reduce eviction
- collapsible "manage roster data" panel
