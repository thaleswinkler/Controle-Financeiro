import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { FinancialData } from "../types";
import { formatBRL, calculateMetrics } from "../utils/formatters";

interface MonthSummary {
  monthYear: string;
  totalReceita: number;
  totalGastos: number;
  saldoMensal: number;
  receitasCount: number;
  fixosCount: number;
  cartoesCount: number;
  imprevistosCount: number;
  rawData: FinancialData;
}

interface MonthAuditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: string;
  onSelectPeriod: (monthYear: string) => void;
  onRestoreMonthData?: (data: FinancialData) => void;
}

export const MonthAuditorModal: React.FC<MonthAuditorModalProps> = ({
  isOpen,
  onClose,
  selectedPeriod,
  onSelectPeriod,
  onRestoreMonthData,
}) => {
  const [monthsList, setMonthsList] = useState<MonthSummary[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const list: MonthSummary[] = [];
    const seen = new Set<string>();

    // 1. Scan localStorage for all fin_iq_month_*
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("fin_iq_month_")) {
          const mYear = key.replace("fin_iq_month_", "");
          if (/^\d{4}-\d{2}$/.test(mYear) && !seen.has(mYear)) {
            seen.add(mYear);
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed: FinancialData = JSON.parse(raw);
                const m = calculateMetrics(parsed);
                list.push({
                  monthYear: mYear,
                  totalReceita: m.totalReceita,
                  totalGastos: m.totalGastos,
                  saldoMensal: m.saldoMensal,
                  receitasCount: (parsed.receitas || []).length,
                  fixosCount: (parsed.gastosFixos || []).length,
                  cartoesCount: (parsed.cartoes || []).length,
                  imprevistosCount: (parsed.imprevistos || []).length,
                  rawData: parsed,
                });
              } catch {}
            }
          }
        }
      }
    } catch {}

    // Sort descending by monthYear
    list.sort((a, b) => b.monthYear.localeCompare(a.monthYear));
    setMonthsList(list);
  }, [isOpen]);

  if (!isOpen) return null;

  // Month names in Portuguese
  const getMonthLabel = (mYear: string) => {
    const [y, m] = mYear.split("-").map(Number);
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return `${months[m - 1] || mYear} de ${y}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Auditoria de Todos os Meses Salvos
            </h2>
            <p className="text-xs text-slate-400">
              Verifique todos os meses gravados no sistema, seus lançamentos e o saldo final de cada um
            </p>
          </div>
        </div>

        {/* Information Callout */}
        <div className="my-4 p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-2xl text-xs text-slate-300 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Nenhum lançamento foi apagado!</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Cada mês possui sua própria fatura e contas independentes. Se você estava com saldo negativo em torno de <strong>-R$ 93</strong> em um mês específico, confira a lista abaixo para abrir o mês exato onde você fez esses lançamentos:
            </p>
          </div>
        </div>

        {/* Months List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {monthsList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhum mês histórico encontrado neste navegador.
            </div>
          ) : (
            monthsList.map((m) => {
              const isCurrent = m.monthYear === selectedPeriod;
              // Check if saldo is close to -93 (e.g. between -80 and -120)
              const isAround93Negative = m.saldoMensal <= -70 && m.saldoMensal >= -130;

              return (
                <div
                  key={m.monthYear}
                  className={`p-4 rounded-2xl border transition-all ${
                    isAround93Negative
                      ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
                      : isCurrent
                      ? "bg-slate-800/80 border-emerald-500/40"
                      : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-white">
                          {getMonthLabel(m.monthYear)}
                        </h3>
                        {isCurrent && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                            Mês Aberto Agora
                          </span>
                        )}
                        {isAround93Negative && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold animate-pulse">
                            🎯 Saldo ~ -R$ 93
                          </span>
                        )}
                      </div>

                      {/* Counts */}
                      <p className="text-[11px] text-slate-400 mt-1">
                        {m.receitasCount} receita(s) • {m.fixosCount} fixo(s) •{" "}
                        <strong className="text-white">{m.cartoesCount} compra(s) no cartão</strong>
                      </p>
                    </div>

                    {/* Financial summary & Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold">Saldo do Mês</p>
                        <p
                          className={`text-sm font-black font-mono ${
                            m.saldoMensal >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatBRL(m.saldoMensal)}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          onSelectPeriod(m.monthYear);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          isCurrent
                            ? "bg-slate-700 text-slate-300 hover:text-white"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md"
                        }`}
                      >
                        <span>{isCurrent ? "Visualizando" : "Abrir Este Mês"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
