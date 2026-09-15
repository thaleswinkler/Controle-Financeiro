export type TransactionType = "receita" | "gasto_fixo" | "cartao" | "investimento" | "imprevisto";

export interface Receita {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
}

export interface GastoFixo {
  id: string;
  description: string;
  amount: number;
  date: string; // Vencimento (YYYY-MM-DD)
  status: "pago" | "pendente";
  category?: string;
  recurring?: boolean;
}

export interface GastoCartao {
  id: string;
  card: string; // "BB" | "C6" | "Amazon" | string
  description: string;
  amount: number;
  date: string;
  installments?: string; // ex: "1/3", "à vista"
  category?: string;
}

export interface Investimento {
  id: string;
  description: string;
  type: "Renda Fixa" | "Ações" | "FIIs" | "Cripto" | "Reserva" | "Outros";
  amount: number;
  date: string;
}

export interface GastoImprevisto {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
}

export interface CardConfig {
  id: string;
  name: string;
  bankName: string;
  brandColor: string; // Tailwind color or hex
  accentColor: string;
  limit: number;
  closingDay: number;
  dueDay: number;
}

export interface FinancialData {
  monthYear: string; // "2026-09"
  receitas: Receita[];
  gastosFixos: GastoFixo[];
  cartoes: GastoCartao[];
  investimentos: Investimento[];
  imprevistos: GastoImprevisto[];
  metaRiqueza: number;
  investimentoAcumuladoAnterior: number;
  cards: CardConfig[];
}

export interface FinancialMetrics {
  totalReceita: number;
  totalFixos: number;
  totalFixosPagos: number;
  totalFixosPendentes: number;
  totalCartoes: number;
  totalImprevistos: number;
  totalGastos: number;
  saldoMensal: number;
  totalInvestimentosMes: number;
  totalInvestidoAcumulado: number;
  patrimonioLiquido: number;
  cardTotals: Record<string, number>;
  savingsRate: number; // %
  fixedExpenseRatio: number; // %
  cardExpenseRatio: number; // %
  rendimentoPassivoEst: number;
  coberturaGastosFixosPct: number;
}

export interface ExtractedItem {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  card?: string | null;
  category?: string;
  date: string;
  status?: "pago" | "pendente";
  selected?: boolean;
}

export interface AiDiagnostic {
  score: number;
  healthRating: string;
  diagnostico: string;
  recomendacoes: string[];
  usedAi: boolean;
}

export type TabType =
  | "resumo"
  | "receitas"
  | "gastos-fixos"
  | "cartoes"
  | "investimentos"
  | "imprevistos"
  | "riqueza";
