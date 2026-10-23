# Remembrance Progression Timeline & Bidirectional Capital-to-Country Training

This update optimizes the viewport-locked main dashboard by compacting the Regional Folios to introduce an interactive **4-Stage Remembrance Progression Timeline** (filterable across Capitals, Locations, Map → Name, and Flags) and upgrades **Capitals** training into a bidirectional experience that tests both **Country → Capital** and **Capital → Country** using standard FSRS scaffolding.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All four product and design decisions from our clarification step have been locked in below. Review the visual layout and interaction model before we proceed to implementation.

- **Confirmed Decision 1 — Timeline Visualization**: Cumulative 4-stage stacked area chart over time (`Mastered`, `Recall`, `Learning`, `Unseen`) with an interactive attribute filter (`All`, `Capitals`, `Locations`, `Map → Name`, `Flags`) and hover date scrubber.
- **Confirmed Decision 2 — Main Page Space Optimization**: Compact the 6 Regional Folios in the right column into a zero-dead-space 2×3 regional grid so the new **Remembrance Progression Timeline** fits cleanly in the right column without introducing page scroll.
- **Confirmed Decision 3 — Bidirectional Capitals Integration**: Combine **Capital → Country** inside the existing **Capitals** focus toggle (`Country ↔ Capital`), preserving 100% of existing `${countryId}:capital` FSRS progress and stability records.
- **Confirmed Decision 4 — Answering Mechanics & Scaffolding**: Use standard cognitive scaffolding for Capital → Country questions: 4-option regional multiple-choice recognition at Stage 0 (`L0`), graduating to direct typing active recall (with full country alias and fuzzy matching support) at Stage 1+ (`L1` / `L2`).

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Space-Optimized Right Column & Remembrance Timeline**: Eliminates the empty vertical dead space inside the 6 Regional Folio cards by organizing them into a high-density 2×3 Regional Folio matrix at the top of the right column, dedicating the reclaimed space to an interactive **Remembrance Horizon Timeline** that visualizes how cards move through the 4 memory stages (`Unseen` → `Learning` → `Recall` → `Mastered`) over time.
  2. **Bidirectional Capitals (`Country ↔ Capital` & `Capital → Country`)**: Expands the Capitals training mode so learners are quizzed both ways—given a country, name its capital; and given a capital city, identify its sovereign nation—preventing one-way associative blind spots.
- **Target Audience / Persona**: Geography learners using spaced repetition who want clear longitudinal visibility into their memory consolidation velocity across attributes and deeper bidirectional mastery of world capitals.
- **Key Value**: Transforms wasted vertical card padding on the dashboard into actionable longitudinal progress telemetry while doubling associative retrieval strength for world capitals without fragmenting or resetting existing SRS card progress.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Inspecting the Remembrance Timeline on the Main Page**:
     - In the right column, the user sees the **Remembrance Horizon Timeline** alongside the compacted **Regional Folios (6)**.
     - Clicking the attribute filter tabs (`All`, `🏛️ Cap`, `🧭 Loc`, `🗺️ Map`, `🏳️ Flag`) dynamically recomputes the 4-stage stacked area curves and stage delta metrics (`+N Mastered`, `+N Recall` over the selected window).
     - Hovering across the SVG timeline scrubs through dates, displaying a tabular tooltip with exact counts and percentages for **Mastered**, **Recall**, **Learning**, and **Unseen** on that day.
     - Clicking timeframe pills (`7D`, `14D`, `30D`, `All`) adjusts the horizontal time horizon.
  2. **Answering Capital → Country Questions in Training**:
     - When **Capitals** (`🏛️ Capitals · Country ↔ Capital`) is active in the study focus deck, the training stream seamlessly weaves in reverse **Capital → Country** prompts (*"Which country has {Capital} as its capital?"*).
     - **Anti-Spoiler Prompt Masking**: Before the user submits an answer on a **Capital → Country** question, the prompt card masks the country flag and name—displaying the Capital City emblem (`🏛️`), the continent/subregion badge, and a one-click audio pronunciation button for the capital city.
     - **Stage 0 (Recognition)**: Presents 4 regionally plausible country names as selectable options (`1–4` keyboard shortcuts).
     - **Stage 1+ (Active Recall)**: Presents the typing input field (`Type country name...`) with progressive first-letter hints and fuzzy/alias validation (accepting common names, official names, and standard abbreviations like `UK`, `USA`, `UAE`, `DRC`).
     - **Post-Submission Reveal**: Immediately reveals the country's flag, official name, and highlights/zooms to the country on the interactive 2D map or 3D globe.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **L'Atelier Cartographique** — rich naval slate surfaces (`#0F2536`, `#143146`, `#0C1D2B`), warm vellum typography (`#F6EFE2`), antique brass accents (`#E9C46A`), and semantic FSRS horizon pigments.
  - *Color Palette & Stage Encoding*:
    - **Mastered (`S ≥ 6d`)**: Emerald (`#10B981`)
    - **Recall (`S 2–6d`)**: Sunlit Brass (`#E9C46A`)
    - **Learning (`S < 2.2d`)**: Terracotta Amber (`#F4A261`)
    - **Unseen (`Fresh`)**: Aegean Sky (`#38BDF8`)
  - *Typography & Hierarchy*: Display headers in `Fraunces` (`--font-fraunces`), crisp UI labels in `Plus Jakarta Sans`, and all timeline axes, percentages, and stage counts in monospace `tabular-nums` so numbers never jitter during hover scrubbing.
  - *Viewport Budget & Spatial Math*: Maintains strict zero-vertical-scroll (`h-full overflow-hidden`) across the 12-column Bento grid (`5 cols` Left Launch & Horizon Deck, `3–4 cols` Center Globe & Dossier, `3–4 cols` Right Regional Matrix + Progression Timeline).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Historical Reconstruction from Real SRS History**:
  - *Chosen Approach*: Reconstruct daily 4-stage card distributions directly from each `SRSItem`'s persisted `history[]` timestamps and `lastReviewedAt` records, anchored to current live counts at `Today`.
  - *Why*: Works immediately with the user's existing 1,686+ reviews and 236 charted entities without requiring a separate database migration or starting the chart empty at day zero.
  - *Alternatives Considered*: Starting a new daily snapshot log from today onward was rejected because it would ignore all historical progress already earned by the learner.
- **Decision 2 — Bidirectional Capitals Sharing the `capital` SRS Card**:
  - *Chosen Approach*: Keep `${countryId}:capital` as the unified SRS card and dynamically select question direction (`country_to_capital` vs. `capital_to_country`) when building questions, using deterministic/balanced alternation so both directions are practiced across repetitions.
  - *Why*: Preserves every existing capital card's FSRS stability, difficulty, and mastery rating while strengthening bidirectional recall.
  - *Alternatives Considered*: Creating a separate `capital_to_country` attribute key was passed over per user preference to keep Capitals unified inside a single toggle.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Main Dashboard (12-Column Grid)                       │
├────────────────────────┬─────────────────────────┬───────────────────────────┤
│   LEFT COLUMN (5 Col)  │   CENTER COLUMN (3-4)   │    RIGHT COLUMN (3-4)     │
│                        │                         │                           │
│ ┌────────────────────┐ │ ┌─────────────────────┐ │ ┌───────────────────────┐ │
│ │ Expedition Launch  │ │ │ Interactive 3D      │ │ │ Compact 2×3 Regional  │ │
│ │ (Capitals:         │ │ │ Political Globe     │ │ │ Folios Matrix         │ │
│ │  Country ↔ Capital)│ │ └─────────────────────┘ │ │ (Europe, Asia, Africa │ │
│ └────────────────────┘ │ ┌─────────────────────┐ │ │  Americas, Oceania,   │ │
│ ┌────────────────────┐ │ │ Country in Focus    │ │ │  Oceans)              │ │
│ │ Global Memory      │ │ │ Dossier             │ │ └───────────────────────┘ │
│ │ Horizon +          │ │ └─────────────────────┘ │ ┌───────────────────────┐ │
│ │ 4-Stage Card Peek  │ │                         │ │ NEW: 4-Stage          │ │
│ └────────────────────┘ │                         │ │ Remembrance Timeline  │ │
│ ┌────────────────────┐ │                         │ │ • Stacked Area SVG    │ │
│ │ 4-Card Lifetime    │ │                         │ │ • Attr Filter Tabs    │ │
│ │ Telemetry Strip    │ │                         │ │ • Date Hover Scrubber │ │
│ └────────────────────┘ │                         │ └───────────────────────┘ │
└────────────────────────┴─────────────────────────┴───────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                  Bidirectional Capital Question Pipeline                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  SRSItem (`${countryId}:capital`)                                            │
│       │                                                                      │
│       ├──► Direction: 'country_to_capital'                                   │
│       │      Prompt: "What is the capital of {Country}?"                     │
│       │      L0: 4 Regional Capitals  │  L1+: Type Capital (Fuzzy Match)     │
│       │                                                                      │
│       └──► Direction: 'capital_to_country'                                   │
│              Prompt: "{Capital} is the capital of which country?"            │
│              UI Mask: Hide Flag & Country Name until submitted               │
│              L0: 4 Regional Countries │  L1+: Type Country (Alias + Fuzzy)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `TrainingQuestion` extended with optional `questionDirection?: 'country_to_capital' | 'capital_to_country'` (or `targetType: 'capital' | 'country'`).
  - Timeline aggregation hook computes daily buckets `Array<{ dateLabel: string; isoDate: string; mastered: number; recall: number; learning: number; unseen: number; reviewsCount: number }>` filtered by `'all' | 'capital' | 'location' | 'country' | 'flag'` and timeframe (`7d` | `14d` | `30d` | `all`).
- **Interactive Component & State Mapping**:
  - **Timeline Attribute & Window Selectors**: Clicking `All / Cap / Loc / Map / Flag` or `7D / 14D / 30D / All` updates local filter state and smoothly transitions the SVG stacked area paths and net progression badges.
  - **Timeline Hover Scrubber**: Pointer movement over the SVG chart resolves the nearest day index, rendering a vertical guide line and live stage breakdown header without layout shift.
  - **Bidirectional Prompt & Validation**:
    - `buildQuestion` in the SRS engine alternates/selects between `country_to_capital` and `capital_to_country` for `capital` items.
    - When `questionDirection === 'capital_to_country'`, distractors at Stage 0 are regional country names, typing validation at Stage 1+ uses `validateCountryNameAnswer`, and `MultipleChoicePrompt` / `TypingRecallPrompt` mask the country flag and name until `isSubmitted` is true, then zoom/highlight the country on the map upon submission.
