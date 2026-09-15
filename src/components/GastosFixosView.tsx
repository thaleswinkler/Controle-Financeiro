import React, { useState } from "react";
import {
  PlusCircle,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
  CheckCheck,
  AlertCircle,
  CopyPlus,
} from "lucide-react";
import { GastoFixo } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";

interface GastosFixosViewProps {
  gastosFixos: GastoFixo[];
  onAddGastoFixo: (fixo: Omit<GastoFixo, "id">) => void;
  onToggleStatus: (id: string) => void;
  onMarkAllAsPaid: () => void;
  onDeleteGastoFixo: (id: string) => void;
  onReplicateNextMonth: () => void;
}

export const GastosFixosView: React.FC<GastosFixosViewProps> = ({
  gastosFixos,
  onAddGastoFixo,
  onToggleStatus,
  onMarkAllAsPaid,
  onDeleteGastoFixo,
  onReplicateNextMonth,
}) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayISO(5));
  const [status, setStatus] = useState<"pago" | "pendente">("pendente");
  const [category, setCategory] = useState("Moradia");

  const today = getTodayISO();

  const totalPago = gastosFixos
    .filter((f) => f.status === "pago")
    .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  const totalPendente = gastosFixos
    .filter((f) => f.status === "pendente")
    .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  const totalGeral = totalPago + totalPendente;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(val) || val <= 0) return;

    onAddGastoFixo({
      description: description.trim(),
      amount: val,
      date: date || getTodayISO(5),
      status,
      category,
      recurring: true,
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
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Novo Gasto Fixo</h3>
            <p className="text-[11px] text-slate-400">Contas e custos essenciais do mês</p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <span className="text-[10px] text-slate-400 font-semibold block mb-1.5 uppercase">
            Atalhos frequentes:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fillQuickPreset("Aluguel / Condomínio", "Moradia")}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60"
            >
              + Aluguel
            </button>
            <button
              type="button"
              onClick={() => fillQuickPreset("Energia Elétrica (Luz)", "Contas")}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60"
            >
              + Luz
            </button>
            <button
              type="button"
              onClick={() => fillQuickPreset("Internet Fibra", "Telecom")}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700/60"
            >
              + Internet
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
              placeholder="Ex: Aluguel, Condomínio, Energia, Internet"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
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
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Vencimento</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="Moradia">Moradia</option>
                <option value="Contas">Contas de Consumo</option>
                <option value="Telecom">Telecom / Internet</option>
                <option value="Saúde">Saúde & Bem-estar</option>
                <option value="Educação">Educação & Cursos</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Status Inicial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "pago" | "pendente")}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Já Pago</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 text-xs"
          >
            Cadastrar Gasto Fixo
          </button>
        </form>
      </div>

      {/* Table & Automation Actions */}
      <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-400" />
              <span>Contas Recorrentes do Mês</span>
            </h3>
            <p className="text-[11px] text-slate-400">Clique no status para alternar entre Pago e Pendente</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={onMarkAllAsPaid}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
              title="Marcar todas as contas como pagas"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Pagar Todos</span>
            </button>
            <button
              onClick={onReplicateNextMonth}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs border border-indigo-500/30 flex items-center gap-1.5 transition-colors"
              title="Replicar estes custos fixos para o próximo mês"
            >
              <CopyPlus className="w-3.5 h-3.5" />
              <span>Replicar Próx. Mês</span>
            </button>
          </div>
        </div>

        {/* Subtotals bar */}
        <div className="grid grid-cols-3 gap-2.5 py-1">
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Fixos</span>
            <span className="text-xs font-black text-white">{formatBRL(totalGeral)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <span className="text-[10px] text-emerald-400 uppercase font-bold block">Pago</span>
            <span className="text-xs font-black text-emerald-400">{formatBRL(totalPago)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">Pendente</span>
            <span className="text-xs font-black text-amber-400">{formatBRL(totalPendente)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Descrição</th>
                <th className="py-3 px-4 font-semibold">Vencimento</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 text-right font-semibold">Valor</th>
                <th className="py-3 px-4 text-center font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {gastosFixos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhum gasto fixo cadastrado.
                  </td>
                </tr>
              ) : (
                gastosFixos.map((f) => {
                  const isOverdue = f.status === "pendente" && f.date < today;
                  return (
                    <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{f.description}</span>
                          {isOverdue && (
                            <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                              <AlertCircle className="w-2.5 h-2.5" /> Atrasado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDateBR(f.date)}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onToggleStatus(f.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            f.status === "pago"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                          }`}
                        >
                          {f.status === "pago" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Pago</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Pendente</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-300 font-mono">
                        {formatBRL(f.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onDeleteGastoFixo(f.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Remover gasto fixo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
