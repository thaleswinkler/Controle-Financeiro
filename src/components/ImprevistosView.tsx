import React, { useState } from "react";
import { PlusCircle, Trash2, Edit3, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { GastoImprevisto } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";
import { EditTransactionModal } from "./EditTransactionModal";

interface ImprevistosViewProps {
  imprevistos: GastoImprevisto[];
  totalReceita: number;
  onAddImprevisto: (imp: Omit<GastoImprevisto, "id">) => void;
  onUpdateImprevisto: (imp: GastoImprevisto) => void;
  onDeleteImprevisto: (id: string) => void;
}

export const ImprevistosView: React.FC<ImprevistosViewProps> = ({
  imprevistos,
  totalReceita,
  onAddImprevisto,
  onUpdateImprevisto,
  onDeleteImprevisto,
}) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayISO(0));
  const [category, setCategory] = useState("Saúde");
  const [editingImprevisto, setEditingImprevisto] = useState<GastoImprevisto | null>(null);

  const totalImprevistos = imprevistos.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const impactoReceitaPct = totalReceita > 0 ? (totalImprevistos / totalReceita) * 100 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(val) || val <= 0) return;

    onAddImprevisto({
      description: description.trim(),
      amount: val,
      date: date || getTodayISO(0),
      category,
    });

    setDescription("");
    setAmount("");
  };

  return (
    <div className="space-y-6">
      {/* Alert Header Box */}
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-300 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <strong className="text-white text-sm block">Monitor de Gastos Emergenciais</strong>
            <p className="text-rose-300/90 text-xs mt-0.5">
              Gastos não planejados comprometem o orçamento mensal. Monitorá-los ajuda a calibrar o tamanho exato da sua reserva de emergência.
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0 bg-slate-950/40 p-2.5 rounded-xl border border-rose-500/20">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Impacto na Renda</span>
          <span className={`text-base font-extrabold font-mono ${impactoReceitaPct > 15 ? "text-rose-400" : "text-amber-400"}`}>
            {impactoReceitaPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Novo Gasto Imprevisto</h3>
              <p className="text-[11px] text-slate-400">Despesas médicas, reparos de carro ou casa</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Descrição do Ocorrido</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Troca de pneu furado, Consulta veterinária"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Valor do Reparo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Data do Ocorrido</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Área da Emergência</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-rose-500 focus:outline-none"
              >
                <option value="Saúde">Saúde / Farmácia</option>
                <option value="Veículo">Veículo / Manutenção Mecânica</option>
                <option value="Casa">Casa / Reparo Elétrico / Hidráulico</option>
                <option value="Família">Família / Apoio Urgente</option>
                <option value="Multa / Taxa">Multa / Taxa Cartorária</option>
                <option value="Outros">Outros Não Planejados</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 font-bold text-white rounded-xl transition-all shadow-lg shadow-rose-600/20 active:scale-95 text-xs cursor-pointer"
            >
              Registrar Imprevisto
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Despesas Emergenciais Registradas</span>
              </h3>
              <p className="text-[11px] text-slate-400">Total contabilizado que saiu fora do orçamento padrão</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Emergências</span>
              <span className="text-base font-extrabold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/20 inline-block font-mono">
                {formatBRL(totalImprevistos)}
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
                  <th className="py-3 px-4 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {imprevistos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Nenhum gasto imprevisto registrado neste mês. Excelente controle!
                    </td>
                  </tr>
                ) : (
                  imprevistos.map((imp) => (
                    <tr key={imp.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-4 font-medium text-white">{imp.description}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          {imp.category || "Emergência"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDateBR(imp.date)}</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-400 font-mono">
                        {formatBRL(imp.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingImprevisto(imp)}
                            className="text-slate-400 hover:text-rose-300 p-1 rounded-md hover:bg-slate-800 transition-colors"
                            title="Editar imprevisto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteImprevisto(imp.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded-md hover:bg-slate-800"
                            title="Remover imprevisto"
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
      {editingImprevisto && (
        <EditTransactionModal
          isOpen={!!editingImprevisto}
          onClose={() => setEditingImprevisto(null)}
          target={{ kind: "imprevisto", item: editingImprevisto }}
          onSaveImprevisto={(updated) => {
            onUpdateImprevisto(updated);
            setEditingImprevisto(null);
          }}
        />
      )}
    </div>
  );
};
