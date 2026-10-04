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

### 2. Spaced Repetition (SRS) Engine Integrity
* **Cognitive Scaffolding**:
  * Level 0: 4-choice recognition (or unassisted map click). Graduates to Level 1 on first correct answer.
  * Level 1: Typing-first active recall (capitals) or unassisted map click (locations). **Requires 2 consecutive correct answers to master**.
  * Any failure resets consecutive recall correct to `0` and demotes Level 2 cards back to Level 1.
* **Practice Drill Mode**:
  * Practice Drill mode MUST NOT mutate SRS item state (`stage`, `intervalDays`, `reps`, `nextDueAt`, etc.) in persistent storage.
  * Always check `isPracticeMode` / `isPracticeModeRef` before persisting card schedule updates.

### 3. Map Performance (Zero-Lag Standard)
* Vector map rendering MUST maintain sub-millisecond interaction speeds:
  * Do NOT recalculate `pathGenerator(feat)` inside the render loop for 241 countries. Use `useMemo`.
  * `<CountryPolygon>` MUST remain memoized with `React.memo`.
  * Any parent event callbacks passed to `<CountryPolygon>` must be backed by a stable proxy ref (e.g. `onSelectCountryRef`) to prevent stale closures while preserving zero-re-render click speed.
  * SVG paths must use `vectorEffect="non-scaling-stroke"` with thin hairline strokes (`0.6px`) so zooming into Western Europe never obscures microstates.

### 4. Mathematical & HTML Formatting
* Never output raw unrendered LaTeX syntax (`$...$`, `\frac`) inside HTML artifacts, generative UI widgets, or web views.
* Use semantic HTML and Unicode symbols (`·`, `×`, `√`, `∑`, `<sup>`, `<sub>`).

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
