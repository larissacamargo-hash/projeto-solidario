import React, { useMemo, useState } from 'react';
import {
  CATEGORIES,
  Category,
  CONDITIONS,
  Distribution,
  Donation,
  InventoryItem,
  RECIPIENT_TYPES,
} from '../types';

interface ChartsSectionProps {
  donations: Donation[];
  distributions: Distribution[];
  inventory: InventoryItem[];
  onSelectCategory?: (category: Category) => void;
}

const CATEGORY_COLORS: Record<Category, string> = {
  'Notebooks & PCs': '#10B981',
  Periféricos: '#38BDF8',
  'Smartphones & Tablets': '#818CF8',
  'Redes & Cabos': '#F59E0B',
  'Componentes & Peças': '#FB7185',
  Outros: '#94A3B8',
};

const RECIPIENT_COLORS: Record<string, string> = {
  Estudante: '#10B981',
  'Escola Pública': '#38BDF8',
  'ONG / Projeto Social': '#818CF8',
  Família: '#F59E0B',
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const idx = Number(month) - 1;
  if (idx >= 0 && idx < 12) {
    return `${MONTH_NAMES[idx]}/${year.slice(2)}`;
  }
  return ym;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  donations,
  distributions,
  inventory,
  onSelectCategory,
}) => {
  const [range, setRange] = useState<'6m' | 'all'>('6m');
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const monthlySeries = useMemo(() => {
    const map = new Map<string, { month: string; received: number; distributed: number }>();

    for (const d of donations) {
      const m = d.receivedDate.slice(0, 7);
      const entry = map.get(m) || { month: m, received: 0, distributed: 0 };
      entry.received += d.quantity;
      map.set(m, entry);
    }

    for (const dist of distributions) {
      const m = dist.distributedDate.slice(0, 7);
      const entry = map.get(m) || { month: m, received: 0, distributed: 0 };
      entry.distributed += dist.quantity;
      map.set(m, entry);
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    return range === '6m' ? sorted.slice(-6) : sorted;
  }, [donations, distributions, range]);

  const activeHoverItem = useMemo(
    () => monthlySeries.find((m) => m.month === hoveredMonth) || null,
    [monthlySeries, hoveredMonth]
  );

  const maxMonthlyVal = useMemo(() => {
    const max = Math.max(
      10,
      ...monthlySeries.map((m) => Math.max(m.received, m.distributed))
    );
    return Math.ceil(max / 10) * 10;
  }, [monthlySeries]);

  const categoryStats = useMemo(() => {
    const totals = new Map<Category, number>();
    for (const cat of CATEGORIES) {
      totals.set(cat, 0);
    }
    for (const d of donations) {
      totals.set(d.category, (totals.get(d.category) || 0) + d.quantity);
    }
    const grandTotal = Array.from(totals.values()).reduce((acc, v) => acc + v, 0);
    return CATEGORIES.map((cat) => {
      const qty = totals.get(cat) || 0;
      return {
        category: cat,
        qty,
        pct: grandTotal > 0 ? Math.round((qty / grandTotal) * 100) : 0,
        color: CATEGORY_COLORS[cat],
      };
    }).sort((a, b) => b.qty - a.qty);
  }, [donations]);

  const maxCategoryQty = useMemo(
    () => Math.max(1, ...categoryStats.map((c) => c.qty)),
    [categoryStats]
  );

  const recipientStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const rt of RECIPIENT_TYPES) {
      map.set(rt, 0);
    }
    for (const dist of distributions) {
      map.set(dist.recipientType, (map.get(dist.recipientType) || 0) + dist.quantity);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return RECIPIENT_TYPES.map((type) => {
      const qty = map.get(type) || 0;
      return {
        type,
        qty,
        pct: total > 0 ? Math.round((qty / total) * 100) : 0,
        color: RECIPIENT_COLORS[type] || '#94A3B8',
      };
    });
  }, [distributions]);

  const conditionStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of CONDITIONS) {
      map.set(c, 0);
    }
    for (const item of inventory) {
      map.set(item.condition, (map.get(item.condition) || 0) + item.availableQty);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return CONDITIONS.map((cond) => ({
      condition: cond,
      qty: map.get(cond) || 0,
      pct: total > 0 ? Math.round(((map.get(cond) || 0) / total) * 100) : 0,
    }));
  }, [inventory]);

  const totalDistributedUnits = recipientStats.reduce((acc, r) => acc + r.qty, 0);
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;

  let cumulativeOffset = 0;
  const donutSegments = recipientStats
    .filter((r) => r.qty > 0)
    .map((r) => {
      const fraction = totalDistributedUnits > 0 ? r.qty / totalDistributedUnits : 0;
      const strokeLength = fraction * donutCircumference;
      const offset = cumulativeOffset;
      cumulativeOffset += strokeLength;
      return {
        ...r,
        strokeLength,
        offset,
      };
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Evolution Chart */}
        <section className="lg:col-span-7 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Evolução Mensal de Doações e Distribuições
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comparativo de unidades recebidas versus entregues por mês
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
              <button
                type="button"
                onClick={() => setRange('6m')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === '6m'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Últimos 6 meses
              </button>
              <button
                type="button"
                onClick={() => setRange('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Todo o período
              </button>
            </div>
          </div>

          {monthlySeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              Nenhuma movimentação registrada ainda.
            </div>
          ) : (
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400 mb-4">
                <div className="flex items-center gap-5">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                    Doações Recebidas
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-xs bg-sky-400 inline-block" />
                    Itens Distribuídos
                  </span>
                </div>

                <div className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300 min-h-[16px]">
                  {activeHoverItem
                    ? `${formatMonthLabel(activeHoverItem.month)}: +${activeHoverItem.received} recebidas · -${activeHoverItem.distributed} entregues`
                    : 'Passe o cursor sobre um mês'}
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg
                  viewBox="0 0 600 240"
                  className="w-full h-60 min-w-[440px]"
                  role="img"
                  aria-label="Gráfico de evolução mensal de doações recebidas e distribuídas"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const y = 200 - step * 170;
                    const labelVal = Math.round(step * maxMonthlyVal);
                    return (
                      <g key={step}>
                        <line
                          x1={42}
                          x2={586}
                          y1={y}
                          y2={y}
                          className="stroke-slate-200 dark:stroke-slate-800"
                          strokeDasharray={step === 0 ? undefined : '3 3'}
                        />
                        <text
                          x={34}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 dark:fill-slate-500 text-[11px] font-mono tabular-nums"
                        >
                          {labelVal}
                        </text>
                      </g>
                    );
                  })}

                  {monthlySeries.map((item, index) => {
                    const slotWidth = 534 / monthlySeries.length;
                    const centerX = 48 + slotWidth * index + slotWidth / 2;
                    const barWidth = Math.min(26, slotWidth * 0.28);
                    const recHeight = (item.received / maxMonthlyVal) * 170;
                    const distHeight = (item.distributed / maxMonthlyVal) * 170;
                    const isHovered = hoveredMonth === item.month;

                    return (
                      <g
                        key={item.month}
                        onMouseEnter={() => setHoveredMonth(item.month)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={centerX - slotWidth / 2 + 4}
                          y={20}
                          width={slotWidth - 8}
                          height={180}
                          rx={8}
                          className={
                            isHovered
                              ? 'fill-slate-100/80 dark:fill-slate-800/50'
                              : 'fill-transparent'
                          }
                        />

                        <rect
                          x={centerX - barWidth - 3}
                          y={200 - recHeight}
                          width={barWidth}
                          height={Math.max(2, recHeight)}
                          rx={4}
                          fill="#10B981"
                          className="transition-opacity duration-150"
                          opacity={hoveredMonth && !isHovered ? 0.45 : 1}
                        />

                        <rect
                          x={centerX + 3}
                          y={200 - distHeight}
                          width={barWidth}
                          height={Math.max(2, distHeight)}
                          rx={4}
                          fill="#38BDF8"
                          className="transition-opacity duration-150"
                          opacity={hoveredMonth && !isHovered ? 0.45 : 1}
                        />

                        {isHovered && (
                          <g>
                            <text
                              x={centerX - barWidth / 2 - 3}
                              y={Math.max(16, 194 - recHeight)}
                              textAnchor="middle"
                              className="fill-emerald-600 dark:fill-emerald-400 text-[11px] font-mono font-semibold tabular-nums"
                            >
                              {item.received}
                            </text>
                            <text
                              x={centerX + barWidth / 2 + 3}
                              y={Math.max(16, 194 - distHeight)}
                              textAnchor="middle"
                              className="fill-sky-600 dark:fill-sky-400 text-[11px] font-mono font-semibold tabular-nums"
                            >
                              {item.distributed}
                            </text>
                          </g>
                        )}

                        <text
                          x={centerX}
                          y={222}
                          textAnchor="middle"
                          className={`text-[11px] font-mono ${
                            isHovered
                              ? 'fill-slate-900 dark:fill-slate-100 font-semibold'
                              : 'fill-slate-500 dark:fill-slate-400'
                          }`}
                        >
                          {formatMonthLabel(item.month)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </section>

        {/* Category Breakdown Horizontal Bars */}
        <section className="lg:col-span-5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Doações Recebidas por Categoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Clique em uma categoria para filtrar os registros de entrada
            </p>
          </div>

          <div className="space-y-4">
            {categoryStats.map((item) => (
              <button
                key={item.category}
                type="button"
                onClick={() => onSelectCategory?.(item.category)}
                className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1.5 -m-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <div className="flex items-baseline justify-between gap-2 text-sm mb-1.5">
                  <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {item.category}
                  </span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
                    {item.qty} un. · {item.pct}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-300"
                    style={{
                      width: `${item.qty > 0 ? Math.max(4, (item.qty / maxCategoryQty) * 100) : 0}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Second Row: Beneficiary Profile Donut & Stock Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Distribuição por Perfil de Beneficiário
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Destino das unidades entregues até o momento
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r={donutRadius}
                  fill="none"
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="14"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.type}
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="14"
                    strokeDasharray={`${seg.strokeLength} ${donutCircumference - seg.strokeLength}`}
                    strokeDashoffset={-seg.offset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {totalDistributedUnits}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">entregues</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              {recipientStats.map((r) => (
                <div
                  key={r.type}
                  className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800/80 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 truncate">{r.type}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                    {r.qty} un. ({r.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Condição dos Itens Disponíveis em Estoque
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Prontidão técnica dos equipamentos aguardando distribuição
            </p>
          </div>

          <div className="space-y-4">
            {conditionStats.map((c) => {
              const barColor =
                c.condition === 'Novo'
                  ? '#10B981'
                  : c.condition === 'Revisado / Funcional'
                  ? '#38BDF8'
                  : '#F59E0B';
              return (
                <div key={c.condition} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {c.condition}
                    </span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      {c.qty} disponíveis · {c.pct}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{
                        width: `${c.qty > 0 ? Math.max(4, c.pct) : 0}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
