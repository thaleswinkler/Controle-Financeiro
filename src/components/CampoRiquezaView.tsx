import React, { useState } from "react";
import {
  Gem,
  PenLine,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Target,
  Sparkles,
  Zap,
} from "lucide-react";
import { FinancialMetrics } from "../types";
import { formatBRL } from "../utils/formatters";

interface CampoRiquezaViewProps {
  metrics: FinancialMetrics;
  metaRiqueza: number;
  investimentoAcumuladoAnterior: number;
  onUpdateMeta: (newMeta: number) => void;
  onUpdateInvestimentoAnterior: (newVal: number) => void;
}

export const CampoRiquezaView: React.FC<CampoRiquezaViewProps> = ({
  metrics,
  metaRiqueza,
  investimentoAcumuladoAnterior,
  onUpdateMeta,
  onUpdateInvestimentoAnterior,
}) => {
  const [editingMeta, setEditingMeta] = useState(false);
  const [tempMeta, setTempMeta] = useState(metaRiqueza.toString());

  const [editingAnterior, setEditingAnterior] = useState(false);
  const [tempAnterior, setTempAnterior] = useState(investimentoAcumuladoAnterior.toString());

  const progressPercent = Math.min(
    100,
    metaRiqueza > 0 ? (metrics.patrimonioLiquido / metaRiqueza) * 100 : 0
  );

  const missingForGoal = Math.max(0, metaRiqueza - metrics.patrimonioLiquido);
  const monthlyContribution = metrics.totalInvestimentosMes > 0 ? metrics.totalInvestimentosMes : 500;
  const monthsToGoal =
    monthlyContribution > 0 ? Math.ceil(missingForGoal / monthlyContribution) : 0;

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempMeta.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      onUpdateMeta(val);
      setEditingMeta(false);
    }
  };

  const handleSaveAnterior = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempAnterior.replace(",", "."));
    if (!isNaN(val) && val >= 0) {
      onUpdateInvestimentoAnterior(val);
      setEditingAnterior(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wealth Hero Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 rounded-3xl p-6 lg:p-8 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Visão Consolidada de Liberdade Financeira
              </span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
              Patrimônio Líquido Acumulado
            </h2>
            <p className="text-xs lg:text-sm text-slate-300 leading-relaxed">
              Consolidação de todos os investimentos realizados somados ao saldo líquido em conta do mês. Cada centavo acumulado trabalha gerando renda passiva no tempo.
            </p>
          </div>

          <div className="bg-slate-950/90 border border-amber-500/30 p-5 rounded-2xl text-left lg:text-right shadow-xl min-w-[240px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Geral Riqueza
            </span>
            <span className="text-3xl lg:text-4xl font-black text-amber-400 font-mono block mt-1">
              {formatBRL(metrics.patrimonioLiquido)}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Investimentos + Saldo Livre
            </span>
          </div>
        </div>
      </div>

      {/* Goal & Fire Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Goal Card */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              <span>Meta de Patrimônio</span>
            </h4>
            <button
              onClick={() => {
                setTempMeta(metaRiqueza.toString());
                setEditingMeta(!editingMeta);
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <PenLine className="w-3 h-3" />
              <span>{editingMeta ? "Cancelar" : "Editar Meta"}</span>
            </button>
          </div>

          {editingMeta ? (
            <form onSubmit={handleSaveMeta} className="space-y-2">
              <label className="text-[11px] text-slate-400">Novo valor da meta (R$):</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="1000"
                  value={tempMeta}
                  onChange={(e) => setTempMeta(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-xl p-2 text-xs text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Progresso Atual</span>
                <span className="font-bold text-amber-400 font-mono">
                  {progressPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-yellow-300 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-2.5">
                <span>Faltam {formatBRL(missingForGoal)}</span>
                <span className="text-white font-extrabold font-mono">
                  Meta: {formatBRL(metaRiqueza)}
                </span>
              </div>
            </div>
          )}

          {/* Time to reach projection */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
            <span className="font-bold text-amber-400 block mb-0.5">Projeção com Aporte Atual:</span>
            <p className="text-[11px] text-slate-400">
              Mantendo aportes de <strong className="text-white">{formatBRL(monthlyContribution)}/mês</strong>, você alcança a meta em aproximadamente{" "}
              <strong className="text-amber-400">{monthsToGoal} meses</strong> ({(monthsToGoal / 12).toFixed(1)} anos).
            </p>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Gem className="w-4 h-4 text-cyan-400" />
              <span>Composição da Riqueza</span>
            </h4>
            <button
              onClick={() => {
                setTempAnterior(investimentoAcumuladoAnterior.toString());
                setEditingAnterior(!editingAnterior);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <PenLine className="w-3 h-3" />
              <span>{editingAnterior ? "Cancelar" : "Ajustar Saldo Prévio"}</span>
            </button>
          </div>

          {editingAnterior ? (
            <form onSubmit={handleSaveAnterior} className="space-y-2">
              <label className="text-[11px] text-slate-400">Investimento Acumulado Anterior (R$):</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="500"
                  value={tempAnterior}
                  onChange={(e) => setTempAnterior(e.target.value)}
                  className="w-full bg-slate-900 border border-cyan-500/40 rounded-xl p-2 text-xs text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                  <span>Investimentos Totais</span>
                </span>
                <span className="font-extrabold text-white font-mono">
                  {formatBRL(metrics.totalInvestidoAcumulado)}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span>Saldo Livre em Conta (Mês)</span>
                </span>
                <span className="font-extrabold text-white font-mono">
                  {formatBRL(Math.max(0, metrics.saldoMensal))}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px]">
                <span className="text-slate-500">Saldo Histórico Anterior</span>
                <span className="text-slate-400 font-mono">
                  {formatBRL(investimentoAcumuladoAnterior)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* FIRE / Regra dos 4% & Renda Passiva */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Renda Passiva Mensal (Regra 4%)
            </h4>
          </div>

          <p className="text-xs text-slate-400">
            Estimativa de rendimento real passivo líquido gerado mensalmente pelo seu patrimônio investido (~0.8% a.m.):
          </p>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono block">
              {formatBRL(metrics.rendimentoPassivoEst)} <span className="text-xs font-semibold text-emerald-300">/mês</span>
            </span>
            <p className="text-[11px] text-emerald-200/80 mt-1">
              Sem precisar trabalhar para receber.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cobertura dos Gastos Fixos:</span>
              <span className="font-extrabold text-amber-400 font-mono">
                {metrics.coberturaGastosFixosPct.toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Quando atingir 100%, seus rendimentos cobrirão 100% de moradia e contas essenciais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
