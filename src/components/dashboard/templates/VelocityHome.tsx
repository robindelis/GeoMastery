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
  Gauge
} from 'lucide-react';
import { useHomeData, useDueBreakdown } from '../homeData';
import { useCountUp } from '../useCountUp';
import type { HomeViewProps } from '../homeTypes';
import { soundFx } from '../../../core/soundFx';

/* ────────────────────────────────────────────────────────────────────────────
 * TEMPLATE C — "VELOCITY DECK"
 * The same data rendered as a game: saturated violet space, heavy rounded slabs,
 * one loud magenta accent, oversized numerals that count up on arrival. The
 * signature is the run card — a streak-forward launch panel that treats today's
 * review queue as a score to beat.
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

const ChunkyButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'magenta' | 'ghost' | 'violet';
  className?: string;
}> = ({ children, onClick, tone = 'magenta', className = '' }) => {
  const tones: Record<string, string> = {
    magenta: 'bg-[#FF3D77] text-[#2A0616] shadow-[0_14px_34px_-12px_rgba(255,61,119,0.75)] hover:bg-[#FF5C91]',
    violet: 'bg-[#7C3AED] text-white shadow-[0_14px_34px_-12px_rgba(124,58,237,0.75)] hover:bg-[#8B5CF6]',
    ghost: 'border-2 border-white/15 bg-white/[0.04] text-white hover:border-white/35 hover:bg-white/[0.08]'
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-extrabold uppercase tracking-[0.02em] transition-all active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77] ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
};

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
    className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77] ${
      active ? 'border-[#FF3D77]/60 bg-[#FF3D77]/15 text-[#FF8FB1]' : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const StatSlab: React.FC<{
  label: string;
  value: React.ReactNode;
  note?: string;
  color: string;
  icon: React.ReactNode;
}> = ({ label, value, note, color, icon }) => (
  <div className="relative overflow-hidden rounded-3xl border-2 border-white/10 bg-white/[0.035] p-4">
    <span
      aria-hidden="true"
      className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl"
      style={{ background: color }}
    />
    <span
      className="flex h-10 w-10 items-center justify-center rounded-2xl"
      style={{ background: `${color}22`, color }}
    >
      {icon}
    </span>
    <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-white">{value}</p>
    {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
  </div>
);

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

  return (
    <div className="relative h-full overflow-y-auto bg-[#170A2B] text-white">
      {/* Saturated ambient field */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_-10%,#3B1063_0%,#1B0B33_45%,#12082A_100%)]" />
        <div className="animate-gm-drift absolute -left-24 top-10 h-[26rem] w-[26rem] rounded-full bg-[#FF3D77]/20 blur-[120px]" />
        <div className="animate-gm-drift absolute -right-20 top-1/3 h-[22rem] w-[22rem] rounded-full bg-[#22D3EE]/16 blur-[120px] [animation-delay:-6s]" />
        <div className="animate-gm-drift absolute bottom-0 left-1/3 h-[20rem] w-[20rem] rounded-full bg-[#7C3AED]/25 blur-[120px] [animation-delay:-11s]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.35]">
          <defs>
            <pattern id="velocity-grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M44 0 L0 0 0 44" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#velocity-grid)" />
        </svg>
      </div>

      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-7 sm:py-8">
        {/* ══ TOP BAR ════════════════════════════════════════════════════ */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF3D77] to-[#7C3AED] text-2xl shadow-[0_10px_28px_-10px_rgba(255,61,119,0.8)]">
              🌍
            </span>
            <div>
              <p className={`${display} text-lg leading-none tracking-[-0.01em] text-white`}>GEOMASTERY</p>
              <p className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.3em] text-[#FF8FB1]">
                daily run · level {data.rank.level}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-2xl border-2 border-[#FFC53D]/40 bg-[#FFC53D]/12 px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFC53D]">
              <Flame className="h-4 w-4 fill-[#FFC53D]" />
              {stats.currentStreak} day streak
            </span>
            <IconChip title={isSyncing ? 'Syncing…' : 'Sync progress with GitHub'} onClick={onSyncGitHub}>
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </IconChip>
            <IconChip title="GitHub token (two-way push from mobile)" active={Boolean(settings.githubSyncToken)} onClick={() => setShowToken((v) => !v)}>
              <KeyRound className="h-4 w-4" />
            </IconChip>
            <IconChip title={settings.audioEnabled ? 'Mute sound effects' : 'Enable sound effects'} onClick={onToggleSound} active={settings.audioEnabled}>
              {settings.audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </IconChip>
            <IconChip title="Export progress backup (JSON)" onClick={onExportBackup}>
              <Download className="h-4 w-4" />
            </IconChip>
            <label
              title="Import progress backup (JSON)"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-2xl border-2 border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:border-white/25 hover:text-white"
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

          {syncStatusMessage && (
            <p className="w-full rounded-2xl border-2 border-[#A3E635]/40 bg-[#A3E635]/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#D9F99D]">
              {syncStatusMessage}
            </p>
          )}

          {showToken && (
            <div className="w-full rounded-3xl border-2 border-white/12 bg-[#1B0B33]/95 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                GitHub token · pushes progress from mobile (scope: repo, contents:write)
              </p>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  className="flex-1 rounded-2xl border-2 border-white/12 bg-white/[0.04] px-3.5 py-2.5 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#FF3D77] focus:outline-none"
                />
                <ChunkyButton
                  tone="violet"
                  className="px-5 py-2.5"
                  onClick={() => {
                    onSaveGithubToken(tokenDraft.trim());
                    setShowToken(false);
                  }}
                >
                  Save
                </ChunkyButton>
              </div>
            </div>
          )}
        </header>

        {/* ══ RUN CARD (signature) ═══════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-[2rem] border-2 border-white/12 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent p-6 sm:p-9">
          <span aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#FF3D77]/25 blur-[90px]" />
          <span aria-hidden="true" className="absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-[#22D3EE]/18 blur-[90px]" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#FF8FB1]">
                <Sparkles className="h-3.5 w-3.5" />
                {data.totalDueCount > 0 ? 'Queue ready' : 'Queue clear'}
              </p>
              <h1 className={`${display} mt-3 text-[2.4rem] leading-[0.95] tracking-[-0.03em] text-white sm:text-[3.2rem]`}>
                KEEP THE
                <br />
                <span className="bg-gradient-to-r from-[#FF3D77] to-[#FFC53D] bg-clip-text text-transparent">STREAK ALIVE</span>
              </h1>
              <p className="mt-4 text-[14px] leading-relaxed text-slate-300">
                {data.totalDueCount > 0
                  ? `${dueValue} cards are waiting. Two correct answers in a row masters each one.`
                  : 'Every card is scheduled ahead — run a practice drill to sharpen what you know.'}
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {[
                  { attr: 'capital' as const, label: 'Capitals', glyph: '🏛️', tint: '#22D3EE' },
                  { attr: 'location' as const, label: 'Locations', glyph: '📍', tint: '#A3E635' }
                ].map((pill) => {
                  const on = selectedAttributes.includes(pill.attr);
                  return (
                    <button
                      key={pill.attr}
                      onClick={() => onToggleAttribute(pill.attr)}
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.04em] transition-all active:scale-95 ${
                        on ? 'text-[#170A2B]' : 'border-white/12 bg-white/[0.04] text-slate-400 hover:text-white'
                      }`}
                      style={on ? { background: pill.tint, borderColor: pill.tint } : undefined}
                    >
                      <span aria-hidden="true">{pill.glyph}</span>
                      {pill.label}
                      <span className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-[#170A2B]' : 'bg-slate-600'}`} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <ChunkyButton
                  className="px-8 py-4 text-base"
                  onClick={() => {
                    soundFx.playClick();
                    onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                  }}
                >
                  <Play className="h-5 w-5 fill-current" />
                  Train world
                </ChunkyButton>
                <ChunkyButton tone="ghost" className="px-5 py-3.5" onClick={onOpenAtlas}>
                  <Compass className="h-4 w-4" />
                  Atlas
                </ChunkyButton>
                <ChunkyButton tone="ghost" className="px-5 py-3.5" onClick={onOpenArcade}>
                  <Zap className="h-4 w-4 fill-current" />
                  Arcade
                </ChunkyButton>
              </div>

              <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {data.totalDueCount > 0
                  ? `${due.capital} capitals · ${due.location} locations · ${data.reviewsToday} reviewed today`
                  : `${data.reviewsToday} cards reviewed today`}
              </p>
            </div>

            {/* Score panel */}
            <div className="flex shrink-0 flex-col items-center gap-6 rounded-[1.75rem] border-2 border-white/10 bg-[#170A2B]/60 p-6 backdrop-blur-sm sm:flex-row lg:flex-col">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <defs>
                    <linearGradient id="velocity-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={MAGENTA} />
                      <stop offset="100%" stopColor={CYAN} />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r={ringRadius} className="stroke-white/8" strokeWidth="11" fill="transparent" />
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
                  <span className="font-mono text-3xl font-bold tabular-nums text-white">{masteryValue}%</span>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">mastered</span>
                </div>
              </div>

              <div className="w-full min-w-[190px]">
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Rank</p>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFC53D]">Lvl {data.rank.level}</p>
                </div>
                <p className="mt-1 text-[15px] font-extrabold text-white">{data.rank.title}</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FFC53D] to-[#FF3D77] transition-all duration-700"
                    style={{ width: `${data.rank.progress}%` }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  {data.rank.xp.toLocaleString()} / {data.rank.nextXP.toLocaleString()} xp
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ REGION ARCADE TILES ════════════════════════════════════════ */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h2 className={`${display} text-2xl tracking-[-0.02em] text-white`}>PICK YOUR MAP</h2>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {data.totalWorldEntities} cards across {data.regions.length} regions
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {data.regions.map((region) => (
              <button
                key={region.id}
                onClick={() => {
                  soundFx.playClick();
                  onStartSession(region.id, region.isWater ? ['location'] : selectedAttributes, region.caughtUp);
                }}
                className="group relative overflow-hidden rounded-3xl border-2 border-white/10 bg-white/[0.035] p-5 text-left transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D77]"
              >
                <span
                  aria-hidden="true"
                  className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
                  style={{ background: REGION_TINT[region.id] }}
                />
                <span className="relative flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white/10 bg-[#170A2B]/60 text-2xl">
                    {region.emblem}
                  </span>
                  <span
                    className="font-mono text-2xl font-bold tabular-nums"
                    style={{ color: REGION_TINT[region.id] }}
                  >
                    {region.masteredPct}%
                  </span>
                </span>

                <span className="relative mt-4 block">
                  <span className={`${display} block text-lg leading-tight text-white`}>{region.shortName.toUpperCase()}</span>
                  <span className="mt-0.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {region.subtitle}
                  </span>
                </span>

                <span className="relative mt-4 block h-2.5 overflow-hidden rounded-full bg-white/8">
                  <span
                    className="block h-full rounded-full transition-all duration-500"
                    style={{ width: `${region.masteredPct}%`, background: REGION_TINT[region.id] }}
                  />
                </span>
                <span className="relative mt-3 flex items-center justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  <span>
                    <b className="text-white">{region.mastered}</b> mastered
                  </span>
                  <span style={{ color: region.recall > 0 ? AMBER : undefined }}>{region.recall} recall</span>
                </span>

                <span className="relative mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-white/8 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors group-hover:bg-[#FF3D77] group-hover:text-[#2A0616]">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {region.caughtUp ? 'Practice' : `${region.dueCount} due`}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ══ SCOREBOARD ═════════════════════════════════════════════════ */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatSlab label="Reviews" value={stats.totalReviews.toLocaleString()} note={`${data.reviewsToday} in 24h`} color={CYAN} icon={<Target className="h-5 w-5" />} />
          <StatSlab label="Accuracy" value={`${data.accuracy}%`} note="all time" color={LIME} icon={<Gauge className="h-5 w-5" />} />
          <StatSlab
            label="Streak"
            value={`${stats.currentStreak}d`}
            note={`record ${stats.longestStreak}d`}
            color={AMBER}
            icon={<Flame className="h-5 w-5" />}
          />
          <StatSlab
            label="In memory"
            value={`${data.entitiesInMemory}/${data.totalWorldEntities}`}
            note={`${data.pipeline.uncharted} uncharted`}
            color="#C084FC"
            icon={<Trophy className="h-5 w-5" />}
          />
        </section>

        {/* ══ NATION OF THE MOMENT ═══════════════════════════════════════ */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-white/12 bg-gradient-to-br from-[#FF3D77]/15 via-white/[0.03] to-transparent p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#FF8FB1]">Nation of the moment</p>
              <span className="rounded-full border-2 border-white/15 bg-white/[0.05] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
                {data.spotlightStatus.label}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-5">
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-white/12 bg-[#170A2B]/70 text-5xl">
                {data.spotlight.flagEmoji}
              </span>
              <div className="min-w-0">
                <p className={`${display} text-3xl leading-none tracking-[-0.02em] text-white`}>
                  {data.spotlight.name.toUpperCase()}
                </p>
                <p className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {data.spotlight.subregion} · {data.spotlight.continent}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-white/10 bg-[#170A2B]/70 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Capital</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {revealCapital ? data.spotlight.capital : '• • • • • • • •'}
                </p>
              </div>
              <button
                onClick={() => {
                  setRevealCapital((v) => !v);
                  soundFx.playClick();
                }}
                className="flex items-center gap-1.5 rounded-2xl bg-[#22D3EE] px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#0A2A33] transition-colors hover:bg-[#67E8F9]"
              >
                <Eye className="h-4 w-4" />
                {revealCapital ? 'Hide' : 'Reveal'}
              </button>
            </div>

            <p className="mt-3 text-[13px] text-slate-400">{data.spotlightStatus.hint}</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[2rem] border-2 border-white/12 bg-white/[0.035] p-6">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Memory pipeline</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-white">
                {data.pipeline.mastered + data.pipeline.recall}
                <span className="text-base text-slate-500">/{data.pipeline.total}</span>
              </p>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/8">
                <div className="h-full bg-[#FF3D77]" style={{ width: `${(data.pipeline.mastered / data.pipeline.total) * 100}%` }} />
                <div className="h-full bg-[#FFC53D]" style={{ width: `${(data.pipeline.recall / data.pipeline.total) * 100}%` }} />
                <div className="h-full bg-[#22D3EE]/70" style={{ width: `${(data.pipeline.recognition / data.pipeline.total) * 100}%` }} />
              </div>
              <ul className="mt-4 space-y-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#FF3D77]" />
                    Mastered
                  </span>
                  <b className="text-white">{data.pipeline.mastered}</b>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#FFC53D]" />
                    Active recall
                  </span>
                  <b className="text-white">{data.pipeline.recall}</b>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#22D3EE]" />
                    Scaffolded
                  </span>
                  <b className="text-white">{data.pipeline.recognition}</b>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-600" />
                    Uncharted
                  </span>
                  <b className="text-slate-300">{data.pipeline.uncharted}</b>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onStartSession(data.spotlight.continent, ['capital', 'location'], true)}
              className="group flex items-center justify-between gap-3 rounded-[2rem] border-2 border-[#FF3D77]/35 bg-[#FF3D77]/12 px-6 py-5 text-left transition-colors hover:bg-[#FF3D77]/20"
            >
              <span>
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF8FB1]">Challenge</span>
                <span className={`${display} mt-1 block text-xl text-white`}>DRILL {data.spotlight.continent.toUpperCase()}</span>
              </span>
              <Play className="h-7 w-7 shrink-0 fill-[#FF8FB1] text-[#FF8FB1] transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default VelocityHome;
