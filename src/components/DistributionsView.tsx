import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Search, Send } from 'lucide-react';
import {
  Distribution,
  FIELD_LIMITS,
  InventoryItem,
  NewDistributionInput,
  RECIPIENT_TYPES,
  RecipientType,
} from '../types';
import { formatProtocolCode } from './ReceiptModal';

interface DistributionsViewProps {
  inventory: InventoryItem[];
  distributions: Distribution[];
  preselectedItemId?: string | null;
  onRegisterDistribution: (input: NewDistributionInput) => Promise<void>;
  onOpenReceipt: (distribution: Distribution) => void;
}

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DistributionsView: React.FC<DistributionsViewProps> = ({
  inventory,
  distributions,
  preselectedItemId,
  onRegisterDistribution,
  onOpenReceipt,
}) => {
  const availableItems = useMemo(
    () => inventory.filter((item) => item.availableQty > 0),
    [inventory]
  );

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [recipientName, setRecipientName] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('Estudante');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [distributedDate, setDistributedDate] = useState<string>(getTodayISO());
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<RecipientType | 'Todos'>('Todos');

  useEffect(() => {
    if (preselectedItemId && availableItems.some((i) => i.id === preselectedItemId)) {
      setSelectedItemId(preselectedItemId);
      setQuantity(1);
    } else if (!selectedItemId && availableItems.length > 0) {
      setSelectedItemId(availableItems[0].id);
    }
  }, [preselectedItemId, availableItems, selectedItemId]);

  const selectedItem = availableItems.find((i) => i.id === selectedItemId);
  const maxAllowed = selectedItem ? selectedItem.availableQty : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedItem) {
      setFeedback({ type: 'error', text: 'Selecione um item disponível em estoque.' });
      return;
    }
    if (quantity < 1 || quantity > selectedItem.availableQty) {
      setFeedback({
        type: 'error',
        text: `Quantidade inválida. Disponível em estoque: ${selectedItem.availableQty}.`,
      });
      return;
    }
    if (recipientName.trim().length < FIELD_LIMITS.MIN_NAME_LEN) {
      setFeedback({ type: 'error', text: 'Informe o nome do beneficiário ou instituição.' });
      return;
    }
    if (responsiblePerson.trim().length < FIELD_LIMITS.MIN_NAME_LEN) {
      setFeedback({ type: 'error', text: 'Informe o responsável pela entrega.' });
      return;
    }

    setSubmitting(true);
    try {
      await onRegisterDistribution({
        inventoryItemId: selectedItem.id,
        quantity,
        recipientName: recipientName.trim(),
        recipientType,
        responsiblePerson: responsiblePerson.trim(),
        distributedDate,
        notes: notes.trim(),
      });
      setRecipientName('');
      setNotes('');
      setQuantity(1);
      setFeedback({
        type: 'success',
        text: 'Distribuição registrada e saldo disponível atualizado automaticamente.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao registrar distribuição.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDistributions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...distributions]
      .sort((a, b) => b.distributedDate.localeCompare(a.distributedDate) || b.createdAtMs - a.createdAtMs)
      .filter((d) => {
        if (typeFilter !== 'Todos' && d.recipientType !== typeFilter) return false;
        if (!q) return true;
        return (
          d.itemName.toLowerCase().includes(q) ||
          d.recipientName.toLowerCase().includes(q) ||
          d.responsiblePerson.toLowerCase().includes(q) ||
          formatProtocolCode('ENT', d.id).toLowerCase().includes(q)
        );
      });
  }, [distributions, searchTerm, typeFilter]);

  const handleExportCsv = () => {
    const headers = [
      'Protocolo',
      'Data',
      'Equipamento',
      'Categoria',
      'Quantidade',
      'Beneficiário',
      'Perfil',
      'Responsável',
      'Observações',
    ];
    const rows = filteredDistributions.map((d) => [
      formatProtocolCode('ENT', d.id),
      d.distributedDate,
      `"${d.itemName.replace(/"/g, '""')}"`,
      `"${d.category}"`,
      String(d.quantity),
      `"${d.recipientName.replace(/"/g, '""')}"`,
      `"${d.recipientType}"`,
      `"${d.responsiblePerson.replace(/"/g, '""')}"`,
      `"${d.notes.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solidario-tech-distribuicoes-${getTodayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Distribution Form */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Registro de Distribuição
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Selecione um equipamento com saldo positivo para registrar a entrega ao beneficiário.
          </p>
        </div>

        {availableItems.length === 0 ? (
          <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-400">
            Não há itens disponíveis em estoque no momento. Cadastre uma nova doação primeiro.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label
                  htmlFor="dist-item"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Item Disponível em Estoque *
                </label>
                <select
                  id="dist-item"
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setQuantity(1);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {availableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — Disponível: {item.availableQty} un. ({item.condition})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="dist-qty"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Quantidade * (máx. {maxAllowed})
                </label>
                <input
                  id="dist-qty"
                  type="number"
                  min={1}
                  max={maxAllowed}
                  required
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.min(maxAllowed, Math.max(1, parseInt(e.target.value || '1', 10)))
                    )
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="md:col-span-4">
                <label
                  htmlFor="dist-date"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Data da Distribuição *
                </label>
                <input
                  id="dist-date"
                  type="date"
                  required
                  value={distributedDate}
                  onChange={(e) => setDistributedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5">
                <label
                  htmlFor="dist-rec"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Beneficiário ou Instituição *
                </label>
                <input
                  id="dist-rec"
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.MAX_NAME_LEN}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ex.: E.E. Paulo Freire / Estudante Lucas Silva"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="dist-type"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Perfil do Beneficiário
                </label>
                <select
                  id="dist-type"
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value as RecipientType)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {RECIPIENT_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label
                  htmlFor="dist-resp"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Responsável pela Entrega *
                </label>
                <input
                  id="dist-resp"
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.MAX_RESPONSIBLE_LEN}
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  placeholder="Nome do voluntário ou coordenador"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
              <div className="flex-1">
                <label
                  htmlFor="dist-notes"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Observações da Entrega
                </label>
                <input
                  id="dist-notes"
                  type="text"
                  maxLength={FIELD_LIMITS.MAX_NOTES_LEN}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional — termo de recebimento, projeto atendido"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Registrando...' : 'Confirmar Distribuição'}
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
        )}
      </section>

      {/* Distribution History Table */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Histórico de Distribuições Realizadas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {filteredDistributions.length} entrega(s) registrada(s)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar protocolo, beneficiário..."
                aria-label="Buscar distribuições"
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-60"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as RecipientType | 'Todos')}
              aria-label="Filtrar por perfil de beneficiário"
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Todos">Todos os perfis</option>
              {RECIPIENT_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
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

        {filteredDistributions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma distribuição encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">Protocolo</th>
                  <th className="py-3 px-4 whitespace-nowrap">Data</th>
                  <th className="py-3 px-4">Equipamento Entregue</th>
                  <th className="py-3 px-4">Beneficiário · Perfil</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Qtd.</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Termo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {filteredDistributions.map((dist) => (
                  <tr
                    key={dist.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {formatProtocolCode('ENT', dist.id)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {dist.distributedDate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {dist.itemName}
                      </div>
                      {dist.notes && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {dist.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200">{dist.recipientName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {dist.recipientType}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {dist.responsiblePerson}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-sky-700 dark:text-sky-400 tabular-nums whitespace-nowrap">
                      -{dist.quantity}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenReceipt(dist)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        Termo
                      </button>
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
