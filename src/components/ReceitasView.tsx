import React, { useState } from "react";
import {
  PlusCircle,
  Trash2,
  Edit3,
  Wallet,
  CopyPlus,
  RotateCcw,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { Receita } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";
import { EditTransactionModal } from "./EditTransactionModal";

interface ReceitasViewProps {
  receitas: Receita[];
  onAddReceita: (receita: Omit<Receita, "id">) => void;
  onUpdateReceita: (receita: Receita) => void;
  onDeleteReceita: (id: string) => void;
  onReplicateAllMonths?: () => void;
  onReplicateFromPreviousMonth?: () => void;
  onRestoreReceitas?: () => void;
}

export const ReceitasView: React.FC<ReceitasViewProps> = ({
  receitas,
  onAddReceita,
  onUpdateReceita,
  onDeleteReceita,
  onReplicateAllMonths,
  onReplicateFromPreviousMonth,
  onRestoreReceitas,
}) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayISO(0));
  const [category, setCategory] = useState("Salário");
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  // Quick inline edit of amount
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineAmount, setInlineAmount] = useState("");

  const startInlineEdit = (item: Receita) => {
    setInlineEditingId(item.id);
    setInlineAmount(item.amount.toString());
  };

  const handleInlineSave = (item: Receita) => {
    const val = parseFloat(inlineAmount.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      onUpdateReceita({ ...item, amount: val });
    }
    setInlineEditingId(null);
  };

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
    <div className="space-y-4">
      {/* Zero State Alert Banner if empty */}
      {receitas.length === 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-slate-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl backdrop-blur-md">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Nenhuma receita listada para este mês
              </h4>
              <p className="text-xs text-slate-300">
                Se você já havia cadastrado salário ou receitas antes, clique no botão ao lado para restaurar seus lançamentos instantaneamente.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onReplicateFromPreviousMonth && (
              <button
                type="button"
                onClick={onReplicateFromPreviousMonth}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <CopyPlus className="w-4 h-4" />
                <span>Copiar Mês Anterior</span>
              </button>
            )}
            {onRestoreReceitas && (
              <button
                type="button"
                onClick={onRestoreReceitas}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurar Lançamentos</span>
              </button>
            )}
          </div>
        </div>
      )}

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
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60 cursor-pointer"
              >
                + Salário
              </button>
              <button
                type="button"
                onClick={() => fillQuickPreset("Projeto Freelance", "Freelance")}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60 cursor-pointer"
              >
                + Freelance
              </button>
              <button
                type="button"
                onClick={() => fillQuickPreset("Rendimentos / Dividendos", "Investimentos")}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60 cursor-pointer"
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
              <label className="block text-slate-400 font-medium mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="Salário">Salário / CLT / Pro-labore</option>
                <option value="Freelance">Freelance / Serviços Extras</option>
                <option value="Investimentos">Investimentos / Dividendos</option>
                <option value="Comissão">Comissão / Bonificação</option>
                <option value="Vendas">Venda de Bens / Desapego</option>
                <option value="Outros">Outras Entradas</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-xs cursor-pointer"
            >
              Adicionar Receita
            </button>
          </form>
        </div>

        {/* Table & Subtotal */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Entradas Registradas</span>
              </h3>
              <p className="text-[11px] text-slate-400">Receitas programadas ou recebidas no mês</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              {onReplicateFromPreviousMonth && (
                <button
                  type="button"
                  onClick={onReplicateFromPreviousMonth}
                  title="Copiar receitas cadastradas no mês anterior"
                  className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:border-emerald-500/50 bg-slate-800/80 hover:bg-emerald-500/10 text-[11px] font-semibold text-slate-300 hover:text-emerald-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <CopyPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiar do Mês Anterior</span>
                </button>
              )}
              {onRestoreReceitas && (
                <button
                  type="button"
                  onClick={onRestoreReceitas}
                  title="Restaurar receitas salvas ou do mês anterior"
                  className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Recuperar Receitas</span>
                </button>
              )}
              {onReplicateAllMonths && (
                <button
                  type="button"
                  onClick={onReplicateAllMonths}
                  title="Replicar estas receitas para todos os outros meses"
                  className="px-2.5 py-1.5 rounded-xl border border-emerald-500/30 hover:border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-semibold text-emerald-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <CopyPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Replicar Todos os Meses</span>
                </button>
              )}
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Receitas</span>
                <span className="text-base font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 inline-block font-mono">
                  {formatBRL(total)}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Descrição</th>
                  <th className="py-3 px-4 font-semibold">Categoria</th>
                  <th className="py-3 px-4 font-semibold">Data</th>
                  <th className="py-3 px-4 text-right font-semibold">
                    Valor <span className="normal-case font-normal text-slate-500 text-[10px]">(clique p/ alterar)</span>
                  </th>
                  <th className="py-3 px-4 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {receitas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Nenhuma receita cadastrada neste mês.
                      {onRestoreReceitas && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={onRestoreReceitas}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
                          >
                            Clique aqui para recuperar suas receitas salvas
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  receitas.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-4 font-medium text-white">{r.description}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {r.category || "Geral"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDateBR(r.date)}</td>
                      <td className="py-3 px-4 text-right">
                        {inlineEditingId === r.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={inlineAmount}
                              onChange={(e) => setInlineAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleInlineSave(r);
                                if (e.key === "Escape") setInlineEditingId(null);
                              }}
                              onBlur={() => handleInlineSave(r)}
                              className="w-28 bg-slate-900 border border-emerald-400 text-white font-mono text-xs rounded px-2 py-1 text-right focus:outline-none shadow-inner"
                              autoFocus
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleInlineSave(r)}
                              className="text-emerald-400 hover:text-emerald-300 p-1 hover:bg-emerald-500/20 rounded cursor-pointer"
                              title="Salvar valor"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setInlineEditingId(null)}
                              className="text-slate-400 hover:text-rose-400 p-1 hover:bg-rose-500/20 rounded cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startInlineEdit(r)}
                            className="inline-flex items-center gap-1.5 cursor-pointer group/val justify-end py-1 px-2 rounded hover:bg-slate-800/80 transition-colors"
                            title="Clique para alterar o valor da receita"
                          >
                            <span className="font-bold text-emerald-400 font-mono text-xs group-hover/val:text-emerald-300">
                              {formatBRL(r.amount)}
                            </span>
                            <Edit3 className="w-3 h-3 text-slate-500 opacity-60 group-hover/val:opacity-100 transition-opacity text-emerald-400" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingReceita(r)}
                            className="text-slate-400 hover:text-emerald-400 p-1 rounded-md hover:bg-slate-800 transition-colors"
                            title="Editar receita"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteReceita(r.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded-md hover:bg-slate-800"
                            title="Remover receita"
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
      {editingReceita && (
        <EditTransactionModal
          isOpen={!!editingReceita}
          onClose={() => setEditingReceita(null)}
          target={{ kind: "receita", item: editingReceita }}
          onSaveReceita={(updated) => {
            onUpdateReceita(updated);
            setEditingReceita(null);
          }}
        />
      )}
    </div>
  );
};
