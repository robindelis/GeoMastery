# GeoMastery 🌍 — World Geography & Capitals Mastery Trainer

A modern, distraction-free desktop geography training application built with **Electron**, **React 19**, **TypeScript**, and **Tailwind CSS**. Designed for systematic mastery of world capitals and country locations, featuring progressive cognitive scaffolding, an extensible attribute architecture, a zero-lag dual-mode map engine (2D Vector Map + 3D Interactive Globe), and an FSRS-inspired spaced repetition memory engine.

---

## 🌟 Key Features

### 1. Progressive Cognitive Scaffolding
- **Level 0 (Acquisition / Recognition)**:
  - First exposure uses **4-choice multiple choice** with authentic regional distractors from the same continent or unassisted map clicks.
  - Keyboard shortcuts `1`, `2`, `3`, `4` for instant responses.
  - 1 correct answer graduates the country to **Level 1 (Learning / Active Recall)**.
- **Level 1 (Active Recall)**:
  - No propositions are shown; the user must actively retrieve the answer from memory (typing-first for capitals, map-clicking for locations).
  - Smart fuzzy matching tolerates diacritic accents (e.g., `Bogotá` → `bogota`, `São Tomé` → `sao tome`) and 1–2 character typo tolerances.
  - **Strict Mastery Rule**: Must be answered correctly **2 times in a row without multiple choice** to graduate to Mastered. Any mistake resets the consecutive counter to 0.
- **Level 2 (Mastered)**:
  - Scheduled across exponentially increasing intervals (> 21 days) with automatic recurrence scheduling.

### 2. Dual-Mode Map Engine (Zero-Lag 60+ FPS)
- **2D Flat Vector Map**:
  - D3-geo Natural Earth projection rendering 100% offline Natural Earth vector boundaries.
  - Precomputed SVG path geometry and memoized polygon components for sub-millisecond, zero-lag country selection and hover.
  - Clean hairline non-scaling borders (`vectorEffect="non-scaling-stroke"`) that remain crisp when zooming in on microstates (Andorra, Monaco, Luxembourg, etc.).
  - Smooth pan-and-zoom controls with smart pre-answer camera freeze (no accidental hints before guessing).
- **3D Interactive Globe**:
  - Orthographic 3D canvas sphere with realistic atmospheric glow and graticule grid.
  - Drag-to-rotate with inertia physics.
  - Auto-spin camera that smoothly glides to center on target coordinates.
  - 1-click toggle between 2D Map and 3D Globe at any time during practice or exploration.

### 3. Unlimited Practice Drill Mode
- When all scheduled reviews for a continent are caught up, jump into a **Practice Drill** at any time.
- Randomizes 15 questions across the selected region.
- Full interactive gameplay, streaks, audio feedback, and score tracking with **zero alterations to your stored spaced repetition schedule**.

### 4. Interactive Session Completion Hub
- Atmospheric celebration with multi-stage confetti and dynamic rank crests.
- Detailed 4-metric matrix: Accuracy, Average Response Speed, Recall Progression, and Cartographer XP.
- **Question Breakdown Shelf**: Filter by *All*, *Correct*, or *Need Review*, with side-by-side comparisons of your answers vs. correct targets.
- **Instant "Retry Missed" Action**: One-click launch to drill only the countries you missed in the session.

### 5. Modular Extensible Knowledge Schema
- Complete pre-bundled dataset of **196 sovereign nations and territories**.
- Core training focuses on **Capitals** and **Map Locations**.
- Modular attribute registry (`src/core/attributes.ts`):
  - Pre-populated starter data for **Political Regimes**, **Current Heads of State / Leaders**, **National Dishes**, and **Currencies**.
  - New attributes can be added with zero database schema refactoring or migrations.
  - Independent Spaced Repetition (SRS) memory tracking per `(country_id, attribute_id)`.

### 6. Game & Learning Modes
- **Daily Spaced Repetition Review**: Smart session pulling overdue review cards and introducing new cards from any selected continent or worldwide.
- **Continent-Specific Focus**: Dedicated drill sessions for **Europe**, **Asia**, **Africa**, **Americas**, or **Oceania**.
- **Interactive Explorer Atlas**: Free exploration with search typeahead, slide-over country dossiers, and quick-drill actions.
- **Arcade Time-Attack Blitz**: 60-second capital speedrun with combo multipliers (x1 to x4) and local high-score leaderboards.
- **World Mastery Heatmap**: Global choropleth map color-coded by retention level.

### 7. Production Polish & Offline Execution
- **Procedural Web Audio FX**: Pure Web Audio API chimes, error sounds, level-up fanfares, and clicks without external audio asset dependencies.
- **Local Persistence & Portability**: Automatically saves all review traces, streaks, and settings with 1-click JSON backup export and restore.
- **Modern Slate Theme**: Contemporary dark aesthetic featuring atmospheric cartographic geometry.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
```bash
git clone git@github.com:robindelis/GeoMastery.git
cd GeoMastery
npm install
```

### Running the App
- **Web Development Mode** (runs in your browser at `http://localhost:5173`):
  ```bash
  npm run dev
  ```

- **Desktop Application** (native Electron desktop app):
  ```bash
  npm run electron:dev
  ```

- **Running Tests**:
  ```bash
  npm test
  ```

- **Building for Production**:
  ```bash
  npm run build
  npm run build:electron
  ```

---

## 📁 Project Architecture

```text
├── electron/
│   ├── main.ts              # Electron native window & lifecycle management
│   └── preload.ts           # Secure IPC bridge for desktop APIs
├── src/
│   ├── assets/
│   │   ├── data/countries.ts # 196 sovereign countries dataset
│   │   └── geo/              # 100% offline TopoJSON world atlas
│   ├── core/
│   │   ├── types.ts         # TypeScript definitions
│   │   ├── attributes.ts    # Extensible Attribute Registry (Capitals, Locations, Leaders, Cuisine)
│   │   ├── srsEngine.ts     # Cognitive Scaffolding & Spaced Repetition Engine
│   │   ├── fuzzyMatch.ts    # Diacritic-tolerant Levenshtein fuzzy matcher
│   │   ├── soundFx.ts       # Procedural Web Audio synthesizer
│   │   └── storage.ts       # Persistence & JSON backup service
│   ├── components/
│   │   ├── common/          # AmbientBackground and shared UI
│   │   ├── map/             # VectorMap2D, Globe3D, MapContainer
│   │   ├── training/        # TrainingSession, SessionCompletedView, prompts
│   │   ├── atlas/           # ExplorerAtlas & Country Dossier Drawer
│   │   ├── arcade/          # TimeAttack 60-second speedrun
│   │   └── dashboard/       # Dashboard & Mastery Heatmap
│   ├── App.tsx              # Root coordinator & view router
│   ├── main.tsx             # React entrypoint
│   └── index.css            # Slate cartographic theme & styling
```

---

## 📄 License
MIT License. Created by [Robin Delis](https://github.com/robindelis).
