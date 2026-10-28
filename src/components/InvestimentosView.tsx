import React, { useState, useMemo } from "react";
import {
  PlusCircle,
  Trash2,
  Edit3,
  PiggyBank,
  Target,
  TrendingUp,
  PieChart,
  Check,
  X,
  Coins,
  Building2,
  Percent,
  CalendarDays,
  Sparkles,
  Calculator,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Investimento } from "../types";
import { formatBRL, formatDateBR, getTodayISO } from "../utils/formatters";
import { EditTransactionModal } from "./EditTransactionModal";

interface InvestimentosViewProps {
  investimentos: Investimento[];
  totalReceita: number;
  onAddInvestimento: (inv: Omit<Investimento, "id">) => void;
  onUpdateInvestimento: (inv: Investimento) => void;
  onDeleteInvestimento: (id: string) => void;
  onReplicateInvestimentos?: () => void;
}

// Preset indexers commonly used in Brazil
export const INDEXADOR_PRESETS = [
  { label: "100% CDI (10,65% a.a.)", indexador: "100% CDI", taxaAnual: 10.65 },
  { label: "102% CDI (10,86% a.a.)", indexador: "102% CDI", taxaAnual: 10.86 },
  { label: "105% CDI (11,18% a.a.)", indexador: "105% CDI", taxaAnual: 11.18 },
  { label: "110% CDI (11,71% a.a.)", indexador: "110% CDI", taxaAnual: 11.71 },
  { label: "115% CDI (12,25% a.a.)", indexador: "115% CDI", taxaAnual: 12.25 },
  { label: "120% CDI (12,78% a.a.)", indexador: "120% CDI", taxaAnual: 12.78 },
  { label: "Selic (10,75% a.a.)", indexador: "Selic", taxaAnual: 10.75 },
  { label: "IPCA + 6,0% a.a. (~10,24% a.a.)", indexador: "IPCA + 6%", taxaAnual: 10.24 },
  { label: "Pré-fixado 12,0% a.a.", indexador: "Pré-fixado 12%", taxaAnual: 12.0 },
  { label: "Poupança (~6,17% a.a.)", indexador: "Poupança", taxaAnual: 6.17 },
  { label: "Ações / FIIs (~0,85% a.m.)", indexador: "Dividendos FIIs", taxaAnual: 10.7 },
  { label: "Personalizado", indexador: "Personalizado", taxaAnual: 10.65 },
];

export const InvestimentosView: React.FC<InvestimentosViewProps> = ({
  investimentos,
  totalReceita,
  onAddInvestimento,
  onUpdateInvestimento,
  onDeleteInvestimento,
}) => {
  const [description, setDescription] = useState("");
  const [institution, setInstitution] = useState("C6 Bank");
  const [customInstitution, setCustomInstitution] = useState("");
  const [type, setType] = useState<Investimento["type"]>("Reserva");
  const [amount, setAmount] = useState("");
  const [aporteMensal, setAporteMensal] = useState("");
  const [selectedIndexadorPreset, setSelectedIndexadorPreset] = useState("102% CDI (10,86% a.a.)");
  const [indexador, setIndexador] = useState("102% CDI");
  const [taxaAnual, setTaxaAnual] = useState("10.86");
  const [liquidez, setLiquidez] = useState("Imediata (D+0)");
  const [date, setDate] = useState(getTodayISO(0));
  const [editingInvestimento, setEditingInvestimento] = useState<Investimento | null>(null);

  // Quick inline edit of invested amount
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineAmount, setInlineAmount] = useState("");

  // Projection simulator controls
  const [simProjectionMonths, setSimProjectionMonths] = useState<number>(6);
  const [simMonthlyContribution, setSimMonthlyContribution] = useState<string>("");

  const startInlineEdit = (item: Investimento) => {
    setInlineEditingId(item.id);
    setInlineAmount(item.amount.toString());
  };

  const handleInlineSave = (item: Investimento) => {
    const val = parseFloat(inlineAmount.replace(",", "."));
    if (!isNaN(val) && val >= 0) {
      onUpdateInvestimento({ ...item, amount: val });
    }
    setInlineEditingId(null);
  };

  const handleIndexadorPresetChange = (presetLabel: string) => {
    setSelectedIndexadorPreset(presetLabel);
    const found = INDEXADOR_PRESETS.find((p) => p.label === presetLabel);
    if (found) {
      setIndexador(found.indexador);
      setTaxaAnual(found.taxaAnual.toString());
    }
  };

  // Portfolio aggregates
  const totalInvestido = useMemo(() => {
    return investimentos.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  }, [investimentos]);

  const totalAportadoMes = useMemo(() => {
    return investimentos.reduce(
      (sum, i) => sum + (typeof i.aporteMensal === "number" ? i.aporteMensal : 0),
      0
    );
  }, [investimentos]);

  const taxaPoupanca = totalReceita > 0 ? (totalAportadoMes / totalReceita) * 100 : 0;

  // Monthly passive yield calculated from specific indexers
  const rendimentoMensalTotal = useMemo(() => {
    return investimentos.reduce((sum, item) => {
      const val = Number(item.amount) || 0;
      if (val <= 0) return sum;
      const annual = typeof item.taxaAnual === "number" && item.taxaAnual > 0 ? item.taxaAnual : 10.65;
      const monthlyRate = Math.pow(1 + annual / 100, 1 / 12) - 1;
      return sum + val * monthlyRate;
    }, 0);
  }, [investimentos]);

  const rentabilidadeMediaAnual = useMemo(() => {
    if (totalInvestido <= 0) return 10.65;
    const weightedSum = investimentos.reduce((sum, i) => {
      const val = Number(i.amount) || 0;
      const rate = typeof i.taxaAnual === "number" && i.taxaAnual > 0 ? i.taxaAnual : 10.65;
      return sum + val * rate;
    }, 0);
    return weightedSum / totalInvestido;
  }, [investimentos, totalInvestido]);

  // Breakdown by asset class
  const classBreakdown = useMemo(() => {
    return investimentos.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + (Number(item.amount) || 0);
      return acc;
    }, {} as Record<string, number>);
  }, [investimentos]);

  // Breakdown by financial institution
  const institutionBreakdown = useMemo(() => {
    return investimentos.reduce((acc, item) => {
      const inst = item.institution || "Outro";
      acc[inst] = (acc[inst] || 0) + (Number(item.amount) || 0);
      return acc;
    }, {} as Record<string, number>);
  }, [investimentos]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valAmount = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(valAmount) || valAmount < 0) return;

    const valAporte = aporteMensal.trim() ? parseFloat(aporteMensal.replace(",", ".")) : undefined;
    const valTaxa = parseFloat(taxaAnual.replace(",", "."));

    const finalInstitution =
      institution === "Outro" ? customInstitution.trim() || "Outro" : institution;

    onAddInvestimento({
      description: description.trim(),
      institution: finalInstitution,
      type,
      amount: valAmount,
      aporteMensal: !isNaN(valAporte || NaN) ? valAporte : undefined,
      indexador: indexador.trim() || "100% CDI",
      taxaAnual: !isNaN(valTaxa) && valTaxa > 0 ? valTaxa : 10.65,
      liquidez,
      date: date || getTodayISO(0),
    });

    setDescription("");
    setAmount("");
    setAporteMensal("");
  };

  // Month-by-month future projections
  const projectionTable = useMemo(() => {
    const list: Array<{
      monthOffset: number;
      label: string;
      startingBalance: number;
      interestEarned: number;
      contribution: number;
      endingBalance: number;
    }> = [];

    let currentBalance = totalInvestido;
    const extraContribution = parseFloat(simMonthlyContribution.replace(",", ".")) || 0;
    const monthlyRate = Math.pow(1 + rentabilidadeMediaAnual / 100, 1 / 12) - 1;

    const baseDate = new Date();
    // Default reference month is December 2026
    const startYear = 2026;
    const startMonth = 11; // 0-indexed: 11 = December

    for (let i = 1; i <= simProjectionMonths; i++) {
      const projDate = new Date(startYear, startMonth + i, 1);
      const monthNames = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];
      const monthLabel = `${monthNames[projDate.getMonth()]}/${projDate.getFullYear().toString().slice(2)}`;

      const interest = currentBalance * monthlyRate;
      const ending = currentBalance + interest + extraContribution;

      list.push({
        monthOffset: i,
        label: monthLabel,
        startingBalance: currentBalance,
        interestEarned: interest,
        contribution: extraContribution,
        endingBalance: ending,
      });

      currentBalance = ending;
    }

    return list;
  }, [totalInvestido, rentabilidadeMediaAnual, simProjectionMonths, simMonthlyContribution]);

  const badgeTypeColor: Record<string, string> = {
    "Renda Fixa": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Ações: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    FIIs: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    Cripto: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Reserva: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    Outros: "bg-slate-800 text-slate-300 border-slate-700",
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invested Portfolio (Onde está o dinheiro) */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-cyan-500 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Patrimônio Investido
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight font-mono">
              {formatBRL(totalInvestido)}
            </h2>
            <p className="text-xs text-cyan-400 mt-1 flex items-center gap-1 font-medium">
              <span>Posição total permanente da carteira</span>
            </p>
          </div>
        </div>

        {/* Prévia de Juros / Rendimento Mensal */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-emerald-500 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Prévia de Juros / Mês
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight font-mono">
              +{formatBRL(rendimentoMensalTotal)}
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
              <span>Rentabilidade média: {rentabilidadeMediaAnual.toFixed(2)}% a.a.</span>
            </p>
          </div>
        </div>

        {/* Taxa de Rendimento Diário / Mensal */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-purple-500 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Rendimento Médio Mensal
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight font-mono">
              {((Math.pow(1 + rentabilidadeMediaAnual / 100, 1 / 12) - 1) * 100).toFixed(2)}% a.m.
            </h2>
            <p className="text-xs text-purple-300 mt-1 flex items-center gap-1 font-medium">
              <span>{investimentos.length} ativos indexados</span>
            </p>
          </div>
        </div>

        {/* Aporte Novo no Mês */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 border-l-4 border-l-amber-500 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Aporte Novo no Mês
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight font-mono">
              {formatBRL(totalAportadoMes)}
            </h2>
            <p className="text-xs text-amber-400/90 mt-1 flex items-center gap-1 font-medium">
              <span>
                {totalAportadoMes > 0
                  ? `${taxaPoupanca.toFixed(1)}% da receita poupada`
                  : "Sem novos aportes neste mês"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Cadastrar ou Atualizar Posição de Investimento */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cadastrar / Atualizar Ativo</h3>
              <p className="text-[11px] text-slate-400">
                Guarde onde o dinheiro está e a taxa indexadora
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Nome do Ativo / Investimento
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: CDB Liquidez Diária, Tesouro Selic 2029, LCA BB"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Instituição / Banco</span>
                </label>
                <select
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="C6 Bank">C6 Bank</option>
                  <option value="Banco do Brasil">Banco do Brasil (BB)</option>
                  <option value="Tesouro Direto">Tesouro Direto</option>
                  <option value="XP Investimentos">XP Investimentos</option>
                  <option value="Nubank">Nubank / NuInvest</option>
                  <option value="BTG Pactual">BTG Pactual</option>
                  <option value="Inter">Banco Inter</option>
                  <option value="Outro">Outro</option>
                </select>
                {institution === "Outro" && (
                  <input
                    type="text"
                    value={customInstitution}
                    onChange={(e) => setCustomInstitution(e.target.value)}
                    placeholder="Nome da instituição"
                    className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl p-2 text-white focus:border-cyan-500 focus:outline-none text-xs"
                  />
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Classe do Ativo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as Investimento["type"])}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="Reserva">Reserva de Emergência</option>
                  <option value="Renda Fixa">Renda Fixa (CDB, Tesouro, LCA)</option>
                  <option value="Ações">Ações (Bolsa)</option>
                  <option value="FIIs">FIIs (Fundos Imobiliários)</option>
                  <option value="Cripto">Criptoativos / Bitcoin</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Valor Total Investido (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.00"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-900 border border-cyan-500/50 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:border-cyan-400 focus:outline-none text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Aporte deste Mês (Opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.00"
                  value={aporteMensal}
                  onChange={(e) => setAporteMensal(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Indexador Selection */}
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Taxa Indexadora</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-bold">
                  {taxaAnual ? `${taxaAnual}% a.a.` : ""}
                </span>
              </label>
              <select
                value={selectedIndexadorPreset}
                onChange={(e) => handleIndexadorPresetChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none"
              >
                {INDEXADOR_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Taxa Anual (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={taxaAnual}
                  onChange={(e) => setTaxaAnual(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Liquidez</label>
                <select
                  value={liquidez}
                  onChange={(e) => setLiquidez(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="Imediata (D+0)">Imediata (D+0)</option>
                  <option value="Diária (D+1)">Diária (D+1)</option>
                  <option value="No Vencimento">No Vencimento</option>
                  <option value="Longo Prazo">Longo Prazo</option>
                </select>
              </div>
            </div>

            {/* Quick yield preview for the entered amount */}
            {parseFloat(amount) > 0 && (
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-cyan-400 block">
                  Estimativa de Juros deste Ativo:
                </span>
                <div className="flex items-center justify-between text-white font-mono">
                  <span>Juros mensais previstos:</span>
                  <span className="font-bold text-emerald-400">
                    +
                    {formatBRL(
                      (parseFloat(amount) || 0) *
                        (Math.pow(1 + (parseFloat(taxaAnual) || 10.65) / 100, 1 / 12) - 1)
                    )}
                    /mês
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 font-bold text-slate-950 rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 text-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Salvar Posição na Carteira</span>
            </button>
          </form>
        </div>

        {/* Table: Carteira de Ativos & Onde está o Dinheiro */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Onde está o Dinheiro (Carteira Consolidada)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Seu patrimônio investido fica sempre salvo e rende juros compostos
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                Total Investido
              </span>
              <span className="text-base font-extrabold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/20 inline-block font-mono">
                {formatBRL(totalInvestido)}
              </span>
            </div>
          </div>

          {/* Breakdown Pills by Institution */}
          {Object.keys(institutionBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-950/40 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold self-center mr-1">
                Custódia:
              </span>
              {Object.entries(institutionBreakdown).map(([inst, rawVal]) => {
                const val = Number(rawVal) || 0;
                return (
                  <div
                    key={inst}
                    className="text-xs flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80"
                  >
                    <Building2 className="w-3 h-3 text-cyan-400" />
                    <span className="text-slate-300 font-bold">{inst}:</span>
                    <span className="text-white font-mono">{formatBRL(val)}</span>
                    <span className="text-[10px] text-cyan-400">
                      ({((val / (totalInvestido || 1)) * 100).toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3 font-semibold">Ativo / Instituição</th>
                  <th className="py-3 px-3 font-semibold">Classe</th>
                  <th className="py-3 px-3 font-semibold">Taxa Indexadora</th>
                  <th className="py-3 px-3 text-right font-semibold">
                    Valor Investido{" "}
                    <span className="normal-case font-normal text-slate-500 text-[10px]">
                      (clique p/ editar)
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right font-semibold text-emerald-400">
                    Juros Previstos/mês
                  </th>
                  <th className="py-3 px-3 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {investimentos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Nenhum ativo cadastrado na carteira ainda. Adicione sua primeira posição no
                      formulário ao lado.
                    </td>
                  </tr>
                ) : (
                  investimentos.map((i) => {
                    const annual =
                      typeof i.taxaAnual === "number" && i.taxaAnual > 0 ? i.taxaAnual : 10.65;
                    const monthlyRate = Math.pow(1 + annual / 100, 1 / 12) - 1;
                    const estimatedMonthlyInterest = (Number(i.amount) || 0) * monthlyRate;

                    return (
                      <tr key={i.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="py-3 px-3 font-medium text-white">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-100">{i.description}</span>
                            <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              {i.institution || "C6 Bank"} • {i.liquidez || "Imediata (D+0)"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              badgeTypeColor[i.type] || "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {i.type}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 w-fit">
                              {i.indexador || "102% CDI"}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {annual.toFixed(2)}% a.a. (~{(monthlyRate * 100).toFixed(2)}% a.m.)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {inlineEditingId === i.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={inlineAmount}
                                onChange={(e) => setInlineAmount(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleInlineSave(i);
                                  if (e.key === "Escape") setInlineEditingId(null);
                                }}
                                className="w-28 bg-slate-900 border border-cyan-400 text-white font-mono text-xs rounded px-2 py-1 text-right focus:outline-none shadow-inner"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleInlineSave(i)}
                                className="text-emerald-400 hover:text-emerald-300 p-1 hover:bg-emerald-500/20 rounded"
                                title="Salvar saldo"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineEditingId(null)}
                                className="text-slate-400 hover:text-rose-400 p-1 hover:bg-rose-500/20 rounded"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => startInlineEdit(i)}
                              className="inline-flex items-center gap-1.5 cursor-pointer group/val justify-end py-1 px-2 rounded hover:bg-slate-800/80 transition-colors"
                              title="Clique para atualizar o saldo investido deste ativo"
                            >
                              <span className="font-extrabold text-cyan-300 font-mono text-xs group-hover/val:text-cyan-200">
                                {formatBRL(i.amount)}
                              </span>
                              <Edit3 className="w-3 h-3 text-slate-500 opacity-60 group-hover/val:opacity-100 transition-opacity text-cyan-400" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          +{formatBRL(estimatedMonthlyInterest)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditingInvestimento(i)}
                              className="text-slate-400 hover:text-cyan-300 p-1 rounded-md hover:bg-slate-800 transition-colors"
                              title="Editar ativo completo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteInvestimento(i.id)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded-md hover:bg-slate-800"
                              title="Remover ativo"
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

      {/* Simulator: Prévia dos Juros nos Meses Seguintes */}
      <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Simulador & Prévia dos Juros nos Meses Seguintes</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  Juros Compostos
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Projeção do crescimento do seu dinheiro com base nas taxas indexadoras
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setSimProjectionMonths(3)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  simProjectionMonths === 3
                    ? "bg-emerald-600 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                3 Meses
              </button>
              <button
                type="button"
                onClick={() => setSimProjectionMonths(6)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  simProjectionMonths === 6
                    ? "bg-emerald-600 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                6 Meses
              </button>
              <button
                type="button"
                onClick={() => setSimProjectionMonths(12)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  simProjectionMonths === 12
                    ? "bg-emerald-600 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                12 Meses (1 Ano)
              </button>
            </div>
          </div>
        </div>

        {/* Projection Simulator Cards / Table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-950/40 rounded-xl border border-slate-800">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">
              Rendimento em {simProjectionMonths} Meses
            </span>
            <p className="text-xl font-black text-emerald-400 font-mono mt-1">
              +
              {formatBRL(
                projectionTable.reduce((sum, p) => sum + p.interestEarned, 0)
              )}
            </p>
            <span className="text-[10px] text-slate-400">
              Lucro passivo gerado apenas pelos juros da carteira
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">
              Patrimônio Projetado
            </span>
            <p className="text-xl font-black text-cyan-400 font-mono mt-1">
              {formatBRL(
                projectionTable[projectionTable.length - 1]?.endingBalance || totalInvestido
              )}
            </p>
            <span className="text-[10px] text-slate-400">
              Saldo final ao término de {simProjectionMonths} meses
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 uppercase block mb-1">
              Simular Aporte Mensal Extra:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="50"
                min="0"
                value={simMonthlyContribution}
                onChange={(e) => setSimMonthlyContribution(e.target.value)}
                placeholder="Ex: 500,00"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {simMonthlyContribution && (
                <button
                  type="button"
                  onClick={() => setSimMonthlyContribution("")}
                  className="text-slate-400 hover:text-rose-400 text-xs px-2 py-1"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Month by month projection breakdown */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Mês</th>
                <th className="py-2.5 px-3 text-right font-semibold">Saldo Inicial</th>
                <th className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                  + Juros do Mês
                </th>
                {parseFloat(simMonthlyContribution) > 0 && (
                  <th className="py-2.5 px-3 text-right font-semibold text-cyan-400">
                    + Aporte Simulado
                  </th>
                )}
                <th className="py-2.5 px-3 text-right font-semibold text-white">
                  = Saldo Projetado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {projectionTable.map((p) => (
                <tr key={p.monthOffset} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3 text-cyan-400" />
                    <span>{p.label}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                    {formatBRL(p.startingBalance)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                    +{formatBRL(p.interestEarned)}
                  </td>
                  {parseFloat(simMonthlyContribution) > 0 && (
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-400">
                      +{formatBRL(p.contribution)}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono font-extrabold text-white">
                    {formatBRL(p.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingInvestimento && (
        <EditTransactionModal
          isOpen={!!editingInvestimento}
          onClose={() => setEditingInvestimento(null)}
          target={{ kind: "investimento", item: editingInvestimento }}
          onSaveInvestimento={(updated) => {
            onUpdateInvestimento(updated);
            setEditingInvestimento(null);
          }}
        />
      )}
    </div>
  );
};
