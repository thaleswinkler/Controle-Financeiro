import { FinancialData, FinancialMetrics } from "../types";

export function formatBRL(value: number | undefined | null): string {
  const num = typeof value === "number" && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatPercent(value: number | undefined | null): string {
  const num = typeof value === "number" && !isNaN(value) ? value : 0;
  return `${num.toFixed(1).replace(".", ",")}%`;
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function getTodayISO(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  return d.toISOString().split("T")[0];
}

export function calculateMetrics(data: FinancialData): FinancialMetrics {
  const totalReceita = (data.receitas || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  
  const totalFixosPagos = (data.gastosFixos || [])
    .filter((f) => f.status === "pago")
    .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const totalFixosPendentes = (data.gastosFixos || [])
    .filter((f) => f.status === "pendente")
    .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const totalFixos = totalFixosPagos + totalFixosPendentes;

  const totalCartoes = (data.cartoes || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const totalImprevistos = (data.imprevistos || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  
  // Total da carteira investida (posições patrimoniais onde o dinheiro está alocado)
  const totalCarteiraInvestida = (data.investimentos || []).reduce(
    (acc, i) => acc + (Number(i.amount) || 0),
    0
  );
  
  // Aportes novos do mês (se especificado aporteMensal ou se for o total aportado)
  const totalInvestimentosMes = (data.investimentos || []).reduce(
    (acc, i) => acc + (typeof i.aporteMensal === "number" ? i.aporteMensal : 0),
    0
  );

  const totalGastos = totalFixos + totalCartoes + totalImprevistos;
  const saldoMensal = totalReceita - totalGastos;

  // Total investido acumulado: prioriza as posições declaradas na carteira
  const totalInvestidoAcumulado =
    totalCarteiraInvestida > 0
      ? totalCarteiraInvestida
      : Number(data.investimentoAcumuladoAnterior || 0);

  const patrimonioLiquido = totalInvestidoAcumulado + Math.max(0, saldoMensal);

  // Card specific totals
  const cardTotals: Record<string, number> = {};
  for (const card of data.cards) {
    cardTotals[card.id] = (data.cartoes || [])
      .filter((c) => c.card === card.id || c.card === card.name)
      .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  }

  const savingsRate = totalReceita > 0 ? (totalInvestimentosMes / totalReceita) * 100 : 0;
  const fixedExpenseRatio = totalReceita > 0 ? (totalFixos / totalReceita) * 100 : 0;
  const cardExpenseRatio = totalReceita > 0 ? (totalCartoes / totalReceita) * 100 : 0;

  // Rendimento passivo mensal estimado calculado pelos indexadores de cada ativo
  let rendimentoPassivoEst = 0;
  if ((data.investimentos || []).length > 0) {
    rendimentoPassivoEst = (data.investimentos || []).reduce((sum, item) => {
      const val = Number(item.amount) || 0;
      if (val <= 0) return sum;
      // Taxa anual padrão Selic/CDI ~10.65% a.a. se não definida
      const annualRate = typeof item.taxaAnual === "number" && item.taxaAnual > 0 ? item.taxaAnual : 10.65;
      const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
      return sum + val * monthlyRate;
    }, 0);
  } else {
    // Estimativa conservadora de ~0.85% ao mês sobre o patrimônio acumulado
    rendimentoPassivoEst = totalInvestidoAcumulado * (Math.pow(1 + 0.1065, 1 / 12) - 1);
  }
  const coberturaGastosFixosPct = totalFixos > 0 ? (rendimentoPassivoEst / totalFixos) * 100 : 0;

  return {
    totalReceita,
    totalFixos,
    totalFixosPagos,
    totalFixosPendentes,
    totalCartoes,
    totalImprevistos,
    totalGastos,
    saldoMensal,
    totalInvestimentosMes,
    totalInvestidoAcumulado,
    patrimonioLiquido,
    cardTotals,
    savingsRate,
    fixedExpenseRatio,
    cardExpenseRatio,
    rendimentoPassivoEst,
    coberturaGastosFixosPct,
  };
}

export function exportToCSV(data: FinancialData): void {
  const lines: string[] = [
    "Módulo,Descrição,Detalhe/Cartão,Data,Valor (R$),Status/Classe",
  ];

  (data.receitas || []).forEach((r) => {
    lines.push(`"Receita","${r.description.replace(/"/g, '""')}","${r.category || 'Entrada'}","${r.date}",${r.amount},"Recebido"`);
  });

  (data.gastosFixos || []).forEach((f) => {
    lines.push(`"Gasto Fixo","${f.description.replace(/"/g, '""')}","${f.category || 'Conta Recorrente'}","${f.date}",${f.amount},"${f.status}"`);
  });

  (data.cartoes || []).forEach((c) => {
    lines.push(`"Cartão","${c.description.replace(/"/g, '""')}","${c.card}","${c.date}",${c.amount},"${c.installments || 'À vista'}"`);
  });

  (data.investimentos || []).forEach((i) => {
    lines.push(`"Investimento","${i.description.replace(/"/g, '""')}","${i.type}","${i.date}",${i.amount},"Aportado"`);
  });

  (data.imprevistos || []).forEach((imp) => {
    lines.push(`"Imprevisto","${imp.description.replace(/"/g, '""')}","Emergência","${imp.date}",${imp.amount},"Pago"`);
  });

  const csvContent = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FinIq_Relatorio_${getTodayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
