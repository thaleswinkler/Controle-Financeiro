import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  ShieldCheck,
  CheckCircle,
  Lightbulb,
  AlertTriangle,
  RotateCw,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { AiDiagnostic, FinancialData, FinancialMetrics } from "../types";

interface AiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: FinancialData;
  metrics: FinancialMetrics;
}

export const AiAdvisorModal: React.FC<AiAdvisorModalProps> = ({
  isOpen,
  onClose,
  data,
  metrics,
}) => {
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AiDiagnostic | null>(null);

  const fetchDiagnostic = async () => {
    setLoading(true);
    try {
      const payload = {
        totalReceita: metrics.totalReceita,
        totalFixos: metrics.totalFixos,
        totalCartoes: metrics.totalCartoes,
        totalBB: metrics.cardTotals["BB"] || 0,
        totalC6: metrics.cardTotals["C6"] || 0,
        totalAmazon: metrics.cardTotals["Amazon"] || 0,
        totalImprevistos: metrics.totalImprevistos,
        totalInvestimentosMes: metrics.totalInvestimentosMes,
        saldoMensal: metrics.saldoMensal,
        patrimonioLiquido: metrics.patrimonioLiquido,
        metaRiqueza: data.metaRiqueza,
      };

      const res = await fetch("/api/ai/financial-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (resData.success) {
        setDiagnostic(resData);
      }
    } catch (err) {
      console.error("Erro ao obter diagnóstico:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !diagnostic) {
      fetchDiagnostic();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const score = diagnostic?.score ?? 78;
  const rating = diagnostic?.healthRating ?? "Saudável";

  const getScoreColor = (sc: number) => {
    if (sc >= 80) return "text-emerald-400 border-emerald-500 bg-emerald-500/10";
    if (sc >= 60) return "text-cyan-400 border-cyan-500 bg-cyan-500/10";
    if (sc >= 40) return "text-amber-400 border-amber-500 bg-amber-500/10";
    return "text-rose-400 border-rose-500 bg-rose-500/10";
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Diagnóstico Financeiro com Inteligência Artificial</span>
              </h3>
              <p className="text-xs text-slate-400">
                Auditoria inteligente do seu fluxo de caixa e recomendações estratégicas
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

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-xs text-slate-300 font-medium">
              Consultando modelo de IA e calculando índices de solvência, poupança e liquidez...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Score Box */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Índice de Saúde Financeira (Score)
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-black text-white font-mono">{score}/100</span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getScoreColor(
                      score
                    )}`}
                  >
                    {rating}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Baseado na taxa de poupança ({metrics.savingsRate.toFixed(0)}%), custos fixos e uso dos cartões.
                </p>
              </div>

              <div
                className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black font-mono shrink-0 ${getScoreColor(
                  score
                )}`}
              >
                {score}
              </div>
            </div>

            {/* Diagnostic Paragraph */}
            {diagnostic?.diagnostico && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-white block mb-1">Diagnóstico Executivo:</span>
                <p>{diagnostic.diagnostico}</p>
              </div>
            )}

            {/* Recommendations List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>3 Recomendações Estratégicas:</span>
              </h4>
              <div className="space-y-2.5">
                {(diagnostic?.recomendacoes || [
                  "Mantenha seus custos fixos abaixo de 50% da sua receita líquida.",
                  "Acelere o pagamento de compras parceladas nos cartões de crédito para destravar limite.",
                  "Direcione todo o saldo livre excedente do mês para ativos de renda fixa ou FIIs para gerar juros compostos.",
                ]).map((rec, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-800/50 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-300"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <button
            onClick={fetchDiagnostic}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recalcular Diagnóstico</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
