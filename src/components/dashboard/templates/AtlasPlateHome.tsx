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
  ArrowUpRight
} from 'lucide-react';
import { useHomeData, useDueBreakdown } from '../homeData';
import { useCountUp } from '../useCountUp';
import type { HomeViewProps, RegionModel } from '../homeTypes';
import { soundFx } from '../../../core/soundFx';

/* ────────────────────────────────────────────────────────────────────────────
 * TEMPLATE B — "ATLAS PLATE"
 * A printed plate from a scientific atlas: warm paper stock, prussian blue ink,
 * hairline rules, no shadows, no rounded corners. Type does the work — a
 * high-contrast serif for the plate title and every figure that matters, mono
 * for marginalia. The signature is the plate key: one full-width proportional
 * band that splits the world's cards by region and adds up to 100%.
 * ──────────────────────────────────────────────────────────────────────────── */

const INK = '#16191D';
const INK_SOFT = '#5C6167';
const RULE = '#CFC8B8';
const PRUSSIAN = '#1B4DB1';
const GREEN = '#1E6B52';
const OCHRE = '#A9700F';

const REGION_INK: Record<string, string> = {
  Europe: PRUSSIAN,
  Asia: GREEN,
  Africa: OCHRE,
  Americas: '#8A3324',
  Oceania: '#3F6C9E',
  Oceans: '#4B4E8C'
};

const serif = 'font-[family-name:var(--font-fraunces)]';

const PlateButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'quiet';
  className?: string;
}> = ({ children, onClick, variant = 'primary', className = '' }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 rounded-[2px] px-5 py-3 text-[13px] font-semibold tracking-[-0.01em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4DB1] ${
      variant === 'primary'
        ? 'bg-[#1B4DB1] text-[#F6F3EC] hover:bg-[#153F8F]'
        : 'border border-[#CFC8B8] bg-transparent text-[#16191D] hover:border-[#16191D]'
    } ${className}`}
  >
    {children}
  </button>
);

const PlateIconButton: React.FC<{
  title: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, active = false, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`flex h-8 w-8 items-center justify-center rounded-[2px] border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4DB1] ${
      active
        ? 'border-[#1B4DB1] bg-[#1B4DB1] text-[#F6F3EC]'
        : 'border-[#CFC8B8] text-[#5C6167] hover:border-[#16191D] hover:text-[#16191D]'
    }`}
  >
    {children}
  </button>
);

const AtlasPlateHome: React.FC<HomeViewProps> = (props) => {
  const {
    srsItemsMap,
    stats,
    settings,
    selectedAttributes,
    isSyncing,
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

  const masteryValue = useCountUp(data.mastery.masteryPercentage, 1100);
  const recallValue = useCountUp(data.mastery.learningPercentage, 1100);

  const today = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  const focusPills: Array<{ attr: 'capital' | 'location'; label: string; note: string }> = [
    { attr: 'capital', label: 'Capital cities', note: 'name the seat of government' },
    { attr: 'location', label: 'Map locations', note: 'place the nation on the map' }
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F6F3EC] text-[#16191D]">
      {/* Paper stock + faint grid */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.5]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="plate-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0 L0 0 0 28" fill="none" stroke="rgba(22,25,29,0.045)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#plate-grid)" />
        </svg>
      </div>

      <div className="relative mx-auto w-full max-w-[1380px] px-5 py-8 sm:px-9 sm:py-11 lg:px-14">
        {/* ══ PLATE HEADER ═══════════════════════════════════════════════ */}
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.34em] text-[#5C6167]">
              Plate I · the daily survey
            </p>
            <h1 className={`${serif} mt-2 text-[2.1rem] font-semibold italic leading-[0.95] tracking-[-0.02em] text-[#16191D] sm:text-[2.7rem]`}>
              GeoMastery
            </h1>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[#5C6167]">
              A spaced-repetition atlas of 196 sovereign states and 40 maritime bodies. Drawn {today}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-[2px] border border-[#CFC8B8] px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#16191D]">
              <Flame className="h-3.5 w-3.5 text-[#A9700F]" />
              {stats.currentStreak} day streak
            </span>
            <PlateIconButton title={isSyncing ? 'Syncing…' : 'Sync progress with GitHub'} onClick={onSyncGitHub}>
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </PlateIconButton>
            <PlateIconButton
              title="GitHub token (two-way push from mobile)"
              active={Boolean(settings.githubSyncToken)}
              onClick={() => setShowToken((v) => !v)}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </PlateIconButton>
            <PlateIconButton
              title={settings.audioEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              onClick={onToggleSound}
              active={settings.audioEnabled}
            >
              {settings.audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </PlateIconButton>
            <PlateIconButton title="Export progress backup (JSON)" onClick={onExportBackup}>
              <Download className="h-3.5 w-3.5" />
            </PlateIconButton>
            <label
              title="Import progress backup (JSON)"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-[#CFC8B8] text-[#5C6167] transition-colors hover:border-[#16191D] hover:text-[#16191D]"
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

          {showToken && (
            <div className="w-full rounded-[2px] border border-[#CFC8B8] bg-[#EFEBE1] p-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C6167]">
                Optional token · pushes progress from mobile to GitHub (scope: repo, contents:write)
              </p>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  className="flex-1 rounded-[2px] border border-[#CFC8B8] bg-[#F6F3EC] px-3 py-2 font-mono text-xs text-[#16191D] placeholder:text-[#9C968A] focus:border-[#1B4DB1] focus:outline-none"
                />
                <PlateButton
                  onClick={() => {
                    onSaveGithubToken(tokenDraft.trim());
                    setShowToken(false);
                  }}
                >
                  Save token
                </PlateButton>
              </div>
            </div>
          )}
        </header>

        <div className="mt-7 h-px w-full bg-[#16191D]" />

        {/* ══ HERO ═══════════════════════════════════════════════════════ */}
        <section className="grid gap-10 py-9 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.32em] text-[#1B4DB1]">Today’s survey</p>
            <h2 className={`${serif} mt-4 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.025em] text-[#16191D] sm:text-[3.4rem]`}>
              The world,
              <br />
              <span className="italic">one card</span> at a time.
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-[1.7] text-[#5C6167]">
              Cards arrive on a schedule tuned to your memory. Answer a nation twice in a row from memory and it is
              mastered — the queue then opens the next frontier.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {focusPills.map((pill) => {
                const on = selectedAttributes.includes(pill.attr);
                return (
                  <button
                    key={pill.attr}
                    onClick={() => onToggleAttribute(pill.attr)}
                    aria-pressed={on}
                    title={pill.note}
                    className={`flex items-center gap-2.5 rounded-[2px] border px-3.5 py-2 text-left text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4DB1] ${
                      on
                        ? 'border-[#16191D] bg-[#16191D] text-[#F6F3EC]'
                        : 'border-[#CFC8B8] text-[#5C6167] hover:border-[#16191D] hover:text-[#16191D]'
                    }`}
                  >
                    <span aria-hidden="true" className="text-[13px]">
                      {pill.attr === 'capital' ? '🏛️' : '📍'}
                    </span>
                    {pill.label}
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full border ${on ? 'border-[#F6F3EC] bg-[#F6F3EC]' : 'border-[#CFC8B8]'}`} />
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PlateButton
                onClick={() => {
                  soundFx.playClick();
                  onStartSession('All', selectedAttributes, data.isCaughtUp('All'));
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                {data.totalDueCount > 0 ? `Begin the review — ${data.totalDueCount} cards` : 'Review the atlas'}
              </PlateButton>
              <PlateButton variant="quiet" onClick={onOpenAtlas}>
                <Compass className="h-4 w-4" />
                Open the atlas
              </PlateButton>
              <button
                onClick={onOpenArcade}
                className="inline-flex items-center gap-1.5 px-1 text-[13px] font-medium text-[#1B4DB1] underline decoration-[#1B4DB1]/40 decoration-1 underline-offset-4 transition-colors hover:decoration-[#1B4DB1]"
              >
                <Zap className="h-3.5 w-3.5" />
                Time-attack blitz
              </button>
            </div>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C6167]">
              {data.totalDueCount > 0
                ? `${due.capital} capitals · ${due.location} locations queued`
                : 'Queue clear — every card is scheduled ahead'}
            </p>
          </div>

          {/* Mastered figure */}
          <div className="lg:col-span-5 lg:border-l lg:border-[#CFC8B8] lg:pl-12">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-[#5C6167]">
              Figure 1 · mastery of the deck
            </p>
            <div className="mt-3 flex items-end gap-3">
              <span className={`${serif} text-[5.2rem] font-semibold leading-[0.82] tracking-[-0.04em] text-[#16191D]`}>
                {masteryValue}
              </span>
              <span className={`${serif} pb-2 text-2xl font-semibold text-[#1E6B52]`}>%</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#5C6167]">
              of <b className="text-[#16191D]">{data.mastery.grandTotal}</b> cards mastered. A further{' '}
              <b className="text-[#A9700F]">{data.mastery.globalStage1}</b> sit in active recall.
            </p>

            <div className="mt-6 space-y-3">
              {[
                { label: 'Mastered', value: data.mastery.globalStage2, color: GREEN },
                { label: 'Active recall', value: data.mastery.globalStage1, color: OCHRE },
                { label: 'Not yet introduced', value: data.mastery.globalStage0, color: '#B4AE9F' }
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                  <span className="flex-1 text-[12px] text-[#5C6167]">{row.label}</span>
                  <span className="font-mono text-[12px] font-medium tabular-nums text-[#16191D]">
                    {row.value}
                    <span className="text-[#9C968A]">
                      {' '}
                      / {data.mastery.grandTotal}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PLATE KEY (signature) ═════════════════════════════════════ */}
        <section className="border-y border-[#16191D] py-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-[#16191D]">The plate key</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C6167]">
              Segments are proportional to cards · {data.mastery.grandTotal} total
            </p>
          </div>

          {/* Proportional band */}
          <div className="mt-4 flex h-11 w-full overflow-hidden rounded-[2px] border border-[#16191D]">
            {data.regions.map((region) => {
              const width = (region.total / data.mastery.grandTotal) * 100;
              return (
                <div
                  key={region.id}
                  className="relative h-full transition-[filter] hover:brightness-110"
                  style={{ width: `${width}%`, background: REGION_INK[region.id] || '#B4AE9F' }}
                  title={`${region.name}: ${region.total} cards`}
                >
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-medium tabular-nums text-[#F6F3EC] mix-blend-luminosity">
                    {region.total}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Scale ticks */}
          <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-[#9C968A]">
            <span>0</span>
            <span>120</span>
            <span>240</span>
            <span>360</span>
            <span>{data.mastery.grandTotal} cards</span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            {data.regions.map((region) => (
              <div key={region.id} className="border-t border-[#CFC8B8] pt-2">
                <dt className="flex items-center gap-1.5 text-[12px] font-medium text-[#16191D]">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: REGION_INK[region.id] }} />
                  {region.shortName}
                </dt>
                <dd className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C6167]">
                  {region.mastered}/{region.total} · {region.masteredPct}%
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ══ REGIONAL INDEX + FIELD NOTES ═══════════════════════════════ */}
        <section className="grid gap-12 py-10 lg:grid-cols-12 lg:gap-14">
          {/* Regional index */}
          <div className="lg:col-span-7">
            <div className="flex items-baseline justify-between">
              <h3 className={`${serif} text-2xl font-semibold tracking-[-0.02em] text-[#16191D]`}>Regional index</h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C6167]">Select a region to drill</p>
            </div>

            <ul className="mt-5 border-t border-[#16191D]">
              {data.regions.map((region: RegionModel) => (
                <li key={region.id} className="border-b border-[#CFC8B8]">
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      onStartSession(region.id, region.isWater ? ['location'] : selectedAttributes, region.caughtUp);
                    }}
                    className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 py-4 text-left transition-colors hover:bg-[#EFEBE1]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1B4DB1]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#CFC8B8] bg-[#EFEBE1] text-xl">
                      {region.emblem}
                    </span>

                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#16191D]">{region.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C6167]">
                          {region.subtitle}
                        </span>
                      </span>
                      <span className="mt-2 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E2DDD1]">
                          <span
                            className="block h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${region.masteredPct}%`,
                              background: REGION_INK[region.id] || '#B4AE9F'
                            }}
                          />
                        </span>
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E2DDD1]">
                          <span
                            className="block h-full rounded-full bg-[#A9700F] transition-all duration-500"
                            style={{ width: `${region.recallPct}%` }}
                          />
                        </span>
                      </span>
                    </span>

                    <span className="flex items-center gap-3">
                      <span className="text-right">
                        <span className="block font-mono text-[15px] font-medium tabular-nums text-[#16191D]">
                          {region.masteredPct}%
                        </span>
                        <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[#5C6167]">
                          {region.caughtUp ? `${region.dueCount === 0 ? 'caught up' : 'review'}` : `${region.dueCount} due`}
                        </span>
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#CFC8B8] text-[#5C6167] transition-colors group-hover:border-[#16191D] group-hover:bg-[#16191D] group-hover:text-[#F6F3EC]">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Field notes */}
          <div className="flex flex-col gap-8 lg:col-span-5">
            {/* Spotlight */}
            <div className="rounded-[2px] border border-[#16191D] bg-[#EFEBE1] p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[#1B4DB1]">Field note</p>
                <span className="rounded-[2px] border border-[#CFC8B8] bg-[#F6F3EC] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#5C6167]">
                  {data.spotlightStatus.label}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-[2px] border border-[#CFC8B8] bg-[#F6F3EC] text-4xl">
                  {data.spotlight.flagEmoji}
                </span>
                <div>
                  <p className={`${serif} text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#16191D]`}>
                    {data.spotlight.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C6167]">
                    {data.spotlight.subregion} · {data.spotlight.continent}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 rounded-[2px] border border-[#CFC8B8] bg-[#F6F3EC] px-3.5 py-2.5">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C6167]">Capital</p>
                  <p className={`${serif} mt-0.5 text-lg font-semibold text-[#16191D]`}>
                    {revealCapital ? data.spotlight.capital : '• • • • • • • •'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRevealCapital((v) => !v);
                    soundFx.playClick();
                  }}
                  className="flex items-center gap-1.5 rounded-[2px] border border-[#16191D] px-3 py-1.5 text-[11px] font-medium text-[#16191D] transition-colors hover:bg-[#16191D] hover:text-[#F6F3EC]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {revealCapital ? 'Hide' : 'Reveal'}
                </button>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-[#5C6167]">{data.spotlightStatus.hint}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <PlateButton
                  variant="quiet"
                  className="px-3.5 py-2 text-[12px]"
                  onClick={() => onStartSession(data.spotlight.continent, ['capital', 'location'], true)}
                >
                  Drill {data.spotlight.continent}
                </PlateButton>
                <PlateButton variant="quiet" className="px-3.5 py-2 text-[12px]" onClick={onOpenAtlas}>
                  Full dossier
                </PlateButton>
              </div>
            </div>

            {/* Ledger */}
            <div>
              <div className="flex items-baseline justify-between">
                <h3 className={`${serif} text-xl font-semibold tracking-[-0.02em] text-[#16191D]`}>The ledger</h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C6167]">lifetime</p>
              </div>
              <dl className="mt-4 border-t border-[#16191D]">
                {[
                  { label: 'Reviews logged', value: stats.totalReviews.toLocaleString(), note: `${data.reviewsToday} in the last 24 hours` },
                  { label: 'Overall accuracy', value: `${data.accuracy}%`, note: 'every prompt, all time' },
                  { label: 'Streak', value: `${stats.currentStreak} days`, note: `record ${stats.longestStreak} days` },
                  {
                    label: 'Nations & seas in memory',
                    value: `${data.entitiesInMemory} / ${data.totalWorldEntities}`,
                    note: `${data.pipeline.uncharted} still uncharted`
                  }
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-[#CFC8B8] py-3">
                    <dt>
                      <span className="block text-[13px] font-medium text-[#16191D]">{row.label}</span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[#5C6167]">
                        {row.note}
                      </span>
                    </dt>
                    <dd className="font-mono text-[15px] font-medium tabular-nums text-[#16191D]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Expedition rank */}
            <div className="rounded-[2px] border border-[#CFC8B8] p-5">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-[#5C6167]">Expedition rank</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1B4DB1]">Level {data.rank.level}</p>
              </div>
              <p className={`${serif} mt-2 text-2xl font-semibold italic tracking-[-0.02em] text-[#16191D]`}>
                {data.rank.title}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2DDD1]">
                <div className="h-full rounded-full bg-[#1B4DB1] transition-all duration-700" style={{ width: `${data.rank.progress}%` }} />
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C6167]">
                {data.rank.xp.toLocaleString()} of {data.rank.nextXP.toLocaleString()} survey points
              </p>
            </div>
          </div>
        </section>

        {/* ══ PLATE FOOTER ═══════════════════════════════════════════════ */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#16191D] pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C6167]">
            Plate I · drawn from {data.pipeline.total} cards · {data.pipeline.mastered} mastered ·{' '}
            {data.pipeline.recognition} on scaffolding
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9C968A]">
            GeoMastery · survey of {today}
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AtlasPlateHome;
