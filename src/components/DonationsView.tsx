import React, { useMemo, useState } from 'react';
import { Download, FileText, Plus, Search, Trash2 } from 'lucide-react';
import {
  CATEGORIES,
  Category,
  CONDITIONS,
  Condition,
  Donation,
  FIELD_LIMITS,
  InventoryItem,
  NewDonationInput,
} from '../types';
import { formatProtocolCode } from './ReceiptModal';

interface DonationsViewProps {
  donations: Donation[];
  inventory: InventoryItem[];
  onRegisterDonation: (input: NewDonationInput) => Promise<void>;
  onDeleteDonation: (donationId: string) => Promise<void>;
  onOpenReceipt: (donation: Donation) => void;
  initialCategoryFilter?: Category | 'Todas';
}

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DonationsView: React.FC<DonationsViewProps> = ({
  donations,
  inventory,
  onRegisterDonation,
  onDeleteDonation,
  onOpenReceipt,
  initialCategoryFilter = 'Todas',
}) => {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<Category>('Notebooks & PCs');
  const [condition, setCondition] = useState<Condition>('Revisado / Funcional');
  const [quantity, setQuantity] = useState<number>(1);
  const [donorName, setDonorName] = useState('');
  const [receivedDate, setReceivedDate] = useState<string>(getTodayISO());
  const [location, setLocation] = useState('Triagem Principal');
  const [notes, setNotes] = useState('');
  const [selectedExistingId, setSelectedExistingId] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Todas'>(initialCategoryFilter);

  const handleSelectExisting = (id: string) => {
    setSelectedExistingId(id);
    if (!id) return;
    const found = inventory.find((item) => item.id === id);
    if (found) {
      setItemName(found.name);
      setCategory(found.category);
      setCondition(found.condition);
      setLocation(found.location);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (itemName.trim().length < FIELD_LIMITS.MIN_NAME_LEN) {
      setFeedback({ type: 'error', text: 'Informe o nome do item com pelo menos 2 caracteres.' });
      return;
    }
    if (donorName.trim().length < FIELD_LIMITS.MIN_NAME_LEN) {
      setFeedback({ type: 'error', text: 'Informe o nome do doador ou empresa parceira.' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setFeedback({ type: 'error', text: 'A quantidade deve ser um número inteiro positivo.' });
      return;
    }

    setSubmitting(true);
    try {
      await onRegisterDonation({
        itemName: itemName.trim(),
        category,
        condition,
        quantity,
        donorName: donorName.trim(),
        receivedDate,
        location: location.trim() || 'Triagem Principal',
        notes: notes.trim(),
        existingInventoryId: selectedExistingId || undefined,
      });
      setItemName('');
      setDonorName('');
      setQuantity(1);
      setNotes('');
      setSelectedExistingId('');
      setFeedback({
        type: 'success',
        text: 'Doação cadastrada e saldo de itens disponíveis atualizado.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível registrar a doação.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDonations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...donations]
      .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate) || b.createdAtMs - a.createdAtMs)
      .filter((d) => {
        if (categoryFilter !== 'Todas' && d.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          d.itemName.toLowerCase().includes(q) ||
          d.donorName.toLowerCase().includes(q) ||
          d.notes.toLowerCase().includes(q) ||
          formatProtocolCode('DOA', d.id).toLowerCase().includes(q)
        );
      });
  }, [donations, searchTerm, categoryFilter]);

  const handleExportCsv = () => {
    const headers = [
      'Protocolo',
      'Data',
      'Equipamento',
      'Categoria',
      'Condição',
      'Quantidade',
      'Doador',
      'Observações',
    ];
    const rows = filteredDonations.map((d) => [
      formatProtocolCode('DOA', d.id),
      d.receivedDate,
      `"${d.itemName.replace(/"/g, '""')}"`,
      `"${d.category}"`,
      `"${d.condition}"`,
      String(d.quantity),
      `"${d.donorName.replace(/"/g, '""')}"`,
      `"${d.notes.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solidario-tech-doacoes-${getTodayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Registration Form */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Cadastro de Doação
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Registre equipamentos recebidos para incrementar automaticamente o estoque disponível.
            </p>
          </div>
          {inventory.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="existing-item"
                className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
              >
                Vincular a item existente:
              </label>
              <select
                id="existing-item"
                value={selectedExistingId}
                onChange={(e) => handleSelectExisting(e.target.value)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 max-w-[260px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Novo equipamento</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.availableQty} em estoque)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label
                htmlFor="don-item"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Equipamento ou Item *
              </label>
              <input
                id="don-item"
                type="text"
                required
                maxLength={FIELD_LIMITS.MAX_NAME_LEN}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ex.: Notebook Dell Latitude 5490"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="don-donor"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Doador ou Empresa Parceira *
              </label>
              <input
                id="don-donor"
                type="text"
                required
                maxLength={FIELD_LIMITS.MAX_NAME_LEN}
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="Ex.: TechCorp Soluções Ltda."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="don-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Data de Recebimento *
              </label>
              <input
                id="don-date"
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <label
                htmlFor="don-cat"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Categoria
              </label>
              <select
                id="don-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="don-cond"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Condição Técnica
              </label>
              <select
                id="don-cond"
                value={condition}
                onChange={(e) => setCondition(e.target.value as Condition)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="don-qty"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Quantidade *
              </label>
              <input
                id="don-qty"
                type="number"
                min={1}
                max={100000}
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="don-loc"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Localização no Estoque
              </label>
              <input
                id="don-loc"
                type="text"
                maxLength={FIELD_LIMITS.MAX_LOCATION_LEN}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex.: Bancada A1 — Triagem"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
            <div className="flex-1">
              <label
                htmlFor="don-notes"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Observações (acessórios, estado da bateria, termo)
              </label>
              <input
                id="don-notes"
                type="text"
                maxLength={FIELD_LIMITS.MAX_NOTES_LEN}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional — detalhes do lote recebido"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Registrando...' : 'Registrar Doação'}
            </button>
          </div>

          {feedback && (
            <div
              role="status"
              className={`text-sm px-4 py-2.5 rounded-lg border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </form>
      </section>

      {/* Donations Ledger */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Histórico de Doações Recebidas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {filteredDonations.length} registro(s) exibido(s)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar protocolo, item ou doador..."
                aria-label="Buscar doações"
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-60"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Category | 'Todas')}
              aria-label="Filtrar por categoria"
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
        </div>

        {filteredDonations.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma doação encontrada para os filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">Protocolo</th>
                  <th className="py-3 px-4 whitespace-nowrap">Data</th>
                  <th className="py-3 px-4">Equipamento</th>
                  <th className="py-3 px-4 whitespace-nowrap">Categoria · Condição</th>
                  <th className="py-3 px-4">Doador</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Qtd.</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {filteredDonations.map((don) => (
                  <tr
                    key={don.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {formatProtocolCode('DOA', don.id)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {don.receivedDate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {don.itemName}
                      </div>
                      {don.notes && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {don.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span>{don.category}</span>
                      <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <span
                        className={
                          don.condition === 'Para Reparo'
                            ? 'text-amber-700 dark:text-amber-400 font-medium'
                            : 'text-slate-600 dark:text-slate-400'
                        }
                      >
                        {don.condition}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {don.donorName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      +{don.quantity}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(don)}
                          title="Emitir comprovante de doação"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Comprovante
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDonation(don.id)}
                          title="Remover registro do histórico"
                          aria-label={`Remover registro de ${don.itemName}`}
                          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
