import React, { useState } from "react";
import {
  CreditCard,
  PlusCircle,
  Trash2,
  AlertTriangle,
  Layers,
  Sparkles,
  Calendar,
} from "lucide-react";
import { CardConfig, GastoCartao } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";

interface CartoesViewProps {
  cards: CardConfig[];
  cartoes: GastoCartao[];
  onAddGastoCartao: (gasto: Omit<GastoCartao, "id">) => void;
  onDeleteGastoCartao: (id: string) => void;
}

export const CartoesView: React.FC<CartoesViewProps> = ({
  cards,
  cartoes,
  onAddGastoCartao,
  onDeleteGastoCartao,
}) => {
  const [activeCardFilter, setActiveCardFilter] = useState<string>("TODOS");
  const [selectedCard, setSelectedCard] = useState<string>(cards[0]?.id || "BB");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayISO(0));
  const [installments, setInstallments] = useState("À vista");
  const [category, setCategory] = useState("Alimentação");

  const filteredExpenses =
    activeCardFilter === "TODOS"
      ? cartoes
      : cartoes.filter((c) => c.card === activeCardFilter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(val) || val <= 0) return;

    onAddGastoCartao({
      card: selectedCard,
      description: description.trim(),
      amount: val,
      date: date || getTodayISO(0),
      installments,
      category,
    });

    setDescription("");
    setAmount("");
  };

  const getCardTotals = (cardId: string) => {
    return cartoes
      .filter((c) => c.card === cardId)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  };

  const badgeColors: Record<string, string> = {
    BB: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    C6: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    Amazon: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for filtering cards */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveCardFilter("TODOS")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeCardFilter === "TODOS"
              ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Todos os Cartões ({cartoes.length})
        </button>

        {cards.map((c) => {
          const total = getCardTotals(c.id);
          const isSelected = activeCardFilter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCardFilter(c.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: c.accentColor }}
              ></span>
              <span>{c.name}</span>
              <span className="text-[10px] text-slate-500 ml-1 font-mono">
                ({formatBRL(total)})
              </span>
            </button>
          );
        })}
      </div>

      {/* Visual Credit Cards Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const spent = getCardTotals(c.id);
          const pct = Math.min(100, Math.round((spent / c.limit) * 100));
          const available = Math.max(0, c.limit - spent);
          const isWarning = pct >= 70;
          const isDanger = pct >= 90;

          return (
            <div
              key={c.id}
              className={`bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden transition-all hover:border-slate-700 ${
                activeCardFilter === c.id ? "ring-1 ring-emerald-500/40" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block text-white">
                    {c.name}
                  </span>
                  <span className="text-[10px] text-slate-400">{c.bankName}</span>
                </div>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center border"
                  style={{
                    backgroundColor: `${c.accentColor}15`,
                    borderColor: `${c.accentColor}30`,
                    color: c.accentColor,
                  }}
                >
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Fatura Atual
                </span>
                <p className="text-2xl font-black text-white font-mono">{formatBRL(spent)}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isDanger
                      ? "#f43f5e"
                      : isWarning
                      ? "#f59e0b"
                      : c.accentColor,
                  }}
                ></div>
              </div>

              <div className="text-[11px] text-slate-400 mt-2 flex justify-between items-center">
                <span>Disponível: {formatBRL(available)}</span>
                <span className={isDanger ? "text-rose-400 font-bold" : isWarning ? "text-amber-400" : ""}>
                  {pct}% do limite
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span>Fecha dia {c.closingDay}</span>
                <span className="text-white font-semibold">Vence dia {c.dueDay}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Nova Compra no Cartão</h3>
              <p className="text-[11px] text-slate-400">Lance gastos no cartão com parcelamento</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Selecione o Cartão</label>
              <select
                value={selectedCard}
                onChange={(e) => setSelectedCard(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-purple-500 focus:outline-none"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Vence dia {c.dueDay})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Descrição</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Supermercado, Restaurante, Combustível"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Data da Compra</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Parcelamento</label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="À vista">À vista (1x)</option>
                  <option value="1/2">Parcela 1/2</option>
                  <option value="1/3">Parcela 1/3</option>
                  <option value="1/6">Parcela 1/6</option>
                  <option value="1/10">Parcela 1/10</option>
                  <option value="1/12">Parcela 1/12</option>
                  <option value="Recorrente">Assinatura Mensal</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="Alimentação">Alimentação / Mercado</option>
                  <option value="Transporte">Transporte / Uber / Gasolina</option>
                  <option value="Lazer">Lazer / Restaurantes</option>
                  <option value="Compras">Compras Pessoais</option>
                  <option value="Educação">Educação / Livros</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 font-bold text-white rounded-xl transition-all shadow-lg shadow-purple-600/20 active:scale-95 text-xs"
            >
              Lançar no Cartão
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Detalhamento dos Lançamentos</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Mostrando {filteredExpenses.length} compras{" "}
                {activeCardFilter !== "TODOS" ? `no cartão ${activeCardFilter}` : "em todos os cartões"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Subtotal</span>
              <span className="text-base font-extrabold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-xl border border-purple-500/20 inline-block font-mono">
                {formatBRL(
                  filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
                )}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Cartão</th>
                  <th className="py-3 px-4 font-semibold">Descrição</th>
                  <th className="py-3 px-4 font-semibold">Condição</th>
                  <th className="py-3 px-4 font-semibold">Data</th>
                  <th className="py-3 px-4 text-right font-semibold">Valor</th>
                  <th className="py-3 px-4 text-center font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Nenhuma compra encontrada para este cartão.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            badgeColors[c.card] || "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {c.card}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{c.description}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-800">
                          {c.installments || "À vista"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDateBR(c.date)}</td>
                      <td className="py-3 px-4 text-right font-bold text-purple-300 font-mono">
                        {formatBRL(c.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onDeleteGastoCartao(c.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Remover compra"
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
    </div>
  );
};
