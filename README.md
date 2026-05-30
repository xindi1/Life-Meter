# Life Meter v1.1.1

Fresh-start Life Meter app built around three layers:

1. **Meters** — fast, atomic capture for Communication, Movement, Nutrition, Sleep, Supplements, Sex, Learning, Work, Dog Care, Mood/Energy, and Sunlight.
2. **Episodes** — special activities and life landmarks.
3. **Narrative** — interpretation, therapy notes, observations, and meaning-making.

## Export / Import

Export creates a versioned JSON backup. Import merges records by `id` and avoids duplicates.

## Deploy

Upload all files to a GitHub Pages repository root or subfolder. Keep the `icons` folder with the app.


## v1.1.1 updates

- Forces all newly-created times to 24-hour HH:MM format.
- Displays older 12-hour saved timestamps in 24-hour format where possible.
- Adds visible dark/light theme toggle with localStorage persistence.
- Improves mobile date/time wrapping inside entry cards.
- Adds last export timestamp and visible version badge.
- Bumps service worker cache to reduce stale-file issues.


## v1.1.2

- Refined mobile date input sizing so the date stays compact inside the card.
- Improved light-mode button contrast/readability.
- Bumped cache/version for fresh GitHub Pages deployment.
