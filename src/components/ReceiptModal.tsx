import React, { useState } from 'react';
import { Check, Copy, Printer, X } from 'lucide-react';
import { Distribution, Donation } from '../types';

export type ReceiptDocument =
  | { kind: 'donation'; data: Donation }
  | { kind: 'distribution'; data: Distribution };

interface ReceiptModalProps {
  document: ReceiptDocument | null;
  onClose: () => void;
}

export function formatProtocolCode(prefix: 'DOA' | 'ENT' | 'LOT', id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const tail = clean.slice(-6).padStart(6, '0');
  return `${prefix}-${tail}`;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ document: docItem, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!docItem) return null;

  const isDonation = docItem.kind === 'donation';
  const protocol = isDonation
    ? formatProtocolCode('DOA', docItem.data.id)
    : formatProtocolCode('ENT', docItem.data.id);

  const summaryText = isDonation
    ? `Comprovante ${protocol} | Doação de ${docItem.data.quantity}x ${docItem.data.itemName} (${docItem.data.condition}) | Doador: ${docItem.data.donorName} | Data: ${docItem.data.receivedDate}`
    : `Termo ${protocol} | Entrega de ${docItem.data.quantity}x ${docItem.data.itemName} | Beneficiário: ${docItem.data.recipientName} (${docItem.data.recipientType}) | Responsável: ${docItem.data.responsiblePerson} | Data: ${docItem.data.distributedDate}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
    >
      <div
        id="printable-receipt"
        className="w-full max-w-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Top Modal Controls */}
        <div className="no-print px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
            Protocolo {protocol}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Resumo
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar documento"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Projeto Solidário Tech
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Centro de Triagem, Recondicionamento e Inclusão Digital
              </div>
            </div>
            <div className="text-right">
              <div
                id="receipt-title"
                className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
              >
                {isDonation
                  ? 'Comprovante de Recebimento de Doação'
                  : 'Termo de Entrega e Cessão de Equipamento'}
              </div>
              <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {protocol}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isDonation ? 'Doador / Organização Parceira' : 'Beneficiário / Instituição'}
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {isDonation ? docItem.data.donorName : docItem.data.recipientName}
              </div>
              {!isDonation && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perfil: {docItem.data.recipientType}
                </div>
              )}
            </div>

            <div className="sm:text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isDonation ? 'Data de Entrada' : 'Data da Entrega'}
              </div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {isDonation ? docItem.data.receivedDate : docItem.data.distributedDate}
              </div>
              {!isDonation && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Responsável: {docItem.data.responsiblePerson}
                </div>
              )}
            </div>
          </div>

          {/* Item Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-4">Equipamento Especificado</th>
                  <th className="py-2.5 px-4">Categoria</th>
                  {isDonation && <th className="py-2.5 px-4">Condição</th>}
                  <th className="py-2.5 px-4 text-right">Qtd.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {docItem.data.itemName}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                    {docItem.data.category}
                  </td>
                  {isDonation && (
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {docItem.data.condition}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {docItem.data.quantity} un.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Observações: </span>
            {docItem.data.notes || 'Sem observações adicionais registradas.'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6">
            <div className="border-t border-slate-300 dark:border-slate-700 pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              {isDonation ? 'Assinatura do Doador' : 'Assinatura do Beneficiário'}
            </div>
            <div className="border-t border-slate-300 dark:border-slate-700 pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Coordenação — Projeto Solidário Tech
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
