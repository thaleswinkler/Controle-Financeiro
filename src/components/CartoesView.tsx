import React, { useState } from "react";
import {
  CreditCard,
  PlusCircle,
  Trash2,
  Edit3,
  Layers,
  Plus,
  Settings,
} from "lucide-react";
import { CardConfig, GastoCartao } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";
import { CardModal } from "./CardModal";
import { EditTransactionModal } from "./EditTransactionModal";

interface CartoesViewProps {
  cards: CardConfig[];
  cartoes: GastoCartao[];
  onAddGastoCartao: (gasto: Omit<GastoCartao, "id">) => void;
  onUpdateGastoCartao: (gasto: GastoCartao) => void;
  onDeleteGastoCartao: (id: string) => void;
  onSaveCard: (card: CardConfig) => void;
  onDeleteCard: (cardId: string) => void;
}

export const CartoesView: React.FC<CartoesViewProps> = ({
  cards,
  cartoes,
  onAddGastoCartao,
  onUpdateGastoCartao,
  onDeleteGastoCartao,
  onSaveCard,
  onDeleteCard,
}) => {
  const [activeCardFilter, setActiveCardFilter] = useState<string>("TODOS");
  const [selectedCard, setSelectedCard] = useState<string>(cards[0]?.id || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayISO(0));
  const [installments, setInstallments] = useState("À vista");
  const [category, setCategory] = useState("Alimentação");

  // Modals
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CardConfig | null>(null);
  const [editingExpense, setEditingExpense] = useState<GastoCartao | null>(null);

  const filteredExpenses =
    activeCardFilter === "TODOS"
      ? cartoes
      : cartoes.filter((c) => c.card === activeCardFilter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(val) || val <= 0) return;

    onAddGastoCartao({
      card: selectedCard || cards[0]?.id || "Cartão",
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

  const getCardBadge = (cardId: string) => {
    const found = cards.find((c) => c.id === cardId);
    if (!found) return { name: cardId, color: "#94a3b8" };
    return { name: found.name, color: found.accentColor };
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for filtering cards & Manage button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center space-x-2">
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.accentColor }}
                />
                <span>{c.name}</span>
                <span className="text-[10px] text-slate-500 ml-1 font-mono">
                  ({formatBRL(total)})
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            setCardToEdit(null);
            setIsCardModalOpen(true);
          }}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Novo Cartão</span>
        </button>
      </div>

      {/* Visual Credit Cards Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const spent = getCardTotals(c.id);
          const limit = c.limit > 0 ? c.limit : 1;
          const pct = Math.min(100, Math.round((spent / limit) * 100));
          const available = Math.max(0, c.limit - spent);
          const isWarning = pct >= 70;
          const isDanger = pct >= 90;

          return (
            <div
              key={c.id}
              className={`bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden transition-all hover:border-slate-700 ${
                activeCardFilter === c.id ? "ring-1 ring-purple-500/50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider block text-white truncate">
                      {c.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardToEdit(c);
                        setIsCardModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-md transition-colors"
                      title="Editar datas de vencimento, fechamento e limite"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block">
                    {c.bankName || c.name}
                  </span>
                </div>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center border shrink-0"
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
                />
              </div>

              <div className="text-[11px] text-slate-400 mt-2 flex justify-between items-center">
                <span>Disponível: {formatBRL(available)}</span>
                <span className={isDanger ? "text-rose-400 font-bold" : isWarning ? "text-amber-400" : ""}>
                  {pct}% do limite
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Fecha dia {c.closingDay}</span>
                <span className="text-purple-300 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Vence dia {c.dueDay}
                </span>
              </div>
            </div>
          );
        })}

        {/* Add Card Prompt Card */}
        <button
          type="button"
          onClick={() => {
            setCardToEdit(null);
            setIsCardModalOpen(true);
          }}
          className="border-2 border-dashed border-slate-800 hover:border-purple-500/50 hover:bg-slate-900/40 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2 transition-all group cursor-pointer min-h-[160px]"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition-colors">
              Adicionar Novo Cartão
            </span>
            <span className="text-[11px] text-slate-500">
              Personalize nome, limite e dia de vencimento
            </span>
          </div>
        </button>
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 font-medium">Selecione o Cartão</label>
                <button
                  type="button"
                  onClick={() => {
                    const current = cards.find((c) => c.id === selectedCard) || cards[0];
                    if (current) {
                      setCardToEdit(current);
                      setIsCardModalOpen(true);
                    }
                  }}
                  className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>Ajustar vencimento</span>
                </button>
              </div>
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
                  <option value="1/4">Parcela 1/4</option>
                  <option value="1/5">Parcela 1/5</option>
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
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 font-bold text-white rounded-xl transition-all shadow-lg shadow-purple-600/20 active:scale-95 text-xs cursor-pointer"
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
                {activeCardFilter !== "TODOS" ? `no cartão selecionado` : "em todos os cartões"}
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
                  <th className="py-3 px-4 text-center font-semibold">Ações</th>
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
                  filteredExpenses.map((c) => {
                    const badge = getCardBadge(c.card);
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="py-3 px-4">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold border"
                            style={{
                              backgroundColor: `${badge.color}15`,
                              borderColor: `${badge.color}35`,
                              color: badge.color,
                            }}
                          >
                            {badge.name}
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
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditingExpense(c)}
                              className="text-slate-400 hover:text-purple-300 p-1 rounded-md hover:bg-slate-800 transition-colors"
                              title="Editar compra"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteGastoCartao(c.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-colors"
                              title="Remover compra"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Card Edit / Add Modal */}
      <CardModal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setCardToEdit(null);
        }}
        cardToEdit={cardToEdit}
        onSaveCard={onSaveCard}
        onDeleteCard={onDeleteCard}
      />

      {/* Expense Edit Modal */}
      {editingExpense && (
        <EditTransactionModal
          isOpen={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          target={{ kind: "cartao", item: editingExpense }}
          cards={cards}
          onSaveCartao={(updated) => {
            onUpdateGastoCartao(updated);
            setEditingExpense(null);
          }}
        />
      )}
    </div>
  );
};
