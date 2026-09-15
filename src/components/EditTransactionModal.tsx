import React, { useState, useEffect } from "react";
import { X, Check, Trash2, Edit3, DollarSign, Calendar, Tag } from "lucide-react";
import {
  GastoCartao,
  GastoFixo,
  Receita,
  Investimento,
  GastoImprevisto,
  CardConfig,
} from "../types";

export type EditableItem =
  | { kind: "cartao"; item: GastoCartao }
  | { kind: "fixo"; item: GastoFixo }
  | { kind: "receita"; item: Receita }
  | { kind: "investimento"; item: Investimento }
  | { kind: "imprevisto"; item: GastoImprevisto };

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: EditableItem | null;
  cards?: CardConfig[];
  onSaveCartao?: (updated: GastoCartao) => void;
  onSaveFixo?: (updated: GastoFixo) => void;
  onSaveReceita?: (updated: Receita) => void;
  onSaveInvestimento?: (updated: Investimento) => void;
  onSaveImprevisto?: (updated: GastoImprevisto) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  target,
  cards = [],
  onSaveCartao,
  onSaveFixo,
  onSaveReceita,
  onSaveInvestimento,
  onSaveImprevisto,
}) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("À vista");
  const [fixStatus, setFixStatus] = useState<"pago" | "pendente">("pendente");
  const [invType, setInvType] = useState<Investimento["type"]>("Renda Fixa");

  useEffect(() => {
    if (!target) return;
    const { kind, item } = target;
    setDescription(item.description || "");
    setAmount(item.amount?.toString() || "");
    setDate(item.date || "");

    if (kind === "cartao") {
      setCardId(item.card || cards[0]?.id || "");
      setInstallments(item.installments || "À vista");
      setCategory(item.category || "Outros");
    } else if (kind === "fixo") {
      setFixStatus(item.status || "pendente");
      setCategory(item.category || "Moradia");
    } else if (kind === "receita") {
      setCategory(item.category || "Salário");
    } else if (kind === "investimento") {
      setInvType(item.type || "Renda Fixa");
    } else if (kind === "imprevisto") {
      setCategory(item.category || "Geral");
    }
  }, [target]);

  if (!isOpen || !target) return null;

  const getTitle = () => {
    switch (target.kind) {
      case "cartao":
        return "Editar Compra no Cartão";
      case "fixo":
        return "Editar Gasto Fixo";
      case "receita":
        return "Editar Receita";
      case "investimento":
        return "Editar Aporte / Investimento";
      case "imprevisto":
        return "Editar Gasto Imprevisto";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(val) || val <= 0) return;

    if (target.kind === "cartao" && onSaveCartao) {
      onSaveCartao({
        ...target.item,
        description: description.trim(),
        amount: val,
        date,
        card: cardId || target.item.card,
        installments,
        category,
      });
    } else if (target.kind === "fixo" && onSaveFixo) {
      onSaveFixo({
        ...target.item,
        description: description.trim(),
        amount: val,
        date,
        status: fixStatus,
        category,
      });
    } else if (target.kind === "receita" && onSaveReceita) {
      onSaveReceita({
        ...target.item,
        description: description.trim(),
        amount: val,
        date,
        category,
      });
    } else if (target.kind === "investimento" && onSaveInvestimento) {
      onSaveInvestimento({
        ...target.item,
        description: description.trim(),
        amount: val,
        date,
        type: invType,
      });
    } else if (target.kind === "imprevisto" && onSaveImprevisto) {
      onSaveImprevisto({
        ...target.item,
        description: description.trim(),
        amount: val,
        date,
        category,
      });
    }

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
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{getTitle()}</h2>
            <p className="text-xs text-slate-400">Atualize os valores e informações do lançamento</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Descrição</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Valor (R$)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Data</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Cartao specific fields */}
          {target.kind === "cartao" && (
            <>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cartão de Crédito</label>
                <select
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Vence dia {c.dueDay})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Parcelamento</label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                  <label className="block text-slate-300 font-semibold mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Alimentação">Alimentação / Mercado</option>
                    <option value="Transporte">Transporte / Uber</option>
                    <option value="Lazer">Lazer / Restaurantes</option>
                    <option value="Compras">Compras Pessoais</option>
                    <option value="Educação">Educação</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Gasto Fixo specific fields */}
          {target.kind === "fixo" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status de Pagamento</label>
                <select
                  value={fixStatus}
                  onChange={(e) => setFixStatus(e.target.value as "pago" | "pendente")}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="pendente">Pendente ⏳</option>
                  <option value="pago">Pago ✅</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Moradia">Moradia</option>
                  <option value="Contas">Contas / Serviços</option>
                  <option value="Educação">Educação</option>
                  <option value="Saúde">Saúde</option>
                  <option value="Veículo">Veículo / Seguro</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>
          )}

          {/* Receita specific fields */}
          {target.kind === "receita" && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Salário">Salário</option>
                <option value="Freelance">Freelance</option>
                <option value="Investimentos">Investimentos / Dividendos</option>
                <option value="Comissão">Comissão / Bônus</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          )}

          {/* Investimento specific fields */}
          {target.kind === "investimento" && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Classe de Ativo</label>
              <select
                value={invType}
                onChange={(e) => setInvType(e.target.value as Investimento["type"])}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Renda Fixa">Renda Fixa (Tesouro, CDB)</option>
                <option value="Ações">Ações Brasil / Exterior</option>
                <option value="FIIs">Fundos Imobiliários (FIIs)</option>
                <option value="Cripto">Criptomoedas / Bitcoin</option>
                <option value="Reserva">Reserva de Emergência</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          )}

          {/* Imprevisto specific fields */}
          {target.kind === "imprevisto" && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Saúde">Saúde / Farmácia</option>
                <option value="Veículo">Veículo / Manutenção</option>
                <option value="Casa">Casa / Reparo</option>
                <option value="Família">Família / Apoio</option>
                <option value="Multa / Taxa">Multa / Taxa</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
