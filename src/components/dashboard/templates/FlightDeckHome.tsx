import React, { useState } from 'react';
import {
  Play,
  Compass,
  Zap,
  Flame,
  RefreshCw,
  KeyRound,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Target,
  CheckCircle2,
  Award,
  Radar,
  Eye,
  Gauge,
  Orbit
} from 'lucide-react';
import { PlanetaryBackground } from '../../common/PlanetaryBackground';
import { useHomeData, useDueBreakdown } from '../homeData';
import { useCountUp } from '../useCountUp';
import type { HomeViewProps, RegionModel } from '../homeTypes';
import { soundFx } from '../../../core/soundFx';

/* ────────────────────────────────────────────────────────────────────────────
 * TEMPLATE A — "FLIGHT DECK"
 * Dark instrument console. Every surface is a panel, every value is a readout:
 * hairline rules, mono labels with wide tracking, cyan instrument teal for
 * system state, amber for cards in active recall. The signature is the launch
 * strip — a mission-control bay that reads like a pre-flight checklist.
 * ──────────────────────────────────────────────────────────────────────────── */

const TEAL = '#2dd4bf';
const AMBER = '#fbbf24';

const Panel: React.FC<{
  label?: string;
  meta?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ label, meta, className = '', bodyClassName = '', children }) => (
  <section
    className={`relative rounded-lg border border-[#7dd3fc]/15 bg-[#070d19]/85 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl ${className}`}
  >
    {/* Instrument corner ticks */}
    {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
      <span
        key={corner}
        aria-hidden="true"
        className={`pointer-events-none absolute h-2 w-2 border-[#7dd3fc]/40 ${
          corner === 'top-left'
            ? 'left-1.5 top-1.5 border-l border-t'
            : corner === 'top-right'
            ? 'right-1.5 top-1.5 border-r border-t'
            : corner === 'bottom-left'
            ? 'bottom-1.5 left-1.5 border-b border-l'
            : 'bottom-1.5 right-1.5 border-b border-r'
        }`}
      />
    ))}
    {label && (
      <header className="flex items-center justify-between gap-3 border-b border-[#7dd3fc]/12 px-4 py-2.5">
        <h3 className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]/80">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#2dd4bf]" />
          {label}
        </h3>
        {meta && <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{meta}</div>}
      </header>
    )}
    <div className={`p-4 ${bodyClassName}`}>{children}</div>
  </section>
);

const Readout: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}> = ({ label, value, hint, tone = 'text-white' }) => (
  <div className="flex flex-col gap-0.5 border-l border-[#7dd3fc]/15 pl-3">
    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
    <span className={`font-mono text-lg font-semibold tabular-nums ${tone}`}>{value}</span>
    {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
  </div>
);

const IconButton: React.FC<{
  title: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, active = false, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf] ${
      active
        ? 'border-[#2dd4bf]/50 bg-[#2dd4bf]/12 text-[#2dd4bf]'
        : 'border-[#7dd3fc]/15 bg-[#070d19]/80 text-slate-400 hover:border-[#7dd3fc]/35 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const FlightDeckHome: React.FC<HomeViewProps> = (props) => {
  const {
    srsItemsMap,
    stats,
    settings,
    selectedAttributes,
    isSyncing,
    syncStatusMessage,
    onStartSession,
    onOpenAtlas,
    onOpenArcade,
    onToggleAttribute,
    onToggleSound,
    onSyncGitHub,
    onExportBackup,
    onImportBackup,
    onSaveGithubToken
  } = props;

  const data = useHomeData(srsItemsMap, stats, selectedAttributes);
  const due = useDueBreakdown(srsItemsMap, selectedAttributes);
  const [showTokenPanel, setShowTokenPanel] = useState(false);
  const [revealCapital, setRevealCapital] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(settings.githubSyncToken || '');

  const masteryValue = useCountUp(data.mastery.masteryPercentage);
  const recallValue = useCountUp(data.mastery.learningPercentage);

  const dialRadius = 46;
  const dialCircumference = 2 * Math.PI * dialRadius;
  const masteryOffset = dialCircumference - (masteryValue / 100) * dialCircumference;
  const recallOffset = dialCircumference - (recallValue / 100) * dialCircumference;

  const focusToggle = (attr: 'capital' | 'location', label: string, glyph: string, accent: string) => {
    const on = selectedAttributes.includes(attr);
    return (
      <button
        onClick={() => onToggleAttribute(attr)}
        aria-pressed={on}
        className={`group flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf] ${
          on
            ? 'border-[#2dd4bf]/45 bg-[#2dd4bf]/12 text-[#5eead4]'
            : 'border-[#7dd3fc]/12 bg-[#070d19]/60 text-slate-500 hover:text-slate-300'
        }`}
      >
        <span aria-hidden="true">{glyph}</span>
        {label}
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full transition-colors ${on ? 'bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]' : 'bg-slate-700'}`}
        />
        <span className={on ? accent : ''}>{on ? 'ON' : 'OFF'}</span>
      </button>
    );
  };

  return (
    <PlanetaryBackground className="flex-1 h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {/* ══ CONSOLE HEADER ══════════════════════════════════════════════ */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#7dd3fc]/15 bg-[#070d19]/70 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2dd4bf]/40 bg-[#2dd4bf]/10 text-lg">
              🌍
            </span>
            <div className="leading-tight">
              <p className="font-display text-base font-extrabold uppercase tracking-[0.14em] text-white">
                GeoMastery
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-slate-500">
                Flight deck · spaced repetition console
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fbbf24] sm:flex">
              <Flame className="h-3.5 w-3.5 fill-[#fbbf24]" />
              {stats.currentStreak}d streak
            </span>
            <IconButton title={isSyncing ? 'Syncing…' : 'Sync progress with GitHub'} onClick={onSyncGitHub}>
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </IconButton>
            <IconButton
              title="GitHub token (two-way push from mobile)"
              active={Boolean(settings.githubSyncToken)}
              onClick={() => setShowTokenPanel((v) => !v)}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              title={settings.audioEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              onClick={onToggleSound}
              active={settings.audioEnabled}
            >
              {settings.audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </IconButton>
            <IconButton title="Export progress backup (JSON)" onClick={onExportBackup}>
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <label
              title="Import progress backup (JSON)"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#7dd3fc]/15 bg-[#070d19]/80 text-slate-400 transition-colors hover:border-[#7dd3fc]/35 hover:text-white"
            >
              <Upload className="h-3.5 w-3.5" />
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportBackup(file);
                }}
              />
            </label>
          </div>

          {syncStatusMessage && (
            <p className="w-full border-t border-[#7dd3fc]/12 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5eead4]">
              ▸ {syncStatusMessage}
            </p>
          )}

          {showTokenPanel && (
            <div className="w-full rounded-md border border-[#7dd3fc]/20 bg-[#040914]/95 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                GitHub personal access token · scope: repo / contents:write
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  className="flex-1 rounded-md border border-[#7dd3fc]/20 bg-[#070d19] px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#2dd4bf] focus:outline-none"
                />
                <button
                  onClick={() => {
                    onSaveGithubToken(tokenDraft.trim());
                    setShowTokenPanel(false);
                  }}
                  className="rounded-md bg-[#2dd4bf] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#052e26] transition-colors hover:bg-[#5eead4]"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </header>

        {/* ══ LAUNCH STRIP (signature) ════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-lg border border-[#2dd4bf]/25 bg-gradient-to-br from-[#08111f] via-[#070d19] to-[#050a13] shadow-[0_28px_60px_-32px_rgba(45,212,191,0.35)]">
          {/* Faint telemetry trace along the bottom edge */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full opacity-40"
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
          >
            <path
              d="M0 20 L120 20 L132 8 L144 32 L156 20 L420 20 L432 6 L444 34 L456 20 L780 20 L792 10 L804 30 L816 20 L1200 20"
              fill="none"
              stroke="rgba(45,212,191,0.5)"
              strokeWidth="1"
              strokeDasharray="6 8"
              className="animate-gm-trace"
            />
          </svg>

          <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#5eead4]">
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2dd4bf]" />
                <Radar className="h-3.5 w-3.5" />
                SRS mission control
              </p>
              <h1 className="font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white sm:text-[2rem]">
                Ready for your daily review?
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-400">
                New nations start on multiple choice and graduate to active recall. Two correct answers in a row masters a
                card for good.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-600">Focus</span>
                {focusToggle('capital', 'Capital cities', '🏛️', 'text-[#5eead4]')}
                {focusToggle('location', 'Map locations', '📍', 'text-[#5eead4]')}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
                  <b className="text-[#fbbf24]">{data.mastery.globalStage1}</b> in active recall
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: TEAL }} />
                  <b className="text-[#5eead4]">{data.mastery.globalStage2}</b> mastered
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                  <b className="text-slate-400">{data.mastery.globalStage0}</b> waiting
                </span>
              </div>
            </div>

            {/* Readout + launch control */}
            <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
              <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={dialRadius} className="stroke-[#0b1424]" strokeWidth="9" fill="transparent" />
                  <circle
                    cx="60"
                    cy="60"
                    r={dialRadius}
                    stroke={AMBER}
                    strokeWidth="9"
                    strokeDasharray={dialCircumference}
                    strokeDashoffset={recallOffset}
                    strokeLinecap="round"
                    fill="transparent"
                    opacity="0.75"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={dialRadius}
                    stroke={TEAL}
                    strokeWidth="9"
                    strokeDasharray={dialCircumference}
                    strokeDashoffset={masteryOffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="drop-shadow-[0_0_6px_rgba(45,212,191,0.6)]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-2xl font-bold tabular-nums text-white">{masteryValue}%</span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Mastered</span>
                  <span className="font-mono text-[9px] text-[#fbbf24]">{recallValue}% recall</span>
                </div>
              </div>

              <button
                onClick={() => {
                  soundFx.playClick();
                  onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                }}
                className="group relative w-full overflow-hidden rounded-md bg-[#2dd4bf] px-7 py-4 text-left font-display text-base font-extrabold uppercase tracking-[0.1em] text-[#052e26] shadow-[0_16px_36px_-14px_rgba(45,212,191,0.65)] transition-all hover:bg-[#5eead4] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf] sm:w-auto"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/30 opacity-0 transition-opacity group-hover:animate-gm-sweep group-hover:opacity-100"
                />
                <span className="relative flex items-center gap-2">
                  <Play className="h-5 w-5 fill-[#052e26]" />
                  {data.totalDueCount > 0 ? 'Train world' : 'Practice world'}
                </span>
                <span className="relative mt-0.5 block font-mono text-[10px] font-semibold normal-case leading-snug tracking-[0.08em] text-[#0f3b33]/85">
                  {data.totalDueCount > 0
                    ? `${data.totalDueCount} reviews due · ${due.capital} capitals · ${due.location} locations`
                    : 'Queue clear — keep the streak warm'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ══ BODY MATRIX ════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          {/* Left rail — system status */}
          <div className="order-2 flex flex-col gap-4 xl:col-span-4 xl:order-1 xl:sticky xl:top-5">
            <Panel label="System readout" meta={`${data.totalWorldEntities} entities`}>
              <div className="grid grid-cols-2 gap-y-4">
                <Readout label="Reviews logged" value={stats.totalReviews.toLocaleString()} hint={`${data.reviewsToday} in the last 24h`} />
                <Readout label="Accuracy" value={`${data.accuracy}%`} tone="text-[#5eead4]" />
                <Readout label="Streak" value={`${stats.currentStreak}d`} tone="text-[#fbbf24]" hint={`record ${stats.longestStreak}d`} />
                <Readout
                  label="In memory"
                  value={`${data.entitiesInMemory}/${data.totalWorldEntities}`}
                  tone="text-[#a78bfa]"
                  hint="nations & seas touched"
                />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#7dd3fc]/12 pt-3">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <Gauge className="h-3.5 w-3.5 text-[#2dd4bf]" />
                  {data.rank.title}
                </span>
                <span className="font-mono text-[10px] font-semibold text-[#a78bfa]">
                  LVL {data.rank.level} · {data.rank.xp.toLocaleString()} XP
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0b1424]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#fbbf24] to-[#2dd4bf] transition-all duration-700"
                  style={{ width: `${data.rank.progress}%` }}
                />
              </div>
            </Panel>

            <Panel label="Spotlight dossier" meta={data.spotlightStatus.label}>
              <div className="flex items-center gap-3.5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[#7dd3fc]/20 bg-[#0b1424] text-4xl">
                  {data.spotlight.flagEmoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-white">{data.spotlight.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {data.spotlight.subregion} · {data.spotlight.continent}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-[#7dd3fc]/15 bg-[#040914]/80 p-3">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
                  <span>Capital recall</span>
                  <span className="text-[#fbbf24]">active recall</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 rounded border border-[#7dd3fc]/10 bg-[#070d19] px-3 py-2">
                  <span className="font-mono text-sm font-bold text-white">
                    {revealCapital ? data.spotlight.capital : '••••••••••'}
                  </span>
                  <button
                    onClick={() => {
                      setRevealCapital((v) => !v);
                      soundFx.playClick();
                    }}
                    className="flex items-center gap-1 rounded border border-[#2dd4bf]/30 bg-[#2dd4bf]/12 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5eead4] transition-colors hover:bg-[#2dd4bf]/25"
                  >
                    <Eye className="h-3 w-3" />
                    {revealCapital ? 'Hide' : 'Reveal'}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={onOpenAtlas}
                  className="rounded-md border border-[#7dd3fc]/15 bg-[#0b1424] py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-[#7dd3fc]/35 hover:text-white"
                >
                  Atlas dossier
                </button>
                <button
                  onClick={() => onStartSession(data.spotlight.continent, ['capital', 'location'], true)}
                  className="rounded-md border border-[#2dd4bf]/40 bg-[#2dd4bf]/15 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5eead4] transition-colors hover:bg-[#2dd4bf]/25"
                >
                  Drill region
                </button>
              </div>
            </Panel>
          </div>

          {/* Right bay — operations */}
          <div className="order-1 flex flex-col gap-4 xl:col-span-8 xl:order-2">
            {/* Quick links */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: 'Explorer atlas',
                  sub: 'Free-roam 2D map & 3D globe',
                  meta: '196 nations',
                  icon: <Compass className="h-4 w-4" />,
                  onClick: onOpenAtlas,
                  color: '#7dd3fc'
                },
                {
                  title: 'Time attack',
                  sub: '60-second capital blitz',
                  meta: 'Arcade',
                  icon: <Zap className="h-4 w-4 fill-current" />,
                  onClick: onOpenArcade,
                  color: AMBER
                }
              ].map((link) => (
                <button
                  key={link.title}
                  onClick={link.onClick}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-[#7dd3fc]/15 bg-[#070d19]/80 px-4 py-3.5 text-left transition-all hover:border-[#7dd3fc]/35 hover:bg-[#0b1424] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2dd4bf]"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-md border"
                      style={{ color: link.color, borderColor: `${link.color}40`, background: `${link.color}14` }}
                    >
                      {link.icon}
                    </span>
                    <span>
                      <span className="block font-display text-sm font-bold text-white">{link.title}</span>
                      <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                        {link.sub}
                      </span>
                    </span>
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600 transition-colors group-hover:text-[#5eead4]">
                    {link.meta} →
                  </span>
                </button>
              ))}
            </div>

            {/* Regional drill matrix */}
            <Panel
              label="Regional drill matrix"
              meta={`${data.regions.length} targets`}
              bodyClassName="p-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {data.regions.map((region: RegionModel) => (
                  <div
                    key={region.id}
                    className={`group relative flex flex-col gap-3 rounded-md border p-3.5 transition-colors ${
                      region.isWater
                        ? 'border-[#38bdf8]/30 bg-[#38bdf8]/[0.06] hover:border-[#38bdf8]/60'
                        : 'border-[#7dd3fc]/12 bg-[#040914]/60 hover:border-[#2dd4bf]/45'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{region.emblem}</span>
                        <div>
                          <p className="font-display text-sm font-bold text-white">{region.name}</p>
                          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                            {region.subtitle}
                          </p>
                        </div>
                      </div>
                      <span
                        className="font-mono text-base font-bold tabular-nums"
                        style={{ color: region.isWater ? '#7dd3fc' : TEAL }}
                      >
                        {region.masteredPct}%
                      </span>
                    </div>

                    <div className="flex h-1.5 overflow-hidden rounded-full bg-[#0b1424]">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${region.masteredPct}%`, background: region.isWater ? '#38bdf8' : TEAL }}
                      />
                      <div className="h-full transition-all duration-500" style={{ width: `${region.recallPct}%`, background: AMBER }} />
                    </div>

                    <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                      <span>
                        <b className="text-slate-300">{region.mastered}</b> mastered
                      </span>
                      <span>
                        <b className="text-[#fbbf24]">{region.recall}</b> recall
                      </span>
                      <span>
                        <b className="text-slate-400">{region.dueCount}</b> due
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        soundFx.playClick();
                        onStartSession(region.id, region.isWater ? ['location'] : selectedAttributes, region.caughtUp);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-md py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-all active:scale-[0.98] ${
                        region.caughtUp
                          ? 'border border-[#a78bfa]/45 bg-[#a78bfa]/15 text-[#c4b5fd] hover:bg-[#a78bfa]/25'
                          : region.isWater
                          ? 'border border-[#7dd3fc]/20 bg-[#0b1424] text-slate-200 hover:border-[#38bdf8] hover:bg-[#38bdf8] hover:text-[#04121f]'
                          : 'border border-[#7dd3fc]/20 bg-[#0b1424] text-slate-200 hover:border-[#2dd4bf] hover:bg-[#2dd4bf] hover:text-[#052e26]'
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      {region.caughtUp ? `Practice ${region.shortName}` : `Train ${region.shortName}`}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Telemetry */}
            <Panel label="Retention telemetry" meta="live queue">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Readout
                  label="Due now"
                  value={data.totalDueCount}
                  tone="text-[#fbbf24]"
                  hint={`${due.capital} capitals · ${due.location} locations`}
                />
                <Readout label="Mastered" value={data.mastery.globalStage2} tone="text-[#5eead4]" hint={`${data.mastery.masteryPercentage}% of the deck`} />
                <Readout label="In recall" value={data.mastery.globalStage1} tone="text-[#fbbf24]" hint="stage 1 cards" />
                <Readout
                  label="Coverage"
                  value={`${Math.round((data.entitiesInMemory / data.totalWorldEntities) * 100)}%`}
                  tone="text-[#a78bfa]"
                  hint={`${data.entitiesInMemory} of ${data.totalWorldEntities} entities`}
                />
              </div>
              <div className="mt-4 border-t border-[#7dd3fc]/12 pt-3">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Orbit className="h-3 w-3" />
                    Memory pipeline
                  </span>
                  <span className="text-slate-400">
                    {data.pipeline.mastered + data.pipeline.recall} / {data.pipeline.total} entities
                  </span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#0b1424]">
                  <div className="h-full bg-[#2dd4bf]" style={{ width: `${(data.pipeline.mastered / data.pipeline.total) * 100}%` }} />
                  <div className="h-full bg-[#fbbf24]" style={{ width: `${(data.pipeline.recall / data.pipeline.total) * 100}%` }} />
                  <div className="h-full bg-[#38bdf8]/70" style={{ width: `${(data.pipeline.recognition / data.pipeline.total) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Target className="h-3 w-3 text-[#2dd4bf]" />
                    {data.pipeline.mastered} mastered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-[#fbbf24]" />
                    {data.pipeline.recall} in recall
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Award className="h-3 w-3 text-[#38bdf8]" />
                    {data.pipeline.recognition} on scaffolding
                  </span>
                  <span className="text-slate-600">{data.pipeline.uncharted} uncharted</span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </PlanetaryBackground>
  );
};

export default FlightDeckHome;
