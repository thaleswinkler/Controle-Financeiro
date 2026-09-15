import React, { useState } from "react";
import { PlusCircle, Trash2, Edit3, PiggyBank, Target, TrendingUp, PieChart } from "lucide-react";
import { Investimento } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";
import { EditTransactionModal } from "./EditTransactionModal";

interface InvestimentosViewProps {
  investimentos: Investimento[];
  totalReceita: number;
  onAddInvestimento: (inv: Omit<Investimento, "id">) => void;
  onUpdateInvestimento: (inv: Investimento) => void;
  onDeleteInvestimento: (id: string) => void;
}

export const InvestimentosView: React.FC<InvestimentosViewProps> = ({
  investimentos,
  totalReceita,
  onAddInvestimento,
  onUpdateInvestimento,
  onDeleteInvestimento,
}) => {
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Investimento["type"]>("Renda Fixa");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayISO(0));
  const [editingInvestimento, setEditingInvestimento] = useState<Investimento | null>(null);

  const totalAportado = investimentos.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const taxaPoupanca = totalReceita > 0 ? (totalAportado / totalReceita) * 100 : 0;

  // Breakdown by asset class
  const classBreakdown = investimentos.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(val) || val <= 0) return;

    onAddInvestimento({
      description: description.trim(),
      type,
      amount: val,
      date: date || getTodayISO(0),
    });

    setDescription("");
    setAmount("");
  };

  const badgeTypeColor: Record<string, string> = {
    "Renda Fixa": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Ações: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    FIIs: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    Cripto: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Reserva: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    Outros: "bg-slate-800 text-slate-300 border-slate-700",
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-cyan-500 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Aportado no Mês
            </span>
            <PiggyBank className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2 font-mono">{formatBRL(totalAportado)}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Aportes novos deste período</span>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-emerald-500 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Taxa de Poupança
            </span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2 font-mono">
            {taxaPoupanca.toFixed(1)}%
          </p>
          <span className="text-[11px] text-emerald-400 mt-1 block font-medium">
            {taxaPoupanca >= 20 ? "Excelente! Acima de 20%" : "Recomendado: poupar 20%+"}
          </span>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-purple-500 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Classes Diversificadas
            </span>
            <PieChart className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2 font-mono">
            {Object.keys(classBreakdown).length} classes
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Renda Fixa, Ações, FIIs, etc.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Novo Aporte / Investimento</h3>
              <p className="text-[11px] text-slate-400">Registre compras de ativos e poupança</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Nome do Ativo / Destino</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Tesouro Selic 2029, IVVB11, HGLG11"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Classe do Ativo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as Investimento["type"])}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="Renda Fixa">Renda Fixa</option>
                  <option value="Ações">Ações</option>
                  <option value="FIIs">FIIs</option>
                  <option value="Cripto">Cripto</option>
                  <option value="Reserva">Reserva</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Valor Aportado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Data do Aporte</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 font-bold text-slate-950 rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 text-xs cursor-pointer"
            >
              Registrar Aporte
            </button>
          </form>
        </div>

        {/* Table & Breakdown */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Extrato de Aportes Mensais</span>
              </h3>
              <p className="text-[11px] text-slate-400">Alocação de capital e construção de patrimônio</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Subtotal Aportes</span>
              <span className="text-base font-extrabold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/20 inline-block font-mono">
                {formatBRL(totalAportado)}
              </span>
            </div>
          </div>

          {/* Mini Class Breakdown Pills */}
          {Object.keys(classBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-950/40 rounded-xl border border-slate-800">
              {Object.entries(classBreakdown).map(([cl, rawVal]) => {
                const val = Number(rawVal) || 0;
                return (
                  <div key={cl} className="text-xs flex items-center gap-1.5 font-medium">
                    <span className="text-slate-400">{cl}:</span>
                    <span className="text-white font-bold font-mono">{formatBRL(val)}</span>
                    <span className="text-[10px] text-cyan-400">
                      ({((val / (totalAportado || 1)) * 100).toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Ativo / Descrição</th>
                  <th className="py-3 px-4 font-semibold">Classe</th>
                  <th className="py-3 px-4 font-semibold">Data</th>
                  <th className="py-3 px-4 text-right font-semibold">Valor Aportado</th>
                  <th className="py-3 px-4 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {investimentos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Nenhum aporte registrado para este mês ainda.
                    </td>
                  </tr>
                ) : (
                  investimentos.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-4 font-medium text-white">{i.description}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            badgeTypeColor[i.type] || "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {i.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDateBR(i.date)}</td>
                      <td className="py-3 px-4 text-right font-bold text-cyan-300 font-mono">
                        {formatBRL(i.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingInvestimento(i)}
                            className="text-slate-400 hover:text-cyan-300 p-1 rounded-md hover:bg-slate-800 transition-colors"
                            title="Editar aporte"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteInvestimento(i.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded-md hover:bg-slate-800"
                            title="Remover aporte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingInvestimento && (
        <EditTransactionModal
          isOpen={!!editingInvestimento}
          onClose={() => setEditingInvestimento(null)}
          target={{ kind: "investimento", item: editingInvestimento }}
          onSaveInvestimento={(updated) => {
            onUpdateInvestimento(updated);
            setEditingInvestimento(null);
          }}
        />
      )}
    </div>
  );
};
