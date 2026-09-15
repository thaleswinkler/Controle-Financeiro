import React, { useState, useEffect } from "react";
import { X, CreditCard, Check, Trash2, Calendar, DollarSign } from "lucide-react";
import { CardConfig } from "../types";

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardToEdit?: CardConfig | null;
  onSaveCard: (card: CardConfig) => void;
  onDeleteCard?: (cardId: string) => void;
}

const PRESET_COLORS = [
  { name: "Roxo / Nubank", accent: "#a855f7", brand: "from-purple-600 to-indigo-500" },
  { name: "Amarelo / BB", accent: "#facc15", brand: "from-amber-500 to-yellow-400" },
  { name: "Laranja / Inter / Amazon", accent: "#f97316", brand: "from-orange-500 to-amber-500" },
  { name: "Azul / Itaú / Caixa", accent: "#3b82f6", brand: "from-blue-600 to-cyan-500" },
  { name: "Esmeralda / Sicredi", accent: "#10b981", brand: "from-emerald-500 to-teal-600" },
  { name: "Prata / Black / C6", accent: "#94a3b8", brand: "from-slate-700 to-slate-900" },
  { name: "Rosa / Neon", accent: "#f43f5e", brand: "from-rose-500 to-pink-600" },
];

export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  cardToEdit,
  onSaveCard,
  onDeleteCard,
}) => {
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState(15);
  const [dueDay, setDueDay] = useState(22);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (cardToEdit) {
      setName(cardToEdit.name);
      setBankName(cardToEdit.bankName);
      setLimit(cardToEdit.limit.toString());
      setClosingDay(cardToEdit.closingDay || 15);
      setDueDay(cardToEdit.dueDay || 22);
      const match = PRESET_COLORS.find((c) => c.accent === cardToEdit.accentColor);
      setSelectedColor(
        match || {
          name: "Personalizado",
          accent: cardToEdit.accentColor || "#a855f7",
          brand: cardToEdit.brandColor || "from-purple-600 to-indigo-500",
        }
      );
    } else {
      setName("");
      setBankName("");
      setLimit("5000");
      setClosingDay(15);
      setDueDay(22);
      setSelectedColor(PRESET_COLORS[0]);
    }
    setConfirmDelete(false);
  }, [cardToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLimit = parseFloat(limit.replace(",", "."));
    if (!name.trim() || isNaN(cleanLimit) || cleanLimit <= 0) return;

    const id = cardToEdit
      ? cardToEdit.id
      : name.trim().replace(/\s+/g, "_").toUpperCase().substring(0, 10) + "_" + Date.now().toString().slice(-4);

    onSaveCard({
      id,
      name: name.trim(),
      bankName: bankName.trim() || name.trim(),
      brandColor: selectedColor.brand,
      accentColor: selectedColor.accent,
      limit: cleanLimit,
      closingDay: Number(closingDay) || 15,
      dueDay: Number(dueDay) || 22,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border"
            style={{
              backgroundColor: `${selectedColor.accent}20`,
              borderColor: `${selectedColor.accent}40`,
              color: selectedColor.accent,
            }}
          >
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {cardToEdit ? "Editar Cartão de Crédito" : "Adicionar Novo Cartão"}
            </h2>
            <p className="text-xs text-slate-400">
              {cardToEdit
                ? "Ajuste a data de vencimento, fechamento e limites"
                : "Cadastre um novo cartão para gerenciar faturas"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Nome do Cartão
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank Ultravioleta, Itaú Click, etc."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Banco / Emissor (opcional)
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Ex: Nubank Mastercard Black, Banco Itaú"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Dia Fechamento</span>
              </label>
              <select
                value={closingDay}
                onChange={(e) => setClosingDay(Number(e.target.value))}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Dia {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1 text-emerald-400">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dia Vencimento</span>
              </label>
              <select
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full bg-slate-800/90 border border-emerald-500/50 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Dia {day}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <span>Limite Total (R$)</span>
            </label>
            <input
              type="number"
              step="100"
              min="100"
              required
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="5000"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-2">
              Cor do Cartão
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[11px] ${
                    selectedColor.accent === c.accent
                      ? "border-white bg-slate-800 text-white font-bold"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: c.accent }}
                  />
                  <span className="truncate">{c.name.split("/")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            {cardToEdit && onDeleteCard && (
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                  } else {
                    onDeleteCard(cardToEdit.id);
                    onClose();
                  }
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  confirmDelete
                    ? "bg-rose-600 border-rose-500 text-white"
                    : "border-slate-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDelete ? "Confirmar?" : "Excluir"}</span>
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{cardToEdit ? "Salvar Alterações" : "Adicionar Cartão"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
