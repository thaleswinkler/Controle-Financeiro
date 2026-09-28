import React, { useState, useMemo, useEffect } from "react";
import {
  CreditCard,
  PlusCircle,
  Trash2,
  Edit3,
  Layers,
  Plus,
  Settings,
  Calendar,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Info,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { CardConfig, GastoCartao } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";
import {
  addMonthsToDate,
  getMonthYearFromDate,
  calculateInvoiceMonth,
  INSTALLMENT_COUNT_OPTIONS,
} from "../utils/installments";
import { CardModal } from "./CardModal";
import { EditTransactionModal } from "./EditTransactionModal";

interface CartoesViewProps {
  cards: CardConfig[];
  cartoes: GastoCartao[];
  selectedPeriod?: string;
  onAddGastoCartao: (
    gasto: Omit<GastoCartao, "id">,
    installmentDetails?: {
      totalInstallments: number;
      startInstallment: number;
      installmentAmount: number;
      totalAmount: number;
      closingDay?: number;
    }
  ) => void;
  onUpdateGastoCartao: (gasto: GastoCartao) => void;
  onDeleteGastoCartao: (id: string, deleteSeries?: boolean) => void;
  onSaveCard: (card: CardConfig) => void;
  onDeleteCard: (cardId: string) => void;
  onSyncAllInstallments?: () => void;
  onCleanDuplicates?: () => void;
}

export const CartoesView: React.FC<CartoesViewProps> = ({
  cards,
  cartoes,
  selectedPeriod,
  onAddGastoCartao,
  onUpdateGastoCartao,
  onDeleteGastoCartao,
  onSaveCard,
  onDeleteCard,
  onSyncAllInstallments,
  onCleanDuplicates,
}) => {
  const [activeCardFilter, setActiveCardFilter] = useState<string>("TODOS");
  const [selectedCard, setSelectedCard] = useState<string>(cards[0]?.id || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const getInitialDate = () => {
    if (selectedPeriod) {
      const today = getTodayISO(0);
      if (today.startsWith(selectedPeriod)) return today;
      return `${selectedPeriod}-10`;
    }
    return getTodayISO(0);
  };
  const [date, setDate] = useState<string>(getInitialDate);

  // Sync date when working month changes
  useEffect(() => {
    if (selectedPeriod && !date.startsWith(selectedPeriod)) {
      const today = getTodayISO(0);
      if (today.startsWith(selectedPeriod)) {
        setDate(today);
      } else {
        const dayPart = date ? date.split("-")[2] || "10" : "10";
        setDate(`${selectedPeriod}-${dayPart}`);
      }
    }
  }, [selectedPeriod]);

  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [pricingMode, setPricingMode] = useState<"total" | "installment">("total");
  const [startInstallment, setStartInstallment] = useState<number>(1);
  const [category, setCategory] = useState("Alimentação");

  // Modals & confirmation dialogs
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CardConfig | null>(null);
  const [editingExpense, setEditingExpense] = useState<GastoCartao | null>(null);
  const [itemToDelete, setItemToDelete] = useState<GastoCartao | null>(null);

  const filteredExpenses =
    activeCardFilter === "TODOS"
      ? cartoes
      : cartoes.filter((c) => c.card === activeCardFilter);

  // Calculations for installments preview
  const numVal = parseFloat(amount.replace(",", ".")) || 0;
  const isRecurring = installmentCount === -1;
  const isInstallment = installmentCount > 1 && !isRecurring;

  const installmentAmount = useMemo(() => {
    if (numVal <= 0) return 0;
    if (!isInstallment) return numVal;
    if (pricingMode === "total") {
      return numVal / installmentCount;
    }
    return numVal;
  }, [numVal, isInstallment, pricingMode, installmentCount]);

  const totalPurchaseAmount = useMemo(() => {
    if (numVal <= 0) return 0;
    if (!isInstallment) return numVal;
    if (pricingMode === "total") {
      return numVal;
    }
    return numVal * installmentCount;
  }, [numVal, isInstallment, pricingMode, installmentCount]);

  const previewEndMonth = useMemo(() => {
    if (!isInstallment || !date) return "";
    const offsetMonths = installmentCount - 1;
    const finalDate = addMonthsToDate(date, offsetMonths);
    const parts = finalDate.split("-");
    if (parts.length >= 2) {
      const monthNames = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
      ];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx] || parts[1]}/${parts[0]}`;
    }
    return "";
  }, [isInstallment, date, installmentCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || numVal <= 0) return;

    const label = isRecurring
      ? "Recorrente"
      : installmentCount === 1
      ? "À vista"
      : `${startInstallment}/${installmentCount}`;

    onAddGastoCartao(
      {
        card: selectedCard || cards[0]?.id || "Cartão",
        description: description.trim(),
        amount: Math.round(installmentAmount * 100) / 100,
        date: date || (selectedPeriod ? `${selectedPeriod}-10` : getTodayISO(0)),
        installments: label,
        category,
        totalInstallments: isRecurring ? 1 : installmentCount,
        currentInstallment: startInstallment,
        totalPurchaseAmount: Math.round(totalPurchaseAmount * 100) / 100,
      },
      {
        totalInstallments: isInstallment ? installmentCount : 1,
        startInstallment: isInstallment ? startInstallment : 1,
        installmentAmount: Math.round(installmentAmount * 100) / 100,
        totalAmount: Math.round(totalPurchaseAmount * 100) / 100,
      }
    );

    setDescription("");
    setAmount("");
    setInstallmentCount(1);
    setStartInstallment(1);
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

  const handleDeleteClick = (expense: GastoCartao) => {
    // If expense belongs to an installment series or has format X/Y, ask the user
    const hasMultiple =
      Boolean(expense.installmentSeriesId) ||
      (Boolean(expense.installments) && /\d+\/\d+/.test(expense.installments || ""));

    if (hasMultiple) {
      setItemToDelete(expense);
    } else {
      onDeleteGastoCartao(expense.id, false);
    }
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

        <div className="flex items-center gap-2 shrink-0">
          {onCleanDuplicates && (
            <button
              onClick={onCleanDuplicates}
              title="Remover compras duplicadas ou lançamentos antigos desta fatura"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Limpar Duplicatas</span>
            </button>
          )}

          {onSyncAllInstallments && (
            <button
              onClick={onSyncAllInstallments}
              title="Detectar compras parceladas existentes e projetar automaticamente nos meses seguintes"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Projetar Parcelas nos Meses Seguintes</span>
            </button>
          )}

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
                      onClick={() => {
                        setCardToEdit(c);
                        setIsCardModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                      title="Configurar limites e datas"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block">
                    {c.bankName}
                  </span>
                </div>
                <div
                  className="w-8 h-6 rounded-md flex items-center justify-center opacity-80"
                  style={{ backgroundColor: `${c.accentColor}25` }}
                >
                  <CreditCard className="w-4 h-4" style={{ color: c.accentColor }} />
                </div>
              </div>

              <div className="my-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">
                  Fatura Atual
                </span>
                <span className="text-xl font-black text-white font-mono">
                  {formatBRL(spent)}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isDanger
                      ? "bg-rose-500"
                      : isWarning
                      ? "bg-amber-400"
                      : "bg-gradient-to-r from-purple-500 to-indigo-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                <span>Disponível: {formatBRL(available)}</span>
                <span
                  className={
                    isDanger
                      ? "text-rose-400 font-bold"
                      : isWarning
                      ? "text-amber-400"
                      : "text-slate-500"
                  }
                >
                  {pct}% do limite
                </span>
              </div>

              {/* Dates indicator badge */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">
                  Fecha dia <strong className="text-slate-200">{c.closingDay}</strong>
                </span>
                <span className="text-purple-300 font-semibold px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/40">
                  Vence dia {c.dueDay}
                </span>
              </div>
            </div>
          );
        })}

        {/* Quick Add Card Shortcut Card */}
        <div
          onClick={() => {
            setCardToEdit(null);
            setIsCardModalOpen(true);
          }}
          className="border-2 border-dashed border-slate-800 hover:border-purple-500/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group bg-slate-900/30 hover:bg-slate-900/50 min-h-[160px]"
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-300 group-hover:text-purple-300">
            Adicionar Novo Cartão
          </span>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[180px]">
            Personalize nome, limite e dia de vencimento
          </p>
        </div>
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
              <p className="text-[11px] text-slate-400">
                Lance gastos à vista ou parcelados (1x a 12x+)
              </p>
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
                  className="text-[11px] text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Ajustar vencimento</span>
                </button>
              </div>
              <select
                value={selectedCard}
                onChange={(e) => setSelectedCard(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-purple-500 focus:outline-none cursor-pointer"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Vence dia {c.dueDay})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Descrição da Compra</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Celular, Geladeira, Supermercado"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  {isInstallment && pricingMode === "installment" ? "Valor da Parcela (R$)" : "Valor (R$)"}
                </label>
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

            {/* Installments Selector - Complete 1x through 12x, 18x, 24x */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Parcelamento</label>
                <select
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-purple-500 focus:outline-none cursor-pointer"
                >
                  {INSTALLMENT_COUNT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value={-1}>Assinatura Recorrente</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-purple-500 focus:outline-none cursor-pointer"
                >
                  <option value="Alimentação">Alimentação / Mercado</option>
                  <option value="Transporte">Transporte / Uber / Gasolina</option>
                  <option value="Lazer">Lazer / Restaurantes</option>
                  <option value="Compras">Compras Pessoais / Eletro</option>
                  <option value="Saúde">Saúde / Farmácia</option>
                  <option value="Educação">Educação / Cursos</option>
                  <option value="Moradia">Moradia / Casa</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            {/* Installment Options Toggle (Total vs Per Installment) */}
            {isInstallment && (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-semibold">O valor digitado é:</span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setPricingMode("total")}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        pricingMode === "total"
                          ? "bg-purple-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Valor Total
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode("installment")}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        pricingMode === "installment"
                          ? "bg-purple-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Por Parcela
                    </button>
                  </div>
                </div>

                {/* Dynamic Summary Preview */}
                {numVal > 0 && (
                  <div className="text-[11px] text-purple-200 pt-1 border-t border-purple-800/30">
                    <div className="flex items-center justify-between font-bold">
                      <span>Plano:</span>
                      <span className="text-emerald-400 font-mono">
                        {installmentCount}x de {formatBRL(installmentAmount)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      Total: <strong className="text-white">{formatBRL(totalPurchaseAmount)}</strong>.
                      As parcelas 1 a {installmentCount} serão agendadas e lançadas automaticamente de{" "}
                      <span className="text-purple-300 font-semibold">
                        {date.split("-").slice(0, 2).reverse().join("/")}
                      </span>{" "}
                      até{" "}
                      <span className="text-purple-300 font-semibold">{previewEndMonth}</span>!
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 font-bold text-white rounded-xl transition-all shadow-lg shadow-purple-600/20 active:scale-95 text-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {isInstallment
                  ? `Lançar Compra em ${installmentCount}x`
                  : "Lançar no Cartão"}
              </span>
            </button>
          </form>
        </div>

        {/* Table of expenses */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Detalhamento dos Lançamentos</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Mostrando {filteredExpenses.length} compras no período selecionado
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {onCleanDuplicates && (
                <button
                  type="button"
                  onClick={onCleanDuplicates}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:border-amber-500/50 bg-slate-800/80 hover:bg-amber-500/10 text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Remove compras repetidas/duplicadas deste mês"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Limpar Duplicados</span>
                </button>
              )}

              {onSyncAllInstallments && (
                <button
                  type="button"
                  onClick={onSyncAllInstallments}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:border-purple-500/50 bg-slate-800/80 hover:bg-purple-500/10 text-[11px] font-semibold text-slate-300 hover:text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Projetar parcelas de compras existentes para os meses seguintes"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sincronizar Parcelas</span>
                </button>
              )}

              <div className="text-right pl-2 border-l border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Subtotal
                </span>
                <span className="text-sm font-black text-purple-400 font-mono">
                  {formatBRL(
                    filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Cartão</th>
                  <th className="py-3 px-4 font-semibold">Descrição</th>
                  <th className="py-3 px-4 font-semibold">Parcela / Tipo</th>
                  <th className="py-3 px-4 font-semibold">Data</th>
                  <th className="py-3 px-4 text-right font-semibold">Valor</th>
                  <th className="py-3 px-4 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Nenhuma compra encontrada para este mês.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((c) => {
                    const badge = getCardBadge(c.card);
                    const isParcela = c.installments && /\d+\/\d+/.test(c.installments);

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
                        <td className="py-3 px-4 font-medium text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{c.description}</span>
                            {c.totalPurchaseAmount && c.totalInstallments && c.totalInstallments > 1 && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                (Total: {formatBRL(c.totalPurchaseAmount)})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                              isParcela
                                ? "bg-purple-950/60 text-purple-300 border-purple-800/40 font-mono"
                                : "bg-slate-800/60 text-slate-400 border-slate-800"
                            }`}
                          >
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
                              className="text-slate-400 hover:text-purple-300 p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar compra"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(c)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
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

      {/* Delete Installment Options Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Excluir Compra Parcelada</h4>
                <p className="text-xs text-slate-400">
                  {itemToDelete.description} ({itemToDelete.installments})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta compra faz parte de um plano de parcelamento. Como deseja proceder com a exclusão?
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  onDeleteGastoCartao(itemToDelete.id, false);
                  setItemToDelete(null);
                }}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-between border border-slate-700 cursor-pointer"
              >
                <span>Excluir apenas esta parcela deste mês</span>
                <span className="text-[10px] text-slate-400 font-normal">Manter futuras</span>
              </button>

              <button
                onClick={() => {
                  onDeleteGastoCartao(itemToDelete.id, true);
                  setItemToDelete(null);
                }}
                className="w-full py-2.5 px-3 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-between border border-rose-500/30 cursor-pointer"
              >
                <span>Excluir todas as parcelas desta compra</span>
                <span className="text-[10px] text-rose-300 group-hover:text-white font-normal">
                  Deste mês e meses seguintes
                </span>
              </button>

              <button
                onClick={() => setItemToDelete(null)}
                className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
