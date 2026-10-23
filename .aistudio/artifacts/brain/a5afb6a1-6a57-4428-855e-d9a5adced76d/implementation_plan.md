# Continuous Infinite Learning Stream — Implementation Plan

## 1. App Overview & Core Objectives
GeoMastery is transitioning from fixed 15-card training batches to a **continuous, infinite learning stream**. Users can study for 2 minutes or 2 hours without arbitrary session walls, while the spaced repetition engine dynamically plans over a longer rolling horizon.

### Confirmed User Decisions (from Phase 1)
1. **In-Stream Expanding Spacing (L0 → L1 → Mastered)**: Newly introduced (`L0`) and consolidating (`L1`) cards will reappear later in the same continuous stream after expanding card gaps, allowing users to progress cards from first recognition (`L0`) through active recall (`L1`) all the way to Mastered (`L2`) within a single extended sitting.
2. **Live Top-Bar Stats + Optional Recap on Exit**: The fixed `1/15` progress bar is replaced by a live telemetry strip in the top training bar (`Reviewed`, `Accuracy %`, `Streak`, `Promotions`), paired with a direct exit button and an optional **Summary / Recap** button when finishing a run.
3. **On-Demand Flag Study Reference**: When Flag cards are active in the filter, the Flag Study sheet will no longer interrupt entry; instead, an on-demand **Study Flags** button in the top training bar opens the visual flag reference whenever the user wants to compare flags.

---

## 2. UX & Visual Design

### Continuous Top Training Bar
- **Left Cluster (Navigation & Mode Controls)**:
  - **Exit to Dashboard (`← Exit`)**: Immediately returns to the home dashboard without interruption.
  - **Optional Run Summary (`Recap` badge button)**: Appears once at least 1 card has been answered; opens the Run Recap screen displaying accuracy, pace, promotions, and card-by-card history, with options to **Resume Stream**, **Drill Missed**, or **Return to Dashboard**.
  - **Scope Pill**: Displays active continent/region filter and SRS vs. Practice mode status.
- **Center/Right Cluster (Live Continuous Telemetry Strip)**:
  - **Cards Reviewed Counter**: Tabular-numeral badge showing total cards completed in the current sitting (`#14`).
  - **Live Accuracy Pill**: Color-coded percentage (`93%`) reflecting accuracy across the current sitting.
  - **Promotions Indicator**: Live badge (`+4 ↑`) counting cards promoted to Recall or Mastered during the sitting.
  - **Active Streak Badge**: Existing flame counter (`🔥 8x`) preserved with milestone animations.
- **Right Utility Cluster**:
  - **On-Demand `🏳️ Study Flags` Button**: Shown whenever `flag` is included in the active attribute filter (excluding Oceans). Opens the Flag Study drawer/modal over the training view and returns seamlessly to the exact current card when closed.
  - **Skip Card (`Skip →`)**: Advances past the current card and re-queues it further down the stream.

### Seamless Horizon & Mastery Transitions
- **No 15-Card Interruption**: Answering card #15, #30, or #100 flows directly into the next card with zero modal interruption.
- **Caught-Up Banner (Non-Blocking)**: If the user clears every due and unseen card in the selected region/attribute scope, a subtle emerald toast announces *"Region Horizon Cleared — Continuing in Retention & Mastery Stream"* and seamlessly transitions into lowest-retrievability mastered cards so the stream never hits a dead end.

---

## 3. Product Decisions & Cognitive Trade-Offs

### Preserving the Best of Sessions in an Infinite Stream
- **In-Stream Multi-Step Progression (Expanding Spacing)**:
  - Previously, graduating a card from `L0` (4-choice) to `L1` (recall) set its next review to `+1 day`, preventing the user from testing active recall on that card until tomorrow's session.
  - In the continuous stream, when a card advances from `L0 → L1` or `L1 (learning) → L1 (recall, S < 6.0d)`, the stream scheduler automatically inserts a **scheduled follow-up card** (`isRetry: false`) at an expanding gap down the stream:
    - **L0 → L1 (First Active Recall Verification)**: Re-queued after **+8 to +10 cards**.
    - **L1 → L2 (Mastery Consolidation)**: Re-queued after **+15 to +18 cards**.
  - Because `processAnswer` already uses an intra-day FSRS-6 stability multiplier (`elapsedDays < 0.25`), answering these spaced follow-ups in-stream legitimately grows stability `S` past the `6.0d` mastery threshold without artificially inflating long-term intervals.
- **Dual-Stage Error Recovery (Landauer & Bjork Expanding Retrieval)**:
  - When a card is missed, the stream inserts:
    1. **Immediate Scaffolding Retry (`+4 cards`, `isRetry: true`)**: Reinforces the memory trace without mutating SRS intervals.
    2. **Spaced Verification (`+11 cards`, `isRetry: false`)**: Gives the learner a genuine opportunity to recover the card's recall streak and stability later in the stream.
- **Cognitive Load Governor (Anti-Flood Cap)**:
  - In an infinite stream, introducing too many unseen (`L0`) cards consecutively would overwhelm working memory.
  - The rolling scheduler tracks **active in-flight learning cards** (cards currently in `L0` or `L1 learning` that are scheduled to reappear in the stream). If the number of in-flight learning cards exceeds **10**, the replenishment engine prioritizes consolidating those in-flight cards and due reviews before introducing additional unseen `L0` cards.
- **Paivio Dual-Coding & Anti-Priming Interleaving**:
  - When introducing a new country, its sibling attributes (`location`, `capital`, `country`, `flag`) are staggered across the rolling horizon with a strict **minimum gap of 4 cards** between any two cards of the same country (`countryId`), preventing trivial short-term priming while building a unified mental map.

---

## 4. Technical Architecture

```
+-------------------------------------------------------------------------+
|                        Continuous Stream Engine                         |
|                                                                         |
|  [User Answers Card at currentIndex]                                    |
|           |                                                             |
|           +---> 1. FSRS-6 State Update (processAnswer)                  |
|           |        Persists immediately to dual-layer storage           |
|           |        (unless Practice Mode is active)                     |
|           |                                                             |
|           +---> 2. In-Stream Expanding Spacing Injector                 |
|           |        - Missed Card:                                       |
|           |            +4 cards  (isRetry: true, scaffolding)           |
|           |            +11 cards (isRetry: false, verification)         |
|           |        - L0 -> L1 Graduated:                                |
|           |            +9 cards  (isRetry: false, active recall test)   |
|           |        - L1 -> L1 Consolidating (S < 6.0d):                 |
|           |            +16 cards (isRetry: false, mastery test)         |
|           |        * Enforces minGap >= 4 from same-country cards       |
|           |                                                             |
|           +---> 3. Rolling Horizon Replenisher                          |
|                    Triggered when (queue.length - currentIndex) < 12    |
|                    Appends next 15 cards using live srsItemsMap,        |
|                    in-flight learning cap (<= 10 active L0/L1),         |
|                    Paivio dual-coding pairs, and 1-in-10 retention      |
+-------------------------------------------------------------------------+
```

### Core Components & Responsibilities
1. **Rolling Horizon Replenisher & Spacing Injector (`srsEngine`)**:
   - Maintain full backward compatibility for `prepareSessionQueue` so all existing unit tests continue to pass.
   - Add `replenishStreamQueue` and `scheduleInStreamFollowUp` helpers that operate on the live queue tail (`queue.slice(currentIndex + 1)`):
     - Deduplicates against cards already waiting in the upcoming lookahead window so the same `(countryId, attributeId)` is never queued twice simultaneously.
     - Enforces the 4-card anti-priming gap across the boundary between existing lookahead cards and newly appended cards.
     - Automatically falls back to low-retrievability mastered cards if all due and unseen items in the filtered region have been exhausted.
2. **Continuous Training Controller (`TrainingSession`)**:
   - Remove the fixed 15-card termination check (`currentIndex + 1 < queue.length` ending the session).
   - After each answer, apply in-stream expanding spacing insertions and check if the lookahead buffer needs replenishment (`remaining < 12`).
   - Track live sitting telemetry (`cardsReviewed`, `correctCount`, `promotionsCount`, `sessionResults`) and render the new Top Telemetry Strip, on-demand **Study Flags** modal toggle, and optional **Recap** trigger.
3. **Run Summary & Dashboard Wording (`SessionCompletedView`, `VelocityHome`)**:
   - Update `SessionCompletedView` copy from "Session Complete" to **"Training Run Recap"** with a **"Resume Stream"** primary button alongside **"Drill Missed"** and **"Dashboard"**.
   - Update subtle copy on `VelocityHome` (e.g., changing `"~15 cards · Adaptive mix"` on the Start Training CTA to `"Infinite adaptive stream · Stop anytime"`).
