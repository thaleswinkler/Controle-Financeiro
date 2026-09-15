import React, { useState } from "react";
import { PlusCircle, Trash2, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { Receita } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";

interface ReceitasViewProps {
  receitas: Receita[];
  onAddReceita: (receita: Omit<Receita, "id">) => void;
  onDeleteReceita: (id: string) => void;
}

export const ReceitasView: React.FC<ReceitasViewProps> = ({
  receitas,
  onAddReceita,
  onDeleteReceita,
}) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayISO(0));
  const [category, setCategory] = useState("Salário");

  const total = receitas.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(val) || val <= 0) return;

    onAddReceita({
      description: description.trim(),
      amount: val,
      date: date || getTodayISO(0),
      category,
    });

    setDescription("");
    setAmount("");
  };

  const fillQuickPreset = (desc: string, cat: string) => {
    setDescription(desc);
    setCategory(cat);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Add Form */}
      <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl h-fit">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Nova Receita</h3>
            <p className="text-[11px] text-slate-400">Cadastre uma nova entrada financeira</p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <span className="text-[10px] text-slate-400 font-semibold block mb-1.5 uppercase">
            Atalhos rápidos:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fillQuickPreset("Salário Mensal", "Salário")}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60"
            >
              + Salário
            </button>
            <button
              type="button"
              onClick={() => fillQuickPreset("Projeto Freelance", "Freelance")}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60"
            >
              + Freelance
            </button>
            <button
              type="button"
              onClick={() => fillQuickPreset("Rendimentos / Dividendos", "Investimentos")}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60"
            >
              + Dividendos
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Descrição</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Salário Empresa, Freelance Web, Bônus"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Categoria de Entrada</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="Salário">Salário / Pró-labore</option>
              <option value="Freelance">Freelance / Prestação de Serviço</option>
              <option value="Investimentos">Rendimentos / Dividendos</option>
              <option value="Comissão">Comissão / Bônus</option>
              <option value="Outros">Outras Entradas</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-xs"
          >
            Adicionar Receita
          </button>
        </form>
      </div>

      {/* Table & Subtotal */}
      <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>Entradas Registradas</span>
            </h3>
            <p className="text-[11px] text-slate-400">Receitas programadas ou recebidas no mês</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Receitas</span>
            <span className="text-base font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 inline-block">
              {formatBRL(total)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Descrição</th>
                <th className="py-3 px-4 font-semibold">Categoria</th>
                <th className="py-3 px-4 font-semibold">Data</th>
                <th className="py-3 px-4 text-right font-semibold">Valor</th>
                <th className="py-3 px-4 text-center font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {receitas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhuma receita cadastrada neste mês.
                  </td>
                </tr>
              ) : (
                receitas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{r.description}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {r.category || "Geral"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{formatDateBR(r.date)}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">
                      {formatBRL(r.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onDeleteReceita(r.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        title="Remover receita"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
