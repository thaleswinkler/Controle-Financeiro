import React, { useState, useMemo } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Gem,
  Search,
  PieChart,
  CreditCard,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import { FinancialData, FinancialMetrics, TransactionType } from "../types";
import { formatBRL, formatDateBR } from "../utils/formatters";

interface ResumoViewProps {
  data: FinancialData;
  metrics: FinancialMetrics;
  onOpenAdvisorModal: () => void;
  onOpenWhatsAppModal: () => void;
  onToggleFixStatus?: (id: string) => void;
}

export const ResumoView: React.FC<ResumoViewProps> = ({
  data,
  metrics,
  onOpenAdvisorModal,
  onOpenWhatsAppModal,
  onToggleFixStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  // Aggregate all transactions sorted by date descending
  const allTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      type: TransactionType;
      typeLabel: string;
      description: string;
      detail: string;
      amount: number;
      date: string;
      isExpense: boolean;
      badgeColor: string;
    }> = [];

    (data.receitas || []).forEach((r) =>
      list.push({
        id: r.id,
        type: "receita",
        typeLabel: "Receita",
        description: r.description,
        detail: r.category || "Entrada",
        amount: r.amount,
        date: r.date,
        isExpense: false,
        badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      })
    );

    (data.gastosFixos || []).forEach((f) =>
      list.push({
        id: f.id,
        type: "gasto_fixo",
        typeLabel: "Gasto Fixo",
        description: f.description,
        detail: f.status === "pago" ? "Pago" : "Pendente",
        amount: f.amount,
        date: f.date,
        isExpense: true,
        badgeColor: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
      })
    );

    (data.cartoes || []).forEach((c) =>
      list.push({
        id: c.id,
        type: "cartao",
        typeLabel: `Cartão (${c.card})`,
        description: c.description,
        detail: c.card,
        amount: c.amount,
        date: c.date,
        isExpense: true,
        badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      })
    );

    (data.investimentos || []).forEach((i) =>
      list.push({
        id: i.id,
        type: "investimento",
        typeLabel: "Investimento",
        description: i.description,
        detail: i.type,
        amount: i.amount,
        date: i.date,
        isExpense: false,
        badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
      })
    );

    (data.imprevistos || []).forEach((imp) =>
      list.push({
        id: imp.id,
        type: "imprevisto",
        typeLabel: "Imprevisto",
        description: imp.description,
        detail: "Emergência",
        amount: imp.amount,
        date: imp.date,
        isExpense: true,
        badgeColor: "bg-rose-500/10 text-rose-300 border-rose-500/20",
      })
    );

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((item) => {
      const matchQuery =
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.detail.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === "todos" || item.type === typeFilter;
      return matchQuery && matchType;
    });
  }, [allTransactions, searchQuery, typeFilter]);

  // Donut chart calculations
  const totalExpenses = metrics.totalGastos > 0 ? metrics.totalGastos : 1;
  const fixosPercent = Math.round((metrics.totalFixos / totalExpenses) * 100);
  const cartoesPercent = Math.round((metrics.totalCartoes / totalExpenses) * 100);
  const imprevistosPercent = Math.max(0, 100 - fixosPercent - cartoesPercent);

  // SVG Donut circumference calculation (r = 40, C = 2 * pi * 40 = 251.32)
  const C = 251.32;
  const fixosStroke = (metrics.totalFixos / totalExpenses) * C;
  const cartoesStroke = (metrics.totalCartoes / totalExpenses) * C;
  const imprevistosStroke = (metrics.totalImprevistos / totalExpenses) * C;

  return (
    <div className="space-y-6">
      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receita Total */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-emerald-500 shadow-xl shadow-slate-950/40 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Receita Total
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
              {formatBRL(metrics.totalReceita)}
            </h2>
            <p className="text-xs text-emerald-400/90 mt-1 flex items-center gap-1 font-medium">
              <span>Entradas registradas no mês</span>
            </p>
          </div>
        </div>

        {/* Gastos Totais */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-rose-500 shadow-xl shadow-slate-950/40 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Gastos Totais
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
              {formatBRL(metrics.totalGastos)}
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>Fixos + Cartões + Imprevistos</span>
            </p>
          </div>
        </div>

        {/* Saldo Mensal */}
        <div
          className={`bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 shadow-xl shadow-slate-950/40 relative overflow-hidden group ${
            metrics.saldoMensal >= 0 ? "border-l-cyan-500" : "border-l-rose-600"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Saldo Mensal
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform ${
                metrics.saldoMensal >= 0
                  ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2
              className={`text-2xl lg:text-3xl font-black tracking-tight ${
                metrics.saldoMensal >= 0 ? "text-cyan-400" : "text-rose-400"
              }`}
            >
              {formatBRL(metrics.saldoMensal)}
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>
                {metrics.saldoMensal >= 0
                  ? `Superávit de ${metrics.totalReceita > 0 ? ((metrics.saldoMensal / metrics.totalReceita) * 100).toFixed(0) : 0}% da renda`
                  : "Déficit orçamentário no mês"}
              </span>
            </p>
          </div>
        </div>

        {/* Patrimônio Líquido */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-amber-500 shadow-xl shadow-slate-950/40 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Patrimônio Líquido
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Gem className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
              {formatBRL(metrics.patrimonioLiquido)}
            </h2>
            <p className="text-xs text-amber-400/90 mt-1 flex items-center gap-1 font-medium">
              <span>Investimentos + Saldo Líquido</span>
            </p>
          </div>
        </div>
      </div>

      {/* AI Automation & Health Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-500/20 rounded-2xl p-4.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Piloto Automático & Diagnóstico Financeiro
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                Ativo
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Envie mensagens do WhatsApp para categorização com Gemini ou solicite uma análise de corte de custos e aportes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onOpenWhatsAppModal}
            className="px-3 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <span>Lançar via WhatsApp</span>
          </button>
          <button
            onClick={onOpenAdvisorModal}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <span>Ver Diagnóstico IA</span>
          </button>
        </div>
      </div>

      {/* Interactive Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Categorias de Gastos (SVG Donut) */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-400" />
              <span>Distribuição de Gastos do Mês</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Total: {formatBRL(metrics.totalGastos)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
            {/* SVG Donut */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="14"
                />
                {/* Gastos Fixos Ring (Indigo) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#818cf8"
                  strokeWidth="14"
                  strokeDasharray={`${fixosStroke} ${C - fixosStroke}`}
                  strokeDashoffset="0"
                />
                {/* Cartões Ring (Purple) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#c084fc"
                  strokeWidth="14"
                  strokeDasharray={`${cartoesStroke} ${C - cartoesStroke}`}
                  strokeDashoffset={`${-fixosStroke}`}
                />
                {/* Imprevistos Ring (Rose) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#fb7185"
                  strokeWidth="14"
                  strokeDasharray={`${imprevistosStroke} ${C - imprevistosStroke}`}
                  strokeDashoffset={`${-(fixosStroke + cartoesStroke)}`}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                <span className="text-sm font-extrabold text-white">
                  {formatBRL(metrics.totalGastos).split(",")[0]}
                </span>
              </div>
            </div>

            {/* Legend & Percentages */}
            <div className="flex flex-col gap-3 w-full sm:w-52">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-400 shrink-0"></span>
                  <span className="text-xs text-slate-300 font-medium">Gastos Fixos</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">
                    {formatBRL(metrics.totalFixos)}
                  </span>
                  <span className="text-[10px] text-slate-400">{fixosPercent}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-400 shrink-0"></span>
                  <span className="text-xs text-slate-300 font-medium">Cartões de Crédito</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">
                    {formatBRL(metrics.totalCartoes)}
                  </span>
                  <span className="text-[10px] text-slate-400">{cartoesPercent}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400 shrink-0"></span>
                  <span className="text-xs text-slate-300 font-medium">Imprevistos</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">
                    {formatBRL(metrics.totalImprevistos)}
                  </span>
                  <span className="text-[10px] text-slate-400">{imprevistosPercent}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Comparativo de Cartões com Barra de Limite */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>Consumo dos Limites dos Cartões</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Faturas: {formatBRL(metrics.totalCartoes)}
            </span>
          </div>

          <div className="space-y-4 py-1 flex-1 flex flex-col justify-center">
            {data.cards.map((card) => {
              const spent = metrics.cardTotals[card.id] || 0;
              const pct = Math.min(100, Math.round((spent / card.limit) * 100));
              const isWarning = pct >= 70;
              const isDanger = pct >= 90;

              return (
                <div key={card.id} className="p-3 rounded-xl bg-slate-800/30 border border-slate-800/60">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: card.accentColor }}
                      ></span>
                      <span className="font-bold text-white">{card.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-white">{formatBRL(spent)}</span>
                      <span className="text-[11px] text-slate-400"> / {formatBRL(card.limit)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isDanger ? "#f43f5e" : isWarning ? "#f59e0b" : card.accentColor,
                      }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>Vencimento dia {card.dueDay}</span>
                    <span className={isDanger ? "text-rose-400 font-bold" : isWarning ? "text-amber-400" : ""}>
                      {pct}% utilizado
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Extrato Consolidado do Mês</span>
            </h3>
            <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded-md bg-slate-800">
              {filteredTransactions.length} lançamentos
            </span>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
              <button
                onClick={() => setTypeFilter("todos")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  typeFilter === "todos"
                    ? "bg-slate-700 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setTypeFilter("receita")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  typeFilter === "receita"
                    ? "bg-emerald-500/20 text-emerald-300 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Receitas
              </button>
              <button
                onClick={() => setTypeFilter("gasto_fixo")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  typeFilter === "gasto_fixo"
                    ? "bg-indigo-500/20 text-indigo-300 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Gastos Fixos
              </button>
              <button
                onClick={() => setTypeFilter("cartao")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  typeFilter === "cartao"
                    ? "bg-purple-500/20 text-purple-300 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Cartões
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar lançamentos..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Tipo</th>
                <th className="py-3 px-4 font-semibold">Descrição</th>
                <th className="py-3 px-4 font-semibold">Detalhe</th>
                <th className="py-3 px-4 font-semibold">Data</th>
                <th className="py-3 px-4 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhum lançamento encontrado para a pesquisa.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 12).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.badgeColor}`}
                      >
                        {item.typeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{item.description}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.type === "gasto_fixo" && onToggleFixStatus ? (
                        <button
                          type="button"
                          onClick={() => onToggleFixStatus(item.id)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                            item.detail === "Pago"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                          }`}
                          title="Clique para alternar entre Pago e Pendente"
                        >
                          {item.detail === "Pago" ? "Pago ✅" : "Pendente ⏳ (Pagar)"}
                        </button>
                      ) : (
                        item.detail
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{formatDateBR(item.date)}</td>
                    <td
                      className={`py-3 px-4 text-right font-extrabold ${
                        item.isExpense ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {item.isExpense ? "-" : "+"}
                      {formatBRL(item.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
