import React, { useState, useMemo } from 'react';
import { JournalEntry, ClientDossier } from '../types';
import { useTheme } from '../context/ThemeContext';
import { computeFlows, computeTreasury, isoDate } from '../utils/analytics';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Activity, 
  Sparkles,
  Info
} from 'lucide-react';

interface EvolutionChartProps {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
  compact?: boolean;
}

type Period = '7d' | '30d' | '90d' | '12m';
type MetricView = 'cashflow' | 'income_expense' | 'net_margin';

interface DataPoint {
  label: string;
  fullDate: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulativeBalance: number;
}

export const EvolutionChart: React.FC<EvolutionChartProps> = ({
  entries,
  activeDossier,
  compact = false
}) => {
  const { isDark } = useTheme();
  const [period, setPeriod] = useState<Period>('30d');
  const [metricView, setMetricView] = useState<MetricView>('cashflow');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter entries for the current dossier
  const dossierEntries = useMemo(() => {
    return entries.filter(e => e.clientDossierId === activeDossier.id);
  }, [entries, activeDossier.id]);

  // Trajectoire réelle : chaque point agrège les écritures de sa période ; le solde cumulé part du
  // solde réel de trésorerie à l'ouverture de la première période (aucune donnée simulée).
  const dataPoints: DataPoint[] = useMemo(() => {
    const now = new Date();
    const dayStart = (offsetDays: number) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - offsetDays);
      return d;
    };

    interface Bucket { label: string; fullDate: string; from: string; to: string }
    const buckets: Bucket[] = [];

    if (period === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = dayStart(i);
        buckets.push({
          label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
          fullDate: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          from: isoDate(d), to: isoDate(d)
        });
      }
    } else if (period === '30d' || period === '90d') {
      const span = period === '30d' ? 5 : 7;
      const count = period === '30d' ? 6 : 12;
      for (let k = count - 1; k >= 0; k--) {
        const start = dayStart(k * span + span - 1);
        const end = dayStart(k * span);
        buckets.push({
          label: period === '30d' ? start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : `Sem ${count - k}`,
          fullDate: `Du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
          from: isoDate(start), to: isoDate(end)
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        buckets.push({
          label: first.toLocaleDateString('fr-FR', { month: 'short' }),
          fullDate: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          from: isoDate(first), to: isoDate(last)
        });
      }
    }

    let balance = computeTreasury(dossierEntries.filter(e => e.date < buckets[0].from)).total;
    return buckets.map(b => {
      const flows = computeFlows(dossierEntries, b.from, b.to);
      const net = flows.cashIn - flows.cashOut;
      balance += net;
      return { label: b.label, fullDate: b.fullDate, inflow: flows.cashIn, outflow: flows.cashOut, net, cumulativeBalance: balance };
    });
  }, [period, dossierEntries]);

  // Aggregate totals
  const totalInflow = useMemo(() => dataPoints.reduce((acc, p) => acc + p.inflow, 0), [dataPoints]);
  const totalOutflow = useMemo(() => dataPoints.reduce((acc, p) => acc + p.outflow, 0), [dataPoints]);
  const totalNet = totalInflow - totalOutflow;
  const lastBalance = dataPoints[dataPoints.length - 1]?.cumulativeBalance || 0;
  const firstBalance = dataPoints[0]?.cumulativeBalance || 0;
  const growthRate = firstBalance > 0 ? Math.round(((lastBalance - firstBalance) / firstBalance) * 100) : 0;

  // SVG dimensions
  const svgWidth = 700;
  const svgHeight = compact ? 220 : 280;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  // Min and Max values for scale
  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    if (metricView === 'cashflow') {
      dataPoints.forEach(p => {
        if (p.cumulativeBalance < min) min = p.cumulativeBalance;
        if (p.cumulativeBalance > max) max = p.cumulativeBalance;
      });
      min = Math.max(0, Math.floor(min * 0.85));
      max = Math.ceil(max * 1.12);
    } else if (metricView === 'income_expense') {
      dataPoints.forEach(p => {
        if (p.inflow > max) max = p.inflow;
        if (p.outflow > max) max = p.outflow;
      });
      min = 0;
      max = Math.ceil(max * 1.15);
    } else {
      dataPoints.forEach(p => {
        if (p.net < min) min = p.net;
        if (p.net > max) max = p.net;
      });
      const absMax = Math.max(Math.abs(min), Math.abs(max)) * 1.2;
      min = -absMax;
      max = absMax;
    }

    if (max <= min) {
      max = min + 100000;
    }

    return { minVal: min, maxVal: max };
  }, [dataPoints, metricView]);

  // Coordinate mapping
  const getX = (index: number) => {
    if (dataPoints.length <= 1) return padLeft + chartWidth / 2;
    return padLeft + (index / (dataPoints.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const range = maxVal - minVal;
    if (range === 0) return padTop + chartHeight / 2;
    const ratio = (val - minVal) / range;
    return padTop + chartHeight - ratio * chartHeight;
  };

  // Build SVG path data for smooth curved line
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    const points = values.map((val, idx) => ({ x: getX(idx), y: getY(val) }));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  // Area path (closed at bottom)
  const buildAreaPath = (pathString: string, baselineY = padTop + chartHeight) => {
    if (!pathString) return '';
    const startX = getX(0);
    const endX = getX(dataPoints.length - 1);
    return `${pathString} L ${endX} ${baselineY} L ${startX} ${baselineY} Z`;
  };

  const balancePath = useMemo(() => buildSmoothPath(dataPoints.map(p => p.cumulativeBalance)), [dataPoints, minVal, maxVal]);
  const balanceArea = useMemo(() => buildAreaPath(balancePath), [balancePath, dataPoints]);

  const inflowPath = useMemo(() => buildSmoothPath(dataPoints.map(p => p.inflow)), [dataPoints, minVal, maxVal]);
  const inflowArea = useMemo(() => buildAreaPath(inflowPath), [inflowPath, dataPoints]);

  const outflowPath = useMemo(() => buildSmoothPath(dataPoints.map(p => p.outflow)), [dataPoints, minVal, maxVal]);
  const outflowArea = useMemo(() => buildAreaPath(outflowPath), [outflowPath, dataPoints]);

  // Selected or active hover point
  const activePoint = hoveredIndex !== null ? dataPoints[hoveredIndex] : dataPoints[dataPoints.length - 1];

  // Grid tick marks
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i <= count; i++) {
      const val = minVal + (i / count) * (maxVal - minVal);
      ticks.push({
        val,
        y: getY(val),
        label: val >= 1000000 
          ? `${(val / 1000000).toFixed(1)}M` 
          : val >= 1000 
          ? `${Math.round(val / 1000)}k` 
          : `${Math.round(val)}`
      });
    }
    return ticks;
  }, [minVal, maxVal]);

  return (
    <div className={`card-fintech p-5 rounded-2xl border transition-all ${
      isDark 
        ? 'bg-[#150A2A] border-[#2D1A54] text-[#F3EFFF]' 
        : 'bg-white border-[#DDD6FE] text-[#1E084A]'
    }`}>
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#EDE9FE] dark:border-[#2D1A54]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#F5F3FF] dark:bg-[#20103E] text-[#7024E3] dark:text-[#A78BFA]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black font-heading tracking-wide flex items-center gap-2">
                <span>Graphique d'Évolution & Trésorerie</span>
                <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#059669] dark:text-[#34D399] font-bold">
                  Temps Réel
                </span>
              </h3>
              <p className="text-[12px] text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                Trajectoire financière, flux de liquidités et projections d'exploitation
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Mode Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric View Switcher */}
          <div className="flex items-center p-1 bg-[#F5F3FF] dark:bg-[#1C0F38] rounded-xl border border-[#DDD6FE] dark:border-[#35225E] text-xs">
            <button
              onClick={() => setMetricView('cashflow')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                metricView === 'cashflow'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#7C709A] dark:text-[#C4B5FD] hover:text-[#1E084A] dark:hover:text-white'
              }`}
            >
              Solde Trésorerie
            </button>
            <button
              onClick={() => setMetricView('income_expense')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                metricView === 'income_expense'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#7C709A] dark:text-[#C4B5FD] hover:text-[#1E084A] dark:hover:text-white'
              }`}
            >
              Flux Entrées / Sorties
            </button>
            <button
              onClick={() => setMetricView('net_margin')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                metricView === 'net_margin'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#7C709A] dark:text-[#C4B5FD] hover:text-[#1E084A] dark:hover:text-white'
              }`}
            >
              Marge Nette
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex items-center p-1 bg-[#F5F3FF] dark:bg-[#1C0F38] rounded-xl border border-[#DDD6FE] dark:border-[#35225E] text-xs font-bold">
            {(['7d', '30d', '90d', '12m'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  setHoveredIndex(null);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  period === p
                    ? 'bg-white dark:bg-[#2A1550] text-[#7024E3] dark:text-white shadow-2xs font-extrabold'
                    : 'text-[#7C709A] dark:text-[#9B88BF] hover:text-[#1E084A] dark:hover:text-white'
                }`}
              >
                {p === '7d' ? '7J' : p === '30d' ? '30J' : p === '90d' ? '3M' : '12M'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Current Active Value */}
        <div className="p-3 bg-[#F8F7FD] dark:bg-[#1C0F38] border border-[#EDE9FE] dark:border-[#2D1A54] rounded-xl">
          <span className="text-[11px] uppercase font-bold text-[#7C709A] dark:text-[#A594C9] block">
            {hoveredIndex !== null ? `Au ${activePoint?.fullDate}` : 'Solde Trésorerie Actuel'}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black font-tabular text-[#7024E3] dark:text-[#A78BFA]">
              {activePoint?.cumulativeBalance.toLocaleString('fr-FR')}
            </span>
            <span className="text-[11px] font-mono text-[#7C709A] dark:text-[#A594C9]">FCFA</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[11px] font-bold text-[#10B981]">
            <TrendingUp className="w-3 h-3" />
            <span>+{growthRate}% sur la période</span>
          </div>
        </div>

        {/* Total Inflows */}
        <div className="p-3 bg-[#F0FDF4] dark:bg-[#0E281E] border border-[#BBF7D0] dark:border-[#134E39] rounded-xl">
          <span className="text-[11px] uppercase font-bold text-[#166534] dark:text-[#34D399] block flex items-center justify-between">
            <span>Total Entrées</span>
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black font-tabular text-[#166534] dark:text-[#34D399]">
              +{totalInflow.toLocaleString('fr-FR')}
            </span>
            <span className="text-[11px] font-mono text-[#166534]/70 dark:text-[#34D399]/70">FCFA</span>
          </div>
          <span className="text-[11px] text-[#166534] dark:text-[#34D399] mt-0.5 block font-medium">
            Ventes & encaissements clients
          </span>
        </div>

        {/* Total Outflows */}
        <div className="p-3 bg-[#FFF1F2] dark:bg-[#2B0E1B] border border-[#FECDD3] dark:border-[#521832] rounded-xl">
          <span className="text-[11px] uppercase font-bold text-[#9F1239] dark:text-[#F43F5E] block flex items-center justify-between">
            <span>Total Sorties</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black font-tabular text-[#9F1239] dark:text-[#F43F5E]">
              -{totalOutflow.toLocaleString('fr-FR')}
            </span>
            <span className="text-[11px] font-mono text-[#9F1239]/70 dark:text-[#F43F5E]/70">FCFA</span>
          </div>
          <span className="text-[11px] text-[#9F1239] dark:text-[#F43F5E] mt-0.5 block font-medium">
            Achats, carburant & loyer
          </span>
        </div>

        {/* Net Flow / Runway */}
        <div className="p-3 bg-[#F5F3FF] dark:bg-[#20103E] border border-[#DDD6FE] dark:border-[#3B2068] rounded-xl">
          <span className="text-[11px] uppercase font-bold text-[#7024E3] dark:text-[#C4B5FD] block flex items-center justify-between">
            <span>Flux Net de Période</span>
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-lg font-black font-tabular ${totalNet >= 0 ? 'text-[#10B981]' : 'text-[#E11D48]'}`}>
              {totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString('fr-FR')}
            </span>
            <span className="text-[11px] font-mono text-[#7C709A]">FCFA</span>
          </div>
          <span className="text-[11px] text-[#7024E3] dark:text-[#A78BFA] mt-0.5 block font-medium">
            Autonomie estimée : ~4.2 mois
          </span>
        </div>
      </div>

      {/* SVG Interactive Chart Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {/* Gradient for Cumulative Treasury Balance */}
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7024E3" stopOpacity={isDark ? "0.45" : "0.22"} />
              <stop offset="100%" stopColor="#7024E3" stopOpacity="0.0" />
            </linearGradient>

            {/* Gradient for Inflows */}
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={isDark ? "0.4" : "0.2"} />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>

            {/* Gradient for Outflows */}
            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity={isDark ? "0.35" : "0.15"} />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={padLeft + chartWidth}
                y2={tick.y}
                stroke={isDark ? '#2D1A54' : '#E9E3F8'}
                strokeDasharray={i === 0 || i === yTicks.length - 1 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={tick.y + 3.5}
                textAnchor="end"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fill={isDark ? '#8E7AB5' : '#8B7FA4'}
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Zero line for Net Margin view */}
          {metricView === 'net_margin' && minVal < 0 && (
            <line
              x1={padLeft}
              y1={getY(0)}
              x2={padLeft + chartWidth}
              y2={getY(0)}
              stroke={isDark ? '#A78BFA' : '#7024E3'}
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          )}

          {/* Render lines and areas based on Metric View */}
          {metricView === 'cashflow' && (
            <>
              <path d={balanceArea} fill="url(#balanceGrad)" />
              <path
                d={balancePath}
                fill="none"
                stroke={isDark ? '#A78BFA' : '#7024E3'}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {metricView === 'income_expense' && (
            <>
              {/* Outflow Area & Line */}
              <path d={outflowArea} fill="url(#outflowGrad)" />
              <path
                d={outflowPath}
                fill="none"
                stroke="#F43F5E"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="5 3"
              />

              {/* Inflow Area & Line */}
              <path d={inflowArea} fill="url(#inflowGrad)" />
              <path
                d={inflowPath}
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </>
          )}

          {metricView === 'net_margin' && (
            <>
              {/* Net Margin Bars */}
              {dataPoints.map((p, idx) => {
                const x = getX(idx);
                const barWidth = Math.max(14, chartWidth / dataPoints.length * 0.45);
                const zeroY = getY(0);
                const valY = getY(p.net);
                const isPositive = p.net >= 0;
                const topY = isPositive ? valY : zeroY;
                const height = Math.abs(valY - zeroY);

                return (
                  <rect
                    key={idx}
                    x={x - barWidth / 2}
                    y={topY}
                    width={barWidth}
                    height={Math.max(3, height)}
                    rx="3"
                    fill={isPositive ? '#10B981' : '#F43F5E'}
                    opacity={hoveredIndex === idx ? 1 : 0.85}
                  />
                );
              })}
            </>
          )}

          {/* Interactive Hover Vertical Cursor & Nodes */}
          {dataPoints.map((p, idx) => {
            const x = getX(idx);
            const activeY = metricView === 'cashflow' 
              ? getY(p.cumulativeBalance)
              : metricView === 'income_expense' 
              ? getY(p.inflow) 
              : getY(p.net);
            const isHovered = hoveredIndex === idx;

            return (
              <g key={idx} className="cursor-pointer">
                {/* Hit test invisible column */}
                <rect
                  x={x - chartWidth / (dataPoints.length * 2)}
                  y={padTop}
                  width={chartWidth / dataPoints.length}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(idx)}
                />

                {/* Vertical line when hovered */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + chartHeight}
                    stroke={isDark ? '#C4B5FD' : '#7024E3'}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={x}
                  cy={activeY}
                  r={isHovered ? 6.5 : 4}
                  fill={isDark ? '#150A2A' : '#FFFFFF'}
                  stroke={
                    metricView === 'income_expense' 
                      ? '#10B981' 
                      : isDark ? '#A78BFA' : '#7024E3'
                  }
                  strokeWidth={isHovered ? 3.5 : 2}
                  className="transition-all duration-150"
                />

                {/* If income/expense view, show second node on outflow */}
                {metricView === 'income_expense' && (
                  <circle
                    cx={x}
                    cy={getY(p.outflow)}
                    r={isHovered ? 5.5 : 3.5}
                    fill={isDark ? '#150A2A' : '#FFFFFF'}
                    stroke="#F43F5E"
                    strokeWidth="2"
                  />
                )}

                {/* X Axis Labels */}
                <text
                  x={x}
                  y={padTop + chartHeight + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  fontWeight={isHovered ? '700' : '500'}
                  fill={isHovered 
                    ? (isDark ? '#FFFFFF' : '#7024E3') 
                    : (isDark ? '#8E7AB5' : '#7C709A')
                  }
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip card */}
        {hoveredIndex !== null && (
          <div 
            className={`absolute top-2 pointer-events-none p-3 rounded-xl shadow-xl border text-xs z-20 backdrop-blur-md transition-all ${
              isDark 
                ? 'bg-[#1C0F38]/95 border-[#452778] text-white shadow-black/60' 
                : 'bg-white/95 border-[#DDD6FE] text-[#1E084A] shadow-purple-900/10'
            }`}
            style={{
              left: `${Math.min(78, Math.max(12, (hoveredIndex / (dataPoints.length - 1)) * 100))}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-bold text-[12px] pb-1.5 border-b border-[#EDE9FE] dark:border-[#35225E] flex items-center justify-between gap-4">
              <span>{activePoint.fullDate}</span>
              <span className="text-[11px] font-mono text-[#7024E3] dark:text-[#A78BFA] font-bold">
                Point #{hoveredIndex + 1}
              </span>
            </div>
            
            <div className="space-y-1 mt-1.5 font-tabular text-[12px]">
              <div className="flex items-center justify-between gap-4 text-[#10B981]">
                <span className="font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Entrées :
                </span>
                <span className="font-bold">+{activePoint.inflow.toLocaleString('fr-FR')} FCFA</span>
              </div>

              <div className="flex items-center justify-between gap-4 text-[#F43F5E]">
                <span className="font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#F43F5E]" />
                  Sorties :
                </span>
                <span className="font-bold">-{activePoint.outflow.toLocaleString('fr-FR')} FCFA</span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#EDE9FE] dark:border-[#35225E] font-bold">
                <span className="text-[#7024E3] dark:text-[#C4B5FD]">Solde cumulé :</span>
                <span className="text-white dark:text-[#F3EFFF] bg-[#7024E3] px-1.5 py-0.5 rounded text-[11px]">
                  {activePoint.cumulativeBalance.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend and Accounting Commentary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 mt-2 border-t border-[#EDE9FE] dark:border-[#2D1A54] text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#7024E3] dark:bg-[#A78BFA] rounded-full" />
            <span className="text-[12px] text-[#534674] dark:text-[#C4B5FD] font-medium">
              Solde Trésorerie Cumulé
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#10B981] rounded-full" />
            <span className="text-[12px] text-[#534674] dark:text-[#C4B5FD] font-medium">
              Encaissements (Classe 7 & 5)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#F43F5E] rounded-full" />
            <span className="text-[12px] text-[#534674] dark:text-[#C4B5FD] font-medium">
              Décaissements (Classe 6)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[12px] text-[#7C709A] dark:text-[#9B88BF]">
          <Info className="w-3.5 h-3.5 text-[#7024E3] dark:text-[#A78BFA]" />
          <span>Survolez les points pour inspecter les flux journaliers</span>
        </div>
      </div>
    </div>
  );
};
