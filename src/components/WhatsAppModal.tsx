import React, { useState } from "react";
import {
  MessageSquareText,
  X,
  Wand2,
  Check,
  RotateCcw,
  Loader2,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";
import { ExtractedItem, TransactionType } from "../types";
import { formatBRL } from "../utils/formatters";
import { parseTransactionsHeuristic } from "../utils/whatsappParser";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmTransactions: (items: ExtractedItem[]) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  onConfirmTransactions,
}) => {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [aiEngineNote, setAiEngineNote] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickExamples = [
    {
      label: "Exemplo Completo Mensal",
      text: "Aluguel 1800\nMercado 350 no BB\nAporte 600 em acoes\nRecebi salario 6500\nLanche 55 no C6\nCompra 129 na Amazon\nRemedio 85 imprevisto farmacia\nInternet 110",
    },
    {
      label: "Dia a Dia & Cartões",
      text: "Mercado 280 no BB, Gasolina 210 no BB, Jantar 140 no C6, Farmacia 60 no C6, Assinatura 39 na Amazon",
    },
    {
      label: "Pix & Entradas",
      text: "Pix recebido 1200 cliente freelance, Dividendo recebido 350, Aporte 1000 no Tesouro Selic",
    },
  ];

  const handleExtract = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setAiEngineNote(null);

    try {
      const res = await fetch("/api/ai/extract-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          const itemsWithSelection: ExtractedItem[] = data.items.map((i: any) => ({
            ...i,
            selected: true,
          }));
          setExtractedItems(itemsWithSelection);
          setHasExtracted(true);
          if (data.note) {
            setAiEngineNote(data.note);
          }
          return;
        }
      }
      throw new Error("API indisponível");
    } catch (err) {
      console.warn("Utilizando motor de extração local no cliente:", err);
      const localItems = parseTransactionsHeuristic(inputText);
      setExtractedItems(localItems);
      setHasExtracted(true);
      setAiEngineNote("Processado pelo motor local instantâneo.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    setExtractedItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = extractedItems.every((i) => i.selected);
    setExtractedItems((prev) =>
      prev.map((item) => ({ ...item, selected: !allSelected }))
    );
  };

  const updateItemType = (index: number, newType: TransactionType) => {
    setExtractedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, type: newType } : item))
    );
  };

  const updateItemCard = (index: number, newCard: string) => {
    setExtractedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, card: newCard } : item))
    );
  };

  const handleConfirm = () => {
    const selected = extractedItems.filter((i) => i.selected);
    if (selected.length === 0) return;
    onConfirmTransactions(selected);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setExtractedItems([]);
    setHasExtracted(false);
    setInputText("");
    setAiEngineNote(null);
  };

  const selectedCount = extractedItems.filter((i) => i.selected).length;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-2xl rounded-3xl p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Extração Inteligente via WhatsApp</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  Gemini AI
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Cole conversas de grupos, recibos ou anotações para classificar lançamentos automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Quick Examples */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Exemplos rápidos (clique para preencher e testar):
            </span>
            <div className="flex flex-wrap gap-2">
              {quickExamples.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(ex.text)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>{ex.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Cole aqui as mensagens do WhatsApp... Ex:&#10;Aluguel 1800&#10;Mercado 250 no BB&#10;Aporte 500 em ações&#10;Salario recebido 6500&#10;Lanche 45 no C6&#10;Remedio 80 imprevisto"
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-mono leading-relaxed"
            />
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
              <span>Analisando mensagens e identificando valores, cartões e categorias com Gemini...</span>
            </div>
          )}

          {/* Extracted Results Preview */}
          {hasExtracted && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>Itens Identificados ({selectedCount} selecionados):</span>
                </h4>
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {extractedItems.every((i) => i.selected) ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Desmarcar Todos</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Selecionar Todos</span>
                    </>
                  )}
                </button>
              </div>

              {aiEngineNote && (
                <p className="text-[11px] text-amber-400/90 italic">{aiEngineNote}</p>
              )}

              <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 w-8 text-center">OK</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5">Cartão/Ref</th>
                      <th className="p-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {extractedItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500">
                          Nenhum lançamento identificado no texto. Tente adicionar os valores com clareza.
                        </td>
                      </tr>
                    ) : (
                      extractedItems.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            item.selected ? "bg-slate-800/30" : "opacity-40"
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(idx)}
                              className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5">
                            <select
                              value={item.type}
                              onChange={(e) =>
                                updateItemType(idx, e.target.value as TransactionType)
                              }
                              className="bg-slate-900 border border-slate-700 rounded-lg p-1 text-[11px] text-white focus:outline-none"
                            >
                              <option value="receita">Receita</option>
                              <option value="gasto_fixo">Gasto Fixo</option>
                              <option value="cartao">Cartão</option>
                              <option value="investimento">Investimento</option>
                              <option value="imprevisto">Imprevisto</option>
                            </select>
                          </td>
                          <td className="p-2.5 font-medium text-white">{item.description}</td>
                          <td className="p-2.5">
                            {item.type === "cartao" ? (
                              <select
                                value={item.card || "BB"}
                                onChange={(e) => updateItemCard(idx, e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg p-1 text-[11px] text-purple-300 focus:outline-none"
                              >
                                <option value="BB">BB</option>
                                <option value="C6">C6</option>
                                <option value="Amazon">Amazon</option>
                              </select>
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-white font-mono">
                            {formatBRL(item.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 shrink-0">
          {hasExtracted ? (
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recomeçar</span>
            </button>
          ) : (
            <div></div>
          )}

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {!hasExtracted ? (
              <button
                disabled={isLoading || !inputText.trim()}
                onClick={handleExtract}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Extrair com Gemini AI</span>
                  </>
                )}
              </button>
            ) : (
              <button
                disabled={selectedCount === 0}
                onClick={handleConfirm}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Adicionar {selectedCount} Lançamento(s)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
