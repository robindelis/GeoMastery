# Instructions & Guidelines for AI Agents (AGENTS.md)

Welcome to the **GeoMastery** codebase. All AI coding assistants working in this repository must adhere to the rules, patterns, and workflows described below.

---

## 🚨 MANDATORY WORKFLOW RULES

### 1. Continuous GitHub Push Rule

**Whenever you make substantial changes, fix bugs, add features, or complete a user request, you MUST commit and push your changes to GitHub:**

```bash
git add .
git commit -m "<concise descriptive commit message>"
git push origin main
```

* Never leave completed tasks unpushed on the local machine.
* Remote is configured as `origin` pointing to `git@github.com:robindelis/GeoMastery.git`.
* Whenever starting a conversation, git pull the latest changes from github before starting any modification.

### 2. Spaced Repetition (SRS) Engine Integrity

* **Cognitive Scaffolding**:
  * Level 0: 4-choice recognition (or unassisted map click). Graduates to Level 1 on first correct answer.
  * Level 1: Typing-first active recall (capitals) or unassisted map click (locations). **Requires 2 consecutive correct answers to master**.
  * Any failure resets consecutive recall correct to `0` and demotes Level 2 cards back to Level 1.
* **Practice Drill Mode**:
  * Practice Drill mode MUST NOT mutate SRS item state (`stage`, `intervalDays`, `reps`, `nextDueAt`, etc.) in persistent storage.
  * Always check `isPracticeMode` / `isPracticeModeRef` before persisting card schedule updates.

### 3. Map Performance (Zero-Lag Standard)

* The map is rendered on two stacked `<canvas>` layers in `VectorMap2D.tsx` (static base layer + dynamic overlay for hover, selection, pulses, labels):
  * Geometry is converted to `Path2D` (full + decimated LOD) once per projection via `useMemo`. NEVER rebuild paths or resolve fills/strokes inside the frame loop; styles are precomputed on prop change.
  * Pan/zoom must never trigger React renders. Draws are batched in a single `requestAnimationFrame` frame loop and cull items outside the viewport by bounding box.
  * While the camera is moving, use the LOD paths (below zoom 3), skip water strokes and suppress hover hit-testing.
  * Parent callbacks must go through a stable proxy ref (e.g. `onSelectCountryRef`) to prevent stale closures.
  * Strokes use hairline widths (`0.8px`) divided by zoom `k` so they stay constant on screen.
  * Do NOT reintroduce SVG per-country elements or CSS `filter`/`drop-shadow` on the map.

### 5. Absolute User Progress & Data Preservation Rule

**User learning progress (SRS items, review counts, streaks, continent mastery, settings) is sacred and must NEVER be wiped, reset, or bypassed:**

* **Dual-Layer Persistence**:
  * User data is mirrored to disk at `app.getPath('userData')/geomastery_data.json` via atomic file writes (`load-storage-data` / `save-storage-data`).
  * `localStorage` is used as a fast in-memory mirror and automatically rehydrated from disk on boot.
* **Single-Instance Enforcement**:
  * `app.requestSingleInstanceLock()` must ALWAYS be maintained in `electron/main.ts` so multiple Electron instances never lock Chromium LevelDB or start ghost sessions.
* **Migration & Schema Safety**:
  * Any schema changes or new attribute additions must preserve existing `(countryId, attributeId)` keys and stage ratings.
  * Never run destructive scripts or clear `localStorage` / `geomastery_data.json`.
* **Automatic Safeguard Backups**:
  * Keep verified backup copies (`user_progress_backup.json`) in user data so progress can be recovered even in catastrophic OS or partition events.

---

## 🛠️ Build & Verification Checklist

Before finishing any task, run the full verification pipeline:

1. **Unit Tests**:

   ```bash
   npm test
   ```

   Must pass with 0 failures (`src/core/srsEngine.test.ts`, `src/core/fuzzyMatch.test.ts`).

2. **Web & Electron Compilation**:

   ```bash
   npm run build && npm run build:electron
   ```

   Ensure zero TypeScript or bundling errors.

3. **Git Commit & Push**:

   ```bash
   git add .
   git commit -m "..."
   git push origin main
   ```
