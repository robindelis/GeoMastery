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
  Eye,
  Trophy,
  Target,
  Sparkles,
  Gauge,
  ChevronRight
} from 'lucide-react';
import { useHomeData, useDueBreakdown } from './homeData';
import { useCountUp } from './useCountUp';
import type { HomeViewProps } from './homeTypes';
import { soundFx } from '../../core/soundFx';

/* ────────────────────────────────────────────────────────────────────────────
 * VELOCITY DECK — the home page.
 *
 * One accent (magenta), one gradient direction, one radius scale, one label
 * style. Everything else stays quiet so the data and the two big actions read
 * first. Slabs are the unit of layout: a slab is rounded-[1.5rem], hairline
 * white/10 border, no shadow of its own — depth comes from the accent glows
 * behind the page.
 *
 * Radius scale:  1.5rem slabs · 1rem inner blocks · full pills
 * Type:          Archivo Black (display) · Plus Jakarta Sans (body) · JetBrains
 *                Mono (every label and every number)
 * ──────────────────────────────────────────────────────────────────────────── */

const MAGENTA = '#FF3D77';
const CYAN = '#22D3EE';
const AMBER = '#FFC53D';
const LIME = '#A3E635';

const REGION_TINT: Record<string, string> = {
  Europe: '#818CF8',
  Asia: '#F472B6',
  Africa: '#FBBF24',
  Americas: '#34D399',
  Oceania: '#22D3EE',
  Oceans: '#60A5FA'
};

const display = 'font-[family-name:var(--font-black)]';

/* ── Primitives ─────────────────────────────────────────────────────────── */

const Eyebrow: React.FC<{ children: React.ReactNode; tone?: 'dim' | 'accent'; className?: string }> = ({
  children,
  tone = 'dim',
  className = ''
}) => (
  <p
    className={`font-mono text-[9px] font-bold uppercase tracking-[0.28em] ${
      tone === 'accent' ? 'text-[#FF8FB1]' : 'text-slate-500'
    } ${className}`}
  >
    {children}
  </p>
);

const Slab: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <section className={`rounded-[1.5rem] border border-white/10 bg-white/[0.035] ${className}`}>{children}</section>
);

const GhostButton: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({
  children,
  onClick,
  className = ''
}) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center gap-2 rounded-full border-2 border-white/12 bg-white/[0.04] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.04em] text-white transition-colors hover:border-white/30 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77] ${className}`}
  >
    {children}
  </button>
);

const IconChip: React.FC<{ title: string; onClick?: () => void; active?: boolean; children: React.ReactNode }> = ({
  title,
  onClick,
  active = false,
  children
}) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77] ${
      active
        ? 'border-[#FF3D77]/60 bg-[#FF3D77]/15 text-[#FF8FB1]'
        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const StatSlab: React.FC<{
  label: string;
  value: string;
  note: string;
  color: string;
  icon: React.ReactNode;
}> = ({ label, value, note, color, icon }) => (
  <Slab className="relative overflow-hidden p-4 sm:p-5">
    <span
      aria-hidden="true"
      className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-25 blur-2xl"
      style={{ background: color }}
    />
    <span className="relative flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${color}1F`, color }}
      >
        {icon}
      </span>
      <Eyebrow>{label}</Eyebrow>
    </span>
    <p className="relative mt-3.5 font-mono text-[1.75rem] font-bold leading-none tabular-nums text-white">{value}</p>
    <p className="relative mt-1.5 text-[11px] text-slate-500">{note}</p>
  </Slab>
);

/* ── Page ───────────────────────────────────────────────────────────────── */

const VelocityHome: React.FC<HomeViewProps> = (props) => {
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

  const [revealCapital, setRevealCapital] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(settings.githubSyncToken || '');

  const masteryValue = useCountUp(data.mastery.masteryPercentage);
  const dueValue = useCountUp(data.totalDueCount, 700);

  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (masteryValue / 100) * ringCircumference;

  const today = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  const focusPills = [
    { attr: 'capital' as const, label: 'Capitals', glyph: '🏛️', tint: CYAN },
    { attr: 'location' as const, label: 'Locations', glyph: '📍', tint: LIME }
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#170A2B] text-white">
      {/* Ambient field — the only decoration on the page */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(125%_95%_at_12%_-12%,#3E1070_0%,#1C0B36_45%,#110827_100%)]" />
        <div className="animate-gm-drift absolute -left-32 top-0 h-[30rem] w-[30rem] rounded-full bg-[#FF3D77]/[0.18] blur-[130px]" />
        <div className="animate-gm-drift absolute -right-24 top-1/4 h-[24rem] w-[24rem] rounded-full bg-[#22D3EE]/[0.13] blur-[130px] [animation-delay:-7s]" />
        <div className="animate-gm-drift absolute -bottom-24 left-1/3 h-[26rem] w-[26rem] rounded-full bg-[#7C3AED]/[0.2] blur-[130px] [animation-delay:-12s]" />
        <svg className="absolute inset-0 h-full w-full opacity-25">
          <defs>
            <pattern id="velocity-grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M44 0 L0 0 0 44" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#velocity-grid)" />
        </svg>
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-7 sm:py-9">
        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#FF3D77] to-[#7C3AED] text-2xl shadow-[0_12px_30px_-10px_rgba(255,61,119,0.85)]">
              🌍
            </span>
            <div>
              <h1 className={`${display} text-lg leading-none tracking-[-0.01em] text-white`}>DAILY RUN</h1>
              <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.26em] text-slate-500">
                Level {data.rank.level} · {data.rank.title}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border-2 border-[#FFC53D]/40 bg-[#FFC53D]/10 px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFC53D]">
              <Flame className="h-3.5 w-3.5 fill-[#FFC53D]" />
              {stats.currentStreak} day streak
            </span>
            <IconChip title={isSyncing ? 'Syncing…' : 'Sync progress with GitHub'} onClick={onSyncGitHub}>
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </IconChip>
            <IconChip
              title="GitHub token — pushes progress from mobile"
              active={Boolean(settings.githubSyncToken)}
              onClick={() => setShowToken((v) => !v)}
            >
              <KeyRound className="h-4 w-4" />
            </IconChip>
            <IconChip
              title={settings.audioEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              onClick={onToggleSound}
              active={settings.audioEnabled}
            >
              {settings.audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </IconChip>
            <IconChip title="Export progress backup (JSON)" onClick={onExportBackup}>
              <Download className="h-4 w-4" />
            </IconChip>
            <label
              title="Import progress backup (JSON)"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:border-white/25 hover:text-white"
            >
              <Upload className="h-4 w-4" />
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
        </header>

        {/* Sync feedback */}
        {(syncStatusMessage || showToken) && (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
            {showToken ? (
              <>
                <Eyebrow>GitHub token</Eyebrow>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                  Pulling progress works with no setup. Add a token to push from mobile as well — scope{' '}
                  <code className="font-mono text-[#FF8FB1]">repo</code>, contents:write.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={tokenDraft}
                    onChange={(e) => setTokenDraft(e.target.value)}
                    placeholder="ghp_… or github_pat_…"
                    className="flex-1 rounded-full border-2 border-white/10 bg-white/[0.04] px-4 py-2.5 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#FF3D77] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      onSaveGithubToken(tokenDraft.trim());
                      setShowToken(false);
                    }}
                    className="rounded-full bg-[#FF3D77] px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#2A0616] transition-colors hover:bg-[#FF5C91]"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#D9F99D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A3E635]" />
                {syncStatusMessage}
              </p>
            )}
          </div>
        )}

        {/* ══ RUN CARD ════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <span aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#FF3D77]/25 blur-[100px]" />
          <span aria-hidden="true" className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-[#22D3EE]/15 blur-[100px]" />

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
            <div>
              <p className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-[#FF8FB1]">
                <Sparkles className="h-3.5 w-3.5" />
                {data.totalDueCount > 0 ? 'Queue ready' : 'Queue clear'}
              </p>

              <h2 className={`${display} mt-4 text-[2.6rem] leading-[0.94] tracking-[-0.035em] text-white sm:text-[3.4rem]`}>
                KEEP THE
                <br />
                <span className="bg-gradient-to-r from-[#FF3D77] via-[#FF7FA8] to-[#FFC53D] bg-clip-text text-transparent">
                  STREAK ALIVE
                </span>
              </h2>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                {data.totalDueCount > 0
                  ? `${dueValue} cards are waiting. Two correct answers in a row masters each one.`
                  : 'Every card is scheduled ahead — run a practice drill to sharpen what you know.'}
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                {focusPills.map((pill) => {
                  const on = selectedAttributes.includes(pill.attr);
                  return (
                    <button
                      key={pill.attr}
                      onClick={() => onToggleAttribute(pill.attr)}
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.06em] transition-all active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77] ${
                        on ? 'text-[#170A2B]' : 'border-white/12 bg-white/[0.04] text-slate-400 hover:text-white'
                      }`}
                      style={on ? { background: pill.tint, borderColor: pill.tint } : undefined}
                    >
                      <span aria-hidden="true">{pill.glyph}</span>
                      {pill.label}
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${on ? 'bg-[#170A2B]' : 'bg-slate-600'}`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                  }}
                  className="flex items-center gap-2.5 rounded-full bg-[#FF3D77] px-8 py-4 text-sm font-extrabold uppercase tracking-[0.06em] text-[#2A0616] shadow-[0_18px_40px_-14px_rgba(255,61,119,0.8)] transition-all hover:bg-[#FF5C91] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77]"
                >
                  <Play className="h-5 w-5 fill-current" />
                  Train world
                </button>
                <GhostButton onClick={onOpenAtlas}>
                  <Compass className="h-4 w-4" />
                  Atlas
                </GhostButton>
                <GhostButton onClick={onOpenArcade}>
                  <Zap className="h-4 w-4 fill-current" />
                  Arcade
                </GhostButton>
              </div>

              <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {due.capital} capitals · {due.location} locations · {data.reviewsToday} reviewed today
              </p>
            </div>

            {/* Score panel */}
            <div className="flex shrink-0 flex-col items-center gap-6 rounded-[1.5rem] border border-white/10 bg-[#170A2B]/60 p-6 sm:flex-row lg:flex-col">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <defs>
                    <linearGradient id="velocity-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={MAGENTA} />
                      <stop offset="100%" stopColor={AMBER} />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r={ringRadius} className="stroke-white/[0.08]" strokeWidth="11" fill="transparent" />
                  <circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    stroke="url(#velocity-ring)"
                    strokeWidth="11"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-3xl font-bold leading-none tabular-nums text-white">{masteryValue}%</span>
                  <span className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Mastered
                  </span>
                </div>
              </div>

              <div className="w-full min-w-[190px]">
                <div className="flex items-baseline justify-between">
                  <Eyebrow>Rank</Eyebrow>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFC53D]">
                    Lvl {data.rank.level}
                  </span>
                </div>
                <p className="mt-2 text-[15px] font-extrabold leading-tight text-white">{data.rank.title}</p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FFC53D] to-[#FF3D77] transition-all duration-700"
                    style={{ width: `${data.rank.progress}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {data.rank.xp.toLocaleString()} / {data.rank.nextXP.toLocaleString()} xp
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PICK YOUR MAP ═══════════════════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <Eyebrow>Targeted drills</Eyebrow>
              <h2 className={`${display} mt-2 text-xl leading-none tracking-[-0.01em] text-white`}>PICK YOUR MAP</h2>
            </div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {data.mastery.grandTotal} cards · {data.regions.length} regions
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {data.regions.map((region) => {
              const tint = REGION_TINT[region.id] || '#94A3B8';
              return (
                <button
                  key={region.id}
                  onClick={() => {
                    soundFx.playClick();
                    onStartSession(region.id, region.isWater ? ['location'] : selectedAttributes, region.caughtUp);
                  }}
                  className="group relative overflow-hidden rounded-[1.5rem] border-2 border-white/10 bg-white/[0.035] p-4 text-left transition-all hover:-translate-y-1 hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
                    style={{ background: tint }}
                  />

                  <span className="relative flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white/10 bg-[#170A2B]/70 text-xl">
                        {region.emblem}
                      </span>
                      <span>
                        <span className={`${display} block text-[15px] leading-tight tracking-[-0.01em] text-white`}>
                          {region.shortName.toUpperCase()}
                        </span>
                        <span className="mt-1 block font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          {region.subtitle.split(' · ')[0]}
                        </span>
                      </span>
                    </span>
                    <span className="font-mono text-2xl font-bold leading-none tabular-nums" style={{ color: tint }}>
                      {region.masteredPct}%
                    </span>
                  </span>

                  <span className="relative mt-4 block h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <span
                      className="block h-full rounded-full transition-all duration-500"
                      style={{ width: `${region.masteredPct}%`, background: tint }}
                    />
                  </span>

                  <span className="relative mt-3 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    <span>
                      <b className="text-white">{region.mastered}</b> mastered
                    </span>
                    <span className={region.recall > 0 ? 'text-[#FFC53D]' : undefined}>{region.recall} recall</span>
                  </span>

                  <span className="relative mt-4 flex items-center justify-center gap-1.5 rounded-full bg-white/[0.07] py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white transition-colors group-hover:bg-[#FF3D77] group-hover:text-[#2A0616]">
                    <Play className="h-3 w-3 fill-current" />
                    {region.caughtUp ? 'Practice' : `Play · ${region.dueCount} due`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ══ SCOREBOARD ══════════════════════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <Eyebrow>Lifetime telemetry</Eyebrow>
              <h2 className={`${display} mt-2 text-xl leading-none tracking-[-0.01em] text-white`}>YOUR NUMBERS</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatSlab
              label="Reviews"
              value={stats.totalReviews.toLocaleString()}
              note={`${data.reviewsToday} in the last 24 hours`}
              color={CYAN}
              icon={<Target className="h-4 w-4" />}
            />
            <StatSlab
              label="Accuracy"
              value={`${data.accuracy}%`}
              note="every prompt, all time"
              color={LIME}
              icon={<Gauge className="h-4 w-4" />}
            />
            <StatSlab
              label="Longest streak"
              value={`${stats.longestStreak}d`}
              note={`currently ${stats.currentStreak}d`}
              color={AMBER}
              icon={<Flame className="h-4 w-4" />}
            />
            <StatSlab
              label="In memory"
              value={`${data.entitiesInMemory}/${data.totalWorldEntities}`}
              note={`${data.pipeline.uncharted} still uncharted`}
              color="#C084FC"
              icon={<Trophy className="h-4 w-4" />}
            />
          </div>
        </section>

        {/* ══ NATION + PIPELINE ═══════════════════════════════════════════ */}
        <section className="grid gap-3 lg:grid-cols-3">
          {/* Nation of the moment */}
          <Slab className="relative overflow-hidden bg-gradient-to-br from-[#FF3D77]/[0.14] via-white/[0.035] to-transparent p-6 sm:p-7 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Eyebrow tone="accent">Nation of the moment</Eyebrow>
              <span className="rounded-full border-2 border-white/12 bg-white/[0.05] px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-slate-300">
                {data.spotlightStatus.label}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-5">
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-[1.25rem] border-2 border-white/10 bg-[#170A2B]/70 text-5xl">
                {data.spotlight.flagEmoji}
              </span>
              <div className="min-w-0">
                <p className={`${display} text-[2rem] leading-[0.95] tracking-[-0.025em] text-white`}>
                  {data.spotlight.name.toUpperCase()}
                </p>
                <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {data.spotlight.subregion} · {data.spotlight.continent}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-[#170A2B]/70 px-5 py-4">
              <div className="min-w-0">
                <Eyebrow>Capital</Eyebrow>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-white">
                  {revealCapital ? data.spotlight.capital : '• • • • • • • •'}
                </p>
              </div>
              <button
                onClick={() => {
                  setRevealCapital((v) => !v);
                  soundFx.playClick();
                }}
                className="flex items-center gap-2 rounded-full bg-[#22D3EE] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#0A2A33] transition-colors hover:bg-[#67E8F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
              >
                <Eye className="h-4 w-4" />
                {revealCapital ? 'Hide' : 'Reveal'}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-sm text-[13px] leading-relaxed text-slate-400">{data.spotlightStatus.hint}</p>
              <button
                onClick={() => onStartSession(data.spotlight.continent, ['capital', 'location'], true)}
                className="group flex items-center gap-2 rounded-full border-2 border-[#FF3D77]/40 bg-[#FF3D77]/12 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF8FB1] transition-colors hover:bg-[#FF3D77]/20"
              >
                Drill {data.spotlight.continent}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </Slab>

          {/* Memory pipeline */}
          <Slab className="p-6">
            <Eyebrow>Memory pipeline</Eyebrow>
            <p className="mt-3 font-mono text-[2.5rem] font-bold leading-none tabular-nums text-white">
              {data.pipeline.mastered + data.pipeline.recall}
              <span className="text-lg text-slate-500">/{data.pipeline.total}</span>
            </p>
            <p className="mt-2 text-[12px] text-slate-500">nations and seas held in memory</p>

            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full bg-[#FF3D77]"
                style={{ width: `${(data.pipeline.mastered / data.pipeline.total) * 100}%` }}
              />
              <div
                className="h-full bg-[#FFC53D]"
                style={{ width: `${(data.pipeline.recall / data.pipeline.total) * 100}%` }}
              />
              <div
                className="h-full bg-[#22D3EE]/70"
                style={{ width: `${(data.pipeline.recognition / data.pipeline.total) * 100}%` }}
              />
            </div>

            <ul className="mt-5 space-y-3">
              {[
                { label: 'Mastered', value: data.pipeline.mastered, color: MAGENTA },
                { label: 'Active recall', value: data.pipeline.recall, color: AMBER },
                { label: 'Scaffolded', value: data.pipeline.recognition, color: CYAN },
                { label: 'Uncharted', value: data.pipeline.uncharted, color: '#64748B' }
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <b className="font-mono text-[13px] font-bold tabular-nums text-white">{row.value}</b>
                </li>
              ))}
            </ul>
          </Slab>
        </section>

        {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-1 pt-5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
            GeoMastery · spaced repetition · drawn {today}
          </p>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
            {data.pipeline.total} cards in the deck
          </p>
        </footer>
      </div>
    </div>
  );
};

export default VelocityHome;
