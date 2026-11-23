import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Check, Edit3, Search, X } from 'lucide-react';
import {
  CATEGORIES,
  Category,
  CONDITIONS,
  Condition,
  InventoryItem,
} from '../types';
import { formatProtocolCode } from './ReceiptModal';

interface InventoryViewProps {
  inventory: InventoryItem[];
  onDistributeItem: (item: InventoryItem) => void;
  onUpdateDetails: (
    itemId: string,
    updates: {
      name: string;
      category: Category;
      condition: Condition;
      location: string;
    }
  ) => Promise<void>;
}

type StockFilter = 'all' | 'available' | 'low' | 'empty';

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  onDistributeItem,
  onUpdateDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Todas'>('Todas');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCondition, setEditCondition] = useState<Condition>('Revisado / Funcional');
  const [editLocation, setEditLocation] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...inventory]
      .sort((a, b) => b.availableQty - a.availableQty || a.name.localeCompare(b.name))
      .filter((item) => {
        if (categoryFilter !== 'Todas' && item.category !== categoryFilter) return false;
        if (stockFilter === 'available' && item.availableQty <= 0) return false;
        if (stockFilter === 'low' && (item.availableQty <= 0 || item.availableQty > 5)) return false;
        if (stockFilter === 'empty' && item.availableQty > 0) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          formatProtocolCode('LOT', item.id).toLowerCase().includes(q)
        );
      });
  }, [inventory, searchTerm, categoryFilter, stockFilter]);

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditCondition(item.condition);
    setEditLocation(item.location);
  };

  const saveEdit = async (item: InventoryItem) => {
    setSavingId(item.id);
    try {
      await onUpdateDetails(item.id, {
        name: item.name,
        category: item.category,
        condition: editCondition,
        location: editLocation,
      });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const getStockStatusText = (qty: number): { label: string; className: string } => {
    if (qty === 0) {
      return { label: 'Esgotado', className: 'text-red-700 dark:text-red-400 font-medium' };
    }
    if (qty <= 5) {
      return {
        label: 'Estoque baixo',
        className: 'text-amber-700 dark:text-amber-400 font-medium',
      };
    }
    return {
      label: 'Disponível',
      className: 'text-emerald-700 dark:text-emerald-400 font-medium',
    };
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Controle de Itens Disponíveis
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanhe o lote, bancada de armazenamento, taxa de saída e prontidão técnica.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'available', label: 'Com Saldo' },
                  { id: 'low', label: 'Estoque Baixo' },
                  { id: 'empty', label: 'Esgotados' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStockFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    stockFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar lote, equipamento ou bancada..."
                aria-label="Buscar itens no estoque"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Category | 'Todas')}
              aria-label="Filtrar estoque por categoria"
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum item encontrado para os critérios selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">Lote</th>
                  <th className="py-3 px-4">Equipamento</th>
                  <th className="py-3 px-4 whitespace-nowrap">Categoria · Condição</th>
                  <th className="py-3 px-4">Localização</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Saldo / Total</th>
                  <th className="py-3 px-4 whitespace-nowrap">Situação</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {filteredItems.map((item) => {
                  const status = getStockStatusText(item.availableQty);
                  const isEditing = editingId === item.id;
                  const availPct =
                    item.totalReceived > 0
                      ? Math.round((item.availableQty / item.totalReceived) * 100)
                      : 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {formatProtocolCode('LOT', item.id)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={editCondition}
                            onChange={(e) => setEditCondition(e.target.value as Condition)}
                            className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                          >
                            {CONDITIONS.map((cond) => (
                              <option key={cond} value={cond}>
                                {cond}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <span>{item.category}</span>
                            <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-700">
                              ·
                            </span>
                            <span
                              className={
                                item.condition === 'Para Reparo'
                                  ? 'text-amber-700 dark:text-amber-400 font-medium'
                                  : 'text-slate-600 dark:text-slate-400'
                              }
                            >
                              {item.condition}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs w-44"
                          />
                        ) : (
                          item.location
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-mono text-xs tabular-nums">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.availableQty}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">
                            {' '}
                            / {item.totalReceived} un.
                          </span>
                        </div>
                        <div className="w-24 ml-auto mt-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${availPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span className={status.className}>{status.label}</span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={savingId === item.id}
                                onClick={() => saveEdit(item)}
                                title="Salvar ajustes"
                                className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                title="Cancelar edição"
                                className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                title="Atualizar condição ou localização"
                                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={item.availableQty <= 0}
                                onClick={() => onDistributeItem(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 disabled:opacity-40 disabled:pointer-events-none rounded-md transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                Distribuir
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
