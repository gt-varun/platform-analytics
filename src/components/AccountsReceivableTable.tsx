import React from 'react';
import { AccountsReceivable } from '../types/analytics';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

interface AccountsReceivableTableProps {
  data: AccountsReceivable;
}

export const AccountsReceivableTable: React.FC<AccountsReceivableTableProps> = ({ data }) => {
  const hasInvoices = data.top_open_invoices && data.top_open_invoices.length > 0;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Table Header & Metrics Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center">
              <FileText className="w-4 h-4 mr-2 text-indigo-400" />
              Accounts Receivable
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Stripe open invoices & collection health</p>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Outstanding</span>
              <span className="font-bold text-white">{formatCurrency(data.total_outstanding_usd)}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border ${data.overdue_invoice_count > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-950 border-slate-800'}`}>
              <span className="text-slate-400 block text-[10px]">Overdue</span>
              <span className={`font-bold ${data.overdue_invoice_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(data.overdue_usd)} ({data.overdue_invoice_count})
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        {!hasInvoices ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-sm font-semibold text-slate-200">All invoices collected</p>
            <p className="text-xs text-slate-400 mt-1">There are currently zero open or overdue Stripe invoices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase">
                  <th className="pb-3 pr-4">Invoice ID</th>
                  <th className="pb-3 px-4">Customer</th>
                  <th className="pb-3 px-4">Outstanding</th>
                  <th className="pb-3 px-4">Created</th>
                  <th className="pb-3 pl-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.top_open_invoices.map((inv) => (
                  <tr
                    key={inv.invoice_id}
                    className={`transition-colors font-mono ${
                      inv.overdue
                        ? 'bg-red-500/10 hover:bg-red-500/15 text-red-200'
                        : 'hover:bg-slate-800/40 text-slate-200'
                    }`}
                  >
                    <td className="py-3 pr-4 font-semibold text-slate-300">
                      {inv.invoice_id}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {inv.customer_id}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {formatCurrency(inv.amount_remaining_usd)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                      {formatDate(inv.created)}
                    </td>
                    <td className="py-3 pl-4 text-right font-sans">
                      {inv.overdue ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Open
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note Footer */}
      {data.note && (
        <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-800/80 italic">
          * {data.note}
        </p>
      )}
    </div>
  );
};
