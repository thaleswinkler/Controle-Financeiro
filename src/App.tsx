import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FinancialData,
  FinancialMetrics,
  TabType,
  ExtractedItem,
  Receita,
  GastoFixo,
  GastoCartao,
  Investimento,
  GastoImprevisto,
  CardConfig,
} from "./types";
import { INITIAL_DATA } from "./data/mockData";
import { calculateMetrics, getTodayISO } from "./utils/formatters";
import {
  generateInstallments,
  parseInstallmentString,
  getMonthYearFromDate,
  calculateInvoiceMonth,
  getDefaultReferenceMonth,
  projectMissingInstallmentsFromExpenses,
  mergeProjectedInstallments,
  cleanupMonthCartoes,
  makeExpenseSignature,
  makeGeneralExpenseKey,
  ScannedExpenseItem,
} from "./utils/installments";
import { Header } from "./components/Header";
import { NavigationTabs } from "./components/NavigationTabs";
import { ResumoView } from "./components/ResumoView";
import { ReceitasView } from "./components/ReceitasView";
import { GastosFixosView } from "./components/GastosFixosView";
import { CartoesView } from "./components/CartoesView";
import { InvestimentosView } from "./components/InvestimentosView";
import { ImprevistosView } from "./components/ImprevistosView";
import { WhatsAppModal } from "./components/WhatsAppModal";
import { AiAdvisorModal } from "./components/AiAdvisorModal";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { MobileSyncModal } from "./components/MobileSyncModal";
import { MonthAuditorModal } from "./components/MonthAuditorModal";
import {
  auth,
  subscribeToMonthData,
  saveMonthDataToCloud,
  addInstallmentsToCloud,
  removeInstallmentsFromCloud,
  getAllUserMonthsFromCloud,
  saveDeletionsToCloud,
  getDeletionsFromCloud,
  saveReceitasVaultToCloud,
  getReceitasVaultFromCloud,
  saveLastPeriodToCloud,
  getLastPeriodFromCloud,
  saveCardsToCloud,
  getCardsFromCloud,
  savePortfolioToCloud,
  getPortfolioFromCloud,
  getStoredCloudSession,
  logoutUser,
  CloudUserSession,
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const GLOBAL_CARDS_KEY = "fin_iq_cards_config_v2";
const STORAGE_KEY = "fin_iq_pro_data_v2";
const DELETED_KEYS_STORAGE = "fin_iq_deleted_expenses_v2";
const LAST_PERIOD_KEY = "fin_iq_last_selected_period";
const MASTER_RECEITAS_VAULT_KEY = "fin_iq_master_receitas_vault_v2";
const MASTER_PORTFOLIO_VAULT_KEY = "fin_iq_master_portfolio_vault_v2";

export function getStoredPortfolioVault(): Investimento[] {
  try {
    const raw = localStorage.getItem(MASTER_PORTFOLIO_VAULT_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  return INITIAL_DATA.investimentos;
}

export function savePortfolioToVault(portfolio: Investimento[], uid?: string) {
  if (!portfolio || portfolio.length === 0) return;
  try {
    localStorage.setItem(MASTER_PORTFOLIO_VAULT_KEY, JSON.stringify(portfolio));
    if (uid) {
      savePortfolioToCloud(uid, portfolio).catch(console.error);
    }
  } catch {}
}

export function replicateInvestmentsAcrossMonths(
  portfolio: Investimento[],
  fromMonthYear: string,
  currentUserUid?: string
) {
  if (!portfolio) return;
  savePortfolioToVault(portfolio, currentUserUid);

  let curM = fromMonthYear;
  for (let i = 0; i < 24; i++) {
    curM = getNextMonth(curM);
    try {
      const rawMonth = localStorage.getItem(`fin_iq_month_${curM}`);
      if (rawMonth) {
        const parsed = JSON.parse(rawMonth);
        parsed.investimentos = portfolio;
        localStorage.setItem(`fin_iq_month_${curM}`, JSON.stringify(parsed));
      }
    } catch {}

    if (currentUserUid) {
      let monthDataToSave: any = null;
      try {
        const raw = localStorage.getItem(`fin_iq_month_${curM}`);
        if (raw) monthDataToSave = JSON.parse(raw);
      } catch {}
      if (monthDataToSave) {
        saveMonthDataToCloud(currentUserUid, curM, monthDataToSave).catch(console.error);
      }
    }
  }
}

export function getPreviousMonth(monthYear: string): string {
  const [y, m] = monthYear.split("-").map(Number);
  let py = y;
  let pm = m - 1;
  if (pm < 1) {
    py--;
    pm = 12;
  }
  return `${py}-${String(pm).padStart(2, "0")}`;
}

export function getNextMonth(monthYear: string): string {
  const [y, m] = monthYear.split("-").map(Number);
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    ny++;
    nm = 1;
  }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// Load configured cards globally so changes apply across all months
export const loadStoredCards = (): CardConfig[] => {
  try {
    const savedCards = localStorage.getItem(GLOBAL_CARDS_KEY);
    if (savedCards) {
      if (
        savedCards.includes("Ourocard") ||
        savedCards.includes("5000") ||
        savedCards.includes("8000")
      ) {
        localStorage.removeItem(GLOBAL_CARDS_KEY);
        return INITIAL_DATA.cards;
      }
      const parsed = JSON.parse(savedCards);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return INITIAL_DATA.cards;
};

function getStoredReceitasVault(): Receita[] {
  try {
    const raw = localStorage.getItem(MASTER_RECEITAS_VAULT_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  return [];
}

function saveReceitasToVault(receitas: Receita[], uid?: string) {
  if (!receitas || receitas.length === 0) return;
  try {
    localStorage.setItem(MASTER_RECEITAS_VAULT_KEY, JSON.stringify(receitas));
    if (uid) {
      saveReceitasVaultToCloud(uid, receitas).catch(console.error);
    }
  } catch {}
}

/**
 * Finds the closest prior or any saved month that contains user data (receitas or gastos fixos)
 * to replicate as the starting baseline for a new month.
 */
function findPriorSourceMonth(targetMonth: string): FinancialData | null {
  // 1. Check immediate previous month
  const prev = getPreviousMonth(targetMonth);
  try {
    const rawPrev = localStorage.getItem(`fin_iq_month_${prev}`);
    if (rawPrev) {
      const parsed = JSON.parse(rawPrev);
      if (
        (Array.isArray(parsed?.receitas) && parsed.receitas.length > 0) ||
        (Array.isArray(parsed?.gastosFixos) && parsed.gastosFixos.length > 0)
      ) {
        return parsed;
      }
    }
  } catch {}

  // 2. Scan all saved months in localStorage prior to targetMonth (most recent first)
  try {
    const candidateMonths: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("fin_iq_month_")) {
        const m = key.replace("fin_iq_month_", "");
        if (/^\d{4}-\d{2}$/.test(m) && m < targetMonth) {
          candidateMonths.push(m);
        }
      }
    }
    candidateMonths.sort((a, b) => b.localeCompare(a));
    for (const m of candidateMonths) {
      const raw = localStorage.getItem(`fin_iq_month_${m}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          (Array.isArray(parsed?.receitas) && parsed.receitas.length > 0) ||
          (Array.isArray(parsed?.gastosFixos) && parsed.gastosFixos.length > 0)
        ) {
          return parsed;
        }
      }
    }

    // 3. Any other month with data (e.g. October if current is November, or vice-versa)
    const anyMonths: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("fin_iq_month_")) {
        const m = key.replace("fin_iq_month_", "");
        if (/^\d{4}-\d{2}$/.test(m) && m !== targetMonth) {
          anyMonths.push(m);
        }
      }
    }
    anyMonths.sort((a, b) => b.localeCompare(a));
    for (const m of anyMonths) {
      const raw = localStorage.getItem(`fin_iq_month_${m}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          (Array.isArray(parsed?.receitas) && parsed.receitas.length > 0) ||
          (Array.isArray(parsed?.gastosFixos) && parsed.gastosFixos.length > 0)
        ) {
          return parsed;
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Ensures any month always has user revenues replicated from the closest source month or vault.
 * All replicated items receive new unique IDs for targetMonthYear so editing values never affects the source month!
 */
export function ensureMonthReceitas(
  targetMonthYear: string,
  currentReceitas?: Receita[]
): Receita[] {
  if (Array.isArray(currentReceitas) && currentReceitas.length > 0) {
    return currentReceitas;
  }

  // 1. Try immediate previous month
  const prevMonth = getPreviousMonth(targetMonthYear);
  try {
    const rawPrev = localStorage.getItem(`fin_iq_month_${prevMonth}`);
    if (rawPrev) {
      const parsed = JSON.parse(rawPrev);
      if (Array.isArray(parsed?.receitas) && parsed.receitas.length > 0) {
        return parsed.receitas.map((r: Receita, idx: number) => ({
          ...r,
          id: `rec_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          date: `${targetMonthYear}-${(r.date || "").split("-")[2] || "05"}`,
        }));
      }
    }
  } catch {}

  // 2. Try findPriorSourceMonth
  const prior = findPriorSourceMonth(targetMonthYear);
  if (prior && Array.isArray(prior.receitas) && prior.receitas.length > 0) {
    return prior.receitas.map((r: Receita, idx: number) => ({
      ...r,
      id: `rec_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: `${targetMonthYear}-${(r.date || "").split("-")[2] || "05"}`,
    }));
  }

  // 3. Try master vault
  const vault = getStoredReceitasVault();
  if (vault.length > 0) {
    return vault.map((r: Receita, idx: number) => ({
      ...r,
      id: `rec_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: `${targetMonthYear}-${(r.date || "").split("-")[2] || "05"}`,
    }));
  }

  return [];
}

/**
 * Ensures any month always has recurring fixed expenses replicated from the closest source month.
 * All replicated items receive new unique IDs for targetMonthYear with status="pendente".
 * Editing amounts or paying bills in targetMonthYear will NEVER affect other months!
 */
export function ensureMonthGastosFixos(
  targetMonthYear: string,
  currentFixos?: GastoFixo[]
): GastoFixo[] {
  if (Array.isArray(currentFixos) && currentFixos.length > 0) {
    return currentFixos;
  }

  // 1. Try immediate previous month
  const prevMonth = getPreviousMonth(targetMonthYear);
  try {
    const rawPrev = localStorage.getItem(`fin_iq_month_${prevMonth}`);
    if (rawPrev) {
      const parsed = JSON.parse(rawPrev);
      if (Array.isArray(parsed?.gastosFixos) && parsed.gastosFixos.length > 0) {
        return parsed.gastosFixos
          .filter((f: GastoFixo) => f.recurring !== false)
          .map((f: GastoFixo, idx: number) => ({
            ...f,
            id: `fix_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            status: "pendente" as const,
            date: `${targetMonthYear}-${(f.date || "").split("-")[2] || "05"}`,
          }));
      }
    }
  } catch {}

  // 2. Try findPriorSourceMonth
  const prior = findPriorSourceMonth(targetMonthYear);
  if (prior && Array.isArray(prior.gastosFixos) && prior.gastosFixos.length > 0) {
    return prior.gastosFixos
      .filter((f: GastoFixo) => f.recurring !== false)
      .map((f: GastoFixo, idx: number) => ({
        ...f,
        id: `fix_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        status: "pendente" as const,
        date: `${targetMonthYear}-${(f.date || "").split("-")[2] || "05"}`,
      }));
  }

  return [];
}

/**
 * Builds a clean baseline for a new month by replicating recurring fixed expenses,
 * revenues, and investments from a source month.
 * Every replicated item receives an independent unique ID for the new month,
 * so editing any amount in this new month NEVER affects the source month!
 */
export function buildReplicatedMonthBaseline(
  targetMonthYear: string,
  source: FinancialData | null
): FinancialData {
  const cards = loadStoredCards();

  if (!source) {
    const replicatedRecs = ensureMonthReceitas(targetMonthYear);
    const replicatedFixos = ensureMonthGastosFixos(targetMonthYear);
    return {
      monthYear: targetMonthYear,
      cards,
      receitas: replicatedRecs,
      gastosFixos: replicatedFixos,
      cartoes: [],
      investimentos: [],
      imprevistos: [],
      metaRiqueza: 100000,
      investimentoAcumuladoAnterior: 0,
    };
  }

  // Replicate Gastos Fixos with status pendente and new unique IDs for targetMonth
  const rawFixos = source.gastosFixos || [];
  const replicatedFixos: GastoFixo[] = (rawFixos.length > 0
    ? rawFixos.filter((f) => f.recurring !== false)
    : ensureMonthGastosFixos(targetMonthYear)
  ).map((f, idx) => {
    const day = (f.date || "").split("-")[2] || "05";
    return {
      ...f,
      id: `fix_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: "pendente" as const,
      date: `${targetMonthYear}-${day}`,
    };
  });

  // Replicate Receitas with new unique IDs for targetMonth
  const rawReceitas = source.receitas || [];
  const replicatedReceitas: Receita[] = (rawReceitas.length > 0
    ? rawReceitas
    : ensureMonthReceitas(targetMonthYear)
  ).map((r, idx) => {
    const day = (r.date || "").split("-")[2] || "05";
    return {
      ...r,
      id: `rec_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: `${targetMonthYear}-${day}`,
    };
  });

  // Replicate Investimentos with new unique IDs for targetMonth
  const replicatedInvestimentos: Investimento[] = (source.investimentos || []).map((inv, idx) => {
    const day = (inv.date || "").split("-")[2] || "10";
    return {
      ...inv,
      id: `inv_${targetMonthYear}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: `${targetMonthYear}-${day}`,
    };
  });

  const totalAportesSource = (source.investimentos || []).reduce(
    (acc, i) => acc + (Number(i.amount) || 0),
    0
  );

  return {
    monthYear: targetMonthYear,
    cards: source.cards || cards,
    receitas: replicatedReceitas,
    gastosFixos: replicatedFixos,
    cartoes: [],
    investimentos: replicatedInvestimentos,
    imprevistos: [],
    metaRiqueza: source.metaRiqueza || 100000,
    investimentoAcumuladoAnterior: (source.investimentoAcumuladoAnterior || 0) + totalAportesSource,
  };
}

function getDeletedExpenseKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEYS_STORAGE);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function recordDeletedExpenseKeys(keys: string[], uid?: string) {
  if (!keys || keys.length === 0) return;
  try {
    const current = getDeletedExpenseKeys();
    for (const k of keys) {
      if (k) current.add(k);
    }
    const arr = Array.from(current);
    localStorage.setItem(DELETED_KEYS_STORAGE, JSON.stringify(arr));
    if (uid) {
      saveDeletionsToCloud(uid, arr).catch(console.error);
    }
  } catch {}
}

function isLegacyMockData(raw: any): boolean {
  if (!raw) return false;
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  return (
    str.includes("Aluguel & Condomínio") ||
    str.includes("Pão de Açúcar") ||
    str.includes("Posto Ipiranga") ||
    str.includes("Outback") ||
    str.includes("Salário Mensal (CLT)")
  );
}

function purgeLegacyMockStorage() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("fin_iq_")) {
        const val = localStorage.getItem(k);
        if (val && isLegacyMockData(val)) {
          toRemove.push(k);
        }
      }
    }
    for (const k of toRemove) {
      localStorage.removeItem(k);
    }
  } catch {}
}

export function applyDecemberStandardCleanup(currentUserUid?: string): FinancialData {
  // 1. Excluir meses anteriores a 2026-12 conforme solicitado pelo usuário
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("fin_iq_month_")) {
        const m = k.replace("fin_iq_month_", "");
        if (/^\d{4}-\d{2}$/.test(m) && m < "2026-12") {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  // 2. Base Oficial de Dezembro de 2026 com os 8 cartões exatos
  const decCartoes: GastoCartao[] = [
    {
      id: "card_c6_carro_impacto_prime_inst_1",
      card: "C6",
      description: "Carro Impacto Prime",
      amount: 752.07,
      date: "2026-12-28",
      installments: "1/4",
      currentInstallment: 1,
      totalInstallments: 4,
      totalPurchaseAmount: 3008.28,
      installmentSeriesId: "series_c6_carro_impacto_prime_4x",
      category: "Veículo",
    },
    {
      id: "card_bb_carro_impacto_inst_1",
      card: "BB",
      description: "Carro Impacto",
      amount: 565.8,
      date: "2026-12-10",
      installments: "1/6",
      currentInstallment: 1,
      totalInstallments: 6,
      totalPurchaseAmount: 3394.8,
      installmentSeriesId: "series_bb_carro_impacto_6x",
      category: "Veículo",
    },
    {
      id: "card_amazon_prime_inst_1",
      card: "Amazon",
      description: "Amazon Prime",
      amount: 99.92,
      date: "2026-12-10",
      installments: "1/3",
      currentInstallment: 1,
      totalInstallments: 3,
      totalPurchaseAmount: 299.76,
      installmentSeriesId: "series_amazon_prime_3x",
      category: "Compras",
    },
    {
      id: "card_c6_colombo_inst_1",
      card: "C6",
      description: "Colombo",
      amount: 85.75,
      date: "2026-12-03",
      installments: "1/3",
      currentInstallment: 1,
      totalInstallments: 3,
      totalPurchaseAmount: 257.25,
      installmentSeriesId: "series_c6_colombo_8575_3x",
      category: "Compras",
    },
    {
      id: "card_c6_ml_6512_inst_1",
      card: "C6",
      description: "Mercado Livre",
      amount: 65.12,
      date: "2026-12-10",
      installments: "1/6",
      currentInstallment: 1,
      totalInstallments: 6,
      totalPurchaseAmount: 390.72,
      installmentSeriesId: "series_c6_ml_6512_6x",
      category: "Compras",
    },
    {
      id: "card_c6_ml_5414_inst_1",
      card: "C6",
      description: "Mercado Livre",
      amount: 54.14,
      date: "2026-12-10",
      installments: "1/4",
      currentInstallment: 1,
      totalInstallments: 4,
      totalPurchaseAmount: 216.56,
      installmentSeriesId: "series_c6_ml_5414_4x",
      category: "Compras",
    },
    {
      id: "card_c6_ml_5214_inst_1",
      card: "C6",
      description: "Mercado Livre",
      amount: 52.14,
      date: "2026-12-28",
      installments: "1/4",
      currentInstallment: 1,
      totalInstallments: 4,
      totalPurchaseAmount: 208.56,
      installmentSeriesId: "series_c6_ml_5214_4x",
      category: "Compras",
    },
    {
      id: "card_c6_ml_3357_avista",
      card: "C6",
      description: "Mercado Livre",
      amount: 33.57,
      date: "2026-12-10",
      installments: "À vista",
      currentInstallment: 1,
      totalInstallments: 1,
      totalPurchaseAmount: 33.57,
      installmentSeriesId: "series_c6_ml_3357_1x",
      category: "Compras",
    },
  ];

  // Preservar compras à vista adicionais feitas em dezembro pelo usuário, se houver
  let existingUserAvista: GastoCartao[] = [];
  try {
    const rawDec = localStorage.getItem("fin_iq_month_2026-12");
    if (rawDec) {
      const parsedDec = JSON.parse(rawDec);
      if (Array.isArray(parsedDec?.cartoes)) {
        existingUserAvista = parsedDec.cartoes.filter(
          (c: GastoCartao) =>
            (c.totalInstallments === 1 || c.installments?.toLowerCase().includes("vista")) &&
            !decCartoes.some(
              (dc) =>
                dc.description.toLowerCase() === c.description.toLowerCase() &&
                dc.amount === c.amount
            )
        );
      }
    }
  } catch {}

  const finalDecCartoes = [...decCartoes, ...existingUserAvista];

  // Investimentos patrimoniais
  const initialPortfolio = getStoredPortfolioVault();
  const finalInvestimentos =
    initialPortfolio && initialPortfolio.length > 0
      ? initialPortfolio
      : INITIAL_DATA.investimentos;

  const decData: FinancialData = {
    monthYear: "2026-12",
    cards: loadStoredCards(),
    receitas: INITIAL_DATA.receitas,
    gastosFixos: INITIAL_DATA.gastosFixos,
    cartoes: finalDecCartoes,
    investimentos: finalInvestimentos,
    imprevistos: [],
    metaRiqueza: 100000.0,
    investimentoAcumuladoAnterior: 20555.51,
  };

  try {
    localStorage.setItem("fin_iq_month_2026-12", JSON.stringify(decData));
    localStorage.setItem(LAST_PERIOD_KEY, "2026-12");
    savePortfolioToVault(finalInvestimentos, currentUserUid);
    saveReceitasToVault(INITIAL_DATA.receitas, currentUserUid);
  } catch {}

  // 3. Limpar os meses seguintes de qualquer resquício errado e projetar exatamente as parcelas corretas
  const futureMonthsConfig = [
    {
      month: "2027-01",
      cartoes: [
        { ...decCartoes[0], id: "card_c6_carro_impacto_prime_inst_2", date: "2027-01-28", installments: "2/4", currentInstallment: 2 },
        { ...decCartoes[1], id: "card_bb_carro_impacto_inst_2", date: "2027-01-10", installments: "2/6", currentInstallment: 2 },
        { ...decCartoes[2], id: "card_amazon_prime_inst_2", date: "2027-01-10", installments: "2/3", currentInstallment: 2 },
        { ...decCartoes[3], id: "card_c6_colombo_inst_2", date: "2027-01-03", installments: "2/3", currentInstallment: 2 },
        { ...decCartoes[4], id: "card_c6_ml_6512_inst_2", date: "2027-01-10", installments: "2/6", currentInstallment: 2 },
        { ...decCartoes[5], id: "card_c6_ml_5414_inst_2", date: "2027-01-10", installments: "2/4", currentInstallment: 2 },
        { ...decCartoes[6], id: "card_c6_ml_5214_inst_2", date: "2027-01-28", installments: "2/4", currentInstallment: 2 },
      ],
    },
    {
      month: "2027-02",
      cartoes: [
        { ...decCartoes[0], id: "card_c6_carro_impacto_prime_inst_3", date: "2027-02-28", installments: "3/4", currentInstallment: 3 },
        { ...decCartoes[1], id: "card_bb_carro_impacto_inst_3", date: "2027-02-10", installments: "3/6", currentInstallment: 3 },
        { ...decCartoes[2], id: "card_amazon_prime_inst_3", date: "2027-02-10", installments: "3/3", currentInstallment: 3 },
        { ...decCartoes[3], id: "card_c6_colombo_inst_3", date: "2027-02-03", installments: "3/3", currentInstallment: 3 },
        { ...decCartoes[4], id: "card_c6_ml_6512_inst_3", date: "2027-02-10", installments: "3/6", currentInstallment: 3 },
        { ...decCartoes[5], id: "card_c6_ml_5414_inst_3", date: "2027-02-10", installments: "3/4", currentInstallment: 3 },
        { ...decCartoes[6], id: "card_c6_ml_5214_inst_3", date: "2027-02-28", installments: "3/4", currentInstallment: 3 },
      ],
    },
    {
      month: "2027-03",
      cartoes: [
        { ...decCartoes[0], id: "card_c6_carro_impacto_prime_inst_4", date: "2027-03-28", installments: "4/4", currentInstallment: 4 },
        { ...decCartoes[1], id: "card_bb_carro_impacto_inst_4", date: "2027-03-10", installments: "4/6", currentInstallment: 4 },
        { ...decCartoes[4], id: "card_c6_ml_6512_inst_4", date: "2027-03-10", installments: "4/6", currentInstallment: 4 },
        { ...decCartoes[5], id: "card_c6_ml_5414_inst_4", date: "2027-03-10", installments: "4/4", currentInstallment: 4 },
        { ...decCartoes[6], id: "card_c6_ml_5214_inst_4", date: "2027-03-28", installments: "4/4", currentInstallment: 4 },
      ],
    },
    {
      month: "2027-04",
      cartoes: [
        { ...decCartoes[1], id: "card_bb_carro_impacto_inst_5", date: "2027-04-10", installments: "5/6", currentInstallment: 5 },
        { ...decCartoes[4], id: "card_c6_ml_6512_inst_5", date: "2027-04-10", installments: "5/6", currentInstallment: 5 },
      ],
    },
    {
      month: "2027-05",
      cartoes: [
        { ...decCartoes[1], id: "card_bb_carro_impacto_inst_6", date: "2027-05-10", installments: "6/6", currentInstallment: 6 },
        { ...decCartoes[4], id: "card_c6_ml_6512_inst_6", date: "2027-05-10", installments: "6/6", currentInstallment: 6 },
      ],
    },
  ];

  for (const fut of futureMonthsConfig) {
    const futData: FinancialData = {
      monthYear: fut.month,
      cards: loadStoredCards(),
      receitas: INITIAL_DATA.receitas.map((r, idx) => ({
        ...r,
        id: `rec_${fut.month}_${idx}`,
        date: `${fut.month}-02`,
      })),
      gastosFixos: INITIAL_DATA.gastosFixos.map((f, idx) => ({
        ...f,
        id: `fix_${fut.month}_${idx}`,
        date: `${fut.month}-05`,
        status: "pendente",
      })),
      cartoes: fut.cartoes,
      investimentos: finalInvestimentos,
      imprevistos: [],
      metaRiqueza: 100000.0,
      investimentoAcumuladoAnterior: 20555.51,
    };

    try {
      localStorage.setItem(`fin_iq_month_${fut.month}`, JSON.stringify(futData));
    } catch {}

    if (currentUserUid) {
      saveMonthDataToCloud(currentUserUid, fut.month, futData).catch(console.error);
    }
  }

  if (currentUserUid) {
    saveMonthDataToCloud(currentUserUid, "2026-12", decData).catch(console.error);
    saveLastPeriodToCloud(currentUserUid, "2026-12").catch(console.error);
  }

  try {
    localStorage.setItem("fin_iq_dec26_standard_applied_v4", "true");
  } catch {}

  return decData;
}

export default function App() {
  // Purge any legacy mock entries on load
  purgeLegacyMockStorage();

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    try {
      const applied = localStorage.getItem("fin_iq_dec26_standard_applied_v4");
      if (!applied) {
        return "2026-12";
      }
      const saved = localStorage.getItem(LAST_PERIOD_KEY);
      if (saved && /^\d{4}-\d{2}$/.test(saved)) {
        return saved;
      }
    } catch {}
    return "2026-12";
  });

  const [data, setData] = useState<FinancialData>(() => {
    try {
      const applied = localStorage.getItem("fin_iq_dec26_standard_applied_v4");
      if (!applied) {
        return applyDecemberStandardCleanup();
      }

      const initialPeriod = (() => {
        try {
          const saved = localStorage.getItem(LAST_PERIOD_KEY);
          if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
        } catch {}
        return "2026-12";
      })();

      const monthSpecific = localStorage.getItem(`fin_iq_month_${initialPeriod}`);
      if (monthSpecific && !isLegacyMockData(monthSpecific)) {
        const parsed = JSON.parse(monthSpecific);
        if (parsed && parsed.monthYear === initialPeriod) {
          const validReceitas = ensureMonthReceitas(initialPeriod, parsed.receitas);
          const validFixos = ensureMonthGastosFixos(initialPeriod, parsed.gastosFixos);
          const portfolioVault = getStoredPortfolioVault();
          return {
            ...parsed,
            receitas: validReceitas,
            gastosFixos: validFixos,
            investimentos:
              Array.isArray(parsed.investimentos) && parsed.investimentos.length > 0
                ? parsed.investimentos
                : portfolioVault,
            cards: loadStoredCards(),
          };
        }
      }

      return applyDecemberStandardCleanup();
    } catch (e) {
      console.error("Erro ao carregar dados do localStorage:", e);
    }

    return applyDecemberStandardCleanup();
  });

  const [currentUser, setCurrentUser] = useState<CloudUserSession | null>(() =>
    getStoredCloudSession()
  );
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isMobileSyncOpen, setIsMobileSyncOpen] = useState(false);
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("resumo");
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Keep a ref to the latest data to prevent race conditions during async Firestore callbacks
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Self-healing check: if active month is opened with 0 receitas or 0 gastos fixos,
  // automatically replicate them from prior months or vault so November is NEVER blank!
  useEffect(() => {
    setData((current) => {
      let changed = false;
      let healedReceitas = current.receitas || [];
      let healedFixos = current.gastosFixos || [];

      if (healedReceitas.length === 0) {
        const found = ensureMonthReceitas(selectedPeriod, healedReceitas);
        if (found.length > 0) {
          healedReceitas = found;
          changed = true;
        }
      }

      if (healedFixos.length === 0) {
        const found = ensureMonthGastosFixos(selectedPeriod, healedFixos);
        if (found.length > 0) {
          healedFixos = found;
          changed = true;
        }
      }

      if (changed) {
        const updated: FinancialData = {
          ...current,
          monthYear: selectedPeriod,
          receitas: healedReceitas,
          gastosFixos: healedFixos,
        };
        try {
          localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(updated));
        } catch {}
        if (currentUser) {
          saveMonthDataToCloud(currentUser.uid, selectedPeriod, updated).catch(console.error);
        }
        return updated;
      }
      return current;
    });
  }, [selectedPeriod, currentUser]);

  // Listen to Firebase Auth state if signed in via Google
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const isThales = user.email?.toLowerCase().includes("thales");
        const workspaceId = isThales ? "ws_5490bffb6e206b14b606e1d3315b9ef5" : user.uid;
        const session: CloudUserSession = {
          uid: workspaceId,
          email: user.email || "",
          displayName: user.displayName || user.email?.split("@")[0] || "Usuário",
          isFirebaseUser: true,
        };
        setCurrentUser(session);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Initial startup projection to ensure all existing installments are projected into next months
  useEffect(() => {
    runGlobalInstallmentProjection();
  }, []);

  // Sync deleted keys and all historical months from cloud whenever user logs in
  useEffect(() => {
    if (!currentUser) return;
    getDeletionsFromCloud(currentUser.uid)
      .then((cloudKeys) => {
        if (cloudKeys && cloudKeys.length > 0) {
          recordDeletedExpenseKeys(cloudKeys);
        }
      })
      .catch(console.error);

    getReceitasVaultFromCloud(currentUser.uid)
      .then((cloudRecs) => {
        if (cloudRecs && cloudRecs.length > 0) {
          saveReceitasToVault(cloudRecs);
          setData((prev) => {
            if (!prev.receitas || prev.receitas.length === 0) {
              const restored = cloudRecs.map((r) => ({
                ...r,
                date: `${selectedPeriod}-${(r.date || "").split("-")[2] || "05"}`,
              }));
              return { ...prev, receitas: restored };
            }
            return prev;
          });
        }
      })
      .catch(console.error);

    // Sync cloud cards
    getCardsFromCloud(currentUser.uid)
      .then((cloudCards) => {
        if (cloudCards && cloudCards.length > 0) {
          try {
            localStorage.setItem(GLOBAL_CARDS_KEY, JSON.stringify(cloudCards));
          } catch {}
          setData((prev) => ({ ...prev, cards: cloudCards }));
        }
      })
      .catch(console.error);

    // Sync cloud investment portfolio vault
    getPortfolioFromCloud(currentUser.uid)
      .then((cloudPort) => {
        if (cloudPort && cloudPort.length > 0) {
          savePortfolioToVault(cloudPort);
          setData((prev) => {
            if (!prev.investimentos || prev.investimentos.length === 0) {
              return { ...prev, investimentos: cloudPort };
            }
            return prev;
          });
        }
      })
      .catch(console.error);

    // Sync last selected active month so mobile opens the exact same period as desktop!
    getLastPeriodFromCloud(currentUser.uid)
      .then((cloudPeriod) => {
        if (cloudPeriod && /^\d{4}-\d{2}$/.test(cloudPeriod) && cloudPeriod !== selectedPeriod) {
          setSelectedPeriod(cloudPeriod);
        }
      })
      .catch(console.error);

    getAllUserMonthsFromCloud(currentUser.uid)
      .then((cloudMonths) => {
        if (cloudMonths && cloudMonths.length > 0) {
          for (const mData of cloudMonths) {
            if (Array.isArray(mData?.receitas) && mData.receitas.length > 0) {
              saveReceitasToVault(mData.receitas);
              break;
            }
          }
          for (const mData of cloudMonths) {
            if (mData.monthYear) {
              const localKey = `fin_iq_month_${mData.monthYear}`;
              const localRaw = localStorage.getItem(localKey);
              let shouldSave = !localRaw;
              if (localRaw) {
                try {
                  const parsedLocal = JSON.parse(localRaw);
                  const localCount =
                    (parsedLocal.receitas?.length || 0) +
                    (parsedLocal.gastosFixos?.length || 0) +
                    (parsedLocal.cartoes?.length || 0);
                  const cloudCount =
                    (mData.receitas?.length || 0) +
                    (mData.gastosFixos?.length || 0) +
                    (mData.cartoes?.length || 0);
                  if (cloudCount >= localCount) {
                    shouldSave = true;
                  }
                } catch {
                  shouldSave = true;
                }
              }
              if (shouldSave) {
                try {
                  localStorage.setItem(localKey, JSON.stringify(mData));
                } catch {}
              }
              if (mData.monthYear === selectedPeriod) {
                setData((prev) => {
                  const cloudCount =
                    (mData.receitas?.length || 0) +
                    (mData.gastosFixos?.length || 0) +
                    (mData.cartoes?.length || 0);
                  const prevCount =
                    (prev.receitas?.length || 0) +
                    (prev.gastosFixos?.length || 0) +
                    (prev.cartoes?.length || 0);
                  return cloudCount >= prevCount ? mData : prev;
                });
              }
            }
          }
          runGlobalInstallmentProjection();
        }
      })
      .catch(console.error);
  }, [currentUser]);

  // Real-time Firestore sync whenever user or selectedPeriod changes
  useEffect(() => {
    if (!currentUser) return;

    setIsCloudSyncing(true);
    const unsubscribeMonth = subscribeToMonthData(
      currentUser.uid,
      selectedPeriod,
      (remoteData) => {
        setIsCloudSyncing(false);
        const deletedKeys = getDeletedExpenseKeys();
        const allExpenses = collectAllExpensesFromStorage();
        const projectedMap = projectMissingInstallmentsFromExpenses(
          allExpenses,
          deletedKeys,
          dataRef.current.cards
        );
        const projectedForThisMonth = projectedMap[selectedPeriod] || [];

        // Check local storage for selectedPeriod
        let localData: FinancialData | null = null;
        try {
          const rawLocal = localStorage.getItem(`fin_iq_month_${selectedPeriod}`);
          if (rawLocal) localData = JSON.parse(rawLocal);
        } catch {}

        if (remoteData && remoteData.monthYear === selectedPeriod) {
          // Filter out any cartoes matching deleted keys or signatures
          const filteredCartoes = (remoteData.cartoes || []).filter((c) => {
            return (
              !deletedKeys.has(c.id) &&
              (!c.installmentSeriesId || !deletedKeys.has(`series_${c.installmentSeriesId}`))
            );
          });

          const mergedCartoes = mergeProjectedInstallments(
            filteredCartoes,
            projectedForThisMonth,
            deletedKeys
          );

          // DO NOT let empty remote arrays overwrite user's entries: auto-replicate if needed!
          let finalReceitas =
            Array.isArray(remoteData.receitas) && remoteData.receitas.length > 0
              ? remoteData.receitas
              : localData && Array.isArray(localData.receitas) && localData.receitas.length > 0
              ? localData.receitas
              : dataRef.current.receitas;

          if (!finalReceitas || finalReceitas.length === 0) {
            finalReceitas = ensureMonthReceitas(selectedPeriod);
          }

          if (finalReceitas.length > 0) {
            saveReceitasToVault(finalReceitas, currentUser.uid);
          }

          let finalFixed =
            Array.isArray(remoteData.gastosFixos) && remoteData.gastosFixos.length > 0
              ? remoteData.gastosFixos
              : localData && Array.isArray(localData.gastosFixos) && localData.gastosFixos.length > 0
              ? localData.gastosFixos
              : dataRef.current.gastosFixos;

          if (!finalFixed || finalFixed.length === 0) {
            finalFixed = ensureMonthGastosFixos(selectedPeriod);
          }

          const finalInvestimentos =
            Array.isArray(remoteData.investimentos) && remoteData.investimentos.length > 0
              ? remoteData.investimentos
              : localData && Array.isArray(localData.investimentos) && localData.investimentos.length > 0
              ? localData.investimentos
              : dataRef.current.investimentos;

          const finalData: FinancialData = {
            ...remoteData,
            monthYear: selectedPeriod,
            receitas: finalReceitas,
            cartoes: mergedCartoes,
            gastosFixos: finalFixed,
            investimentos: finalInvestimentos,
            cards:
              Array.isArray(remoteData.cards) && remoteData.cards.length > 0
                ? remoteData.cards
                : dataRef.current.cards,
          };
          setData(finalData);
          try {
            localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(finalData));
          } catch {}

          // If local/replicated data had items that cloud was missing, sync back to cloud
          const remoteWasMissing =
            (!remoteData.receitas || remoteData.receitas.length === 0) ||
            (!remoteData.gastosFixos || remoteData.gastosFixos.length === 0);
          if (remoteWasMissing && (finalReceitas.length > 0 || finalFixed.length > 0)) {
            saveMonthDataToCloud(currentUser.uid, selectedPeriod, finalData).catch(console.error);
          }
        } else if (remoteData === null) {
          // If month doesn't exist on cloud yet, check if local storage already has user data!
          if (localData && ((localData.receitas && localData.receitas.length > 0) || (localData.gastosFixos && localData.gastosFixos.length > 0))) {
            saveMonthDataToCloud(currentUser.uid, selectedPeriod, localData).catch(console.error);
          } else {
            const sourceMonth = dataRef.current.receitas?.length > 0 || dataRef.current.gastosFixos?.length > 0
              ? dataRef.current
              : findPriorSourceMonth(selectedPeriod);
            const newBaseline = buildReplicatedMonthBaseline(selectedPeriod, sourceMonth);
            if (projectedForThisMonth.length > 0) {
              newBaseline.cartoes = projectedForThisMonth;
            }
            setData(newBaseline);
            try {
              localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(newBaseline));
            } catch {}
            saveMonthDataToCloud(currentUser.uid, selectedPeriod, newBaseline).catch((err) => {
              console.error("Erro ao inicializar mês na nuvem:", err);
            });
          }
        }
      },
      () => setIsCloudSyncing(false)
    );

    return () => unsubscribeMonth();
  }, [currentUser, selectedPeriod]);

  // Calculate high-level financial health metrics dynamically
  const metrics: FinancialMetrics = useMemo(() => {
    return calculateMetrics(data);
  }, [data]);

  // Persist state changes locally and in Firebase cloud immediately
  const saveState = (newData: FinancialData) => {
    setData(newData);
    if (newData.receitas && newData.receitas.length > 0) {
      saveReceitasToVault(newData.receitas, currentUser?.uid);
    }
    if (newData.investimentos && newData.investimentos.length > 0) {
      savePortfolioToVault(newData.investimentos, currentUser?.uid);
    }
    try {
      localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(newData));
      localStorage.setItem(LAST_PERIOD_KEY, selectedPeriod);

      // Save rolling snapshot history to guarantee zero data loss
      const snapKey = "fin_iq_state_snapshots";
      const rawSnap = localStorage.getItem(snapKey);
      let snapList: any[] = [];
      if (rawSnap) {
        try {
          snapList = JSON.parse(rawSnap);
        } catch {}
      }
      snapList.unshift({
        timestamp: new Date().toISOString(),
        monthYear: selectedPeriod,
        data: newData,
      });
      if (snapList.length > 25) snapList = snapList.slice(0, 25);
      localStorage.setItem(snapKey, JSON.stringify(snapList));
    } catch (e) {
      console.error("Erro ao salvar no localStorage:", e);
    }
    if (currentUser) {
      setIsCloudSyncing(true);
      saveMonthDataToCloud(currentUser.uid, selectedPeriod, newData)
        .catch((err) => {
          console.error("Erro ao salvar na nuvem:", err);
          addToast("error", "Erro de Sincronização", "Não foi possível salvar na nuvem.");
        })
        .finally(() => setIsCloudSyncing(false));
    }
  };

  // Helper to collect all known expenses across all months with billingMonth tracking
  const collectAllExpensesFromStorage = (): ScannedExpenseItem[] => {
    const list: ScannedExpenseItem[] = [];
    const seenMonthItem = new Set<string>();

    const addMonthCartoes = (mYear: string, cartoes?: GastoCartao[]) => {
      if (!cartoes || !Array.isArray(cartoes) || !mYear) return;
      for (const c of cartoes) {
        if (!c || !c.id) continue;
        const key = `${mYear}:::${c.id}`;
        if (!seenMonthItem.has(key)) {
          seenMonthItem.add(key);
          list.push({ item: c, billingMonth: mYear });
        }
      }
    };

    // 1. Current active month state in memory
    const activeMonth = data.monthYear || selectedPeriod;
    addMonthCartoes(activeMonth, data.cartoes);

    // 2. All months stored in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("fin_iq_month_")) {
          const mYear = key.replace("fin_iq_month_", "");
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            addMonthCartoes(mYear, parsed?.cartoes);
          }
        } else if (key === STORAGE_KEY) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            addMonthCartoes(parsed?.monthYear || selectedPeriod, parsed?.cartoes);
          }
        }
      }
    } catch {}

    return list;
  };

  // Retroactively scan and project all existing installments across all months
  const runGlobalInstallmentProjection = async (notifyUser = false) => {
    setIsCloudSyncing(true);
    try {
      const allExpenses = collectAllExpensesFromStorage();
      const deletedKeys = getDeletedExpenseKeys();
      const projectedByMonth = projectMissingInstallmentsFromExpenses(
        allExpenses,
        deletedKeys,
        data.cards
      );

      let totalInjected = 0;

      // Injects into each target month in LocalStorage IF the month already exists
      for (const [mYear, items] of Object.entries(projectedByMonth)) {
        try {
          const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
          if (raw) {
            const mData = JSON.parse(raw);
            const initialCount = (mData.cartoes || []).length;
            mData.cartoes = mergeProjectedInstallments(mData.cartoes || [], items, deletedKeys);
            totalInjected += mData.cartoes.length - initialCount;
            localStorage.setItem(`fin_iq_month_${mYear}`, JSON.stringify(mData));
          }
        } catch (err) {}
      }

      // Injects into currently viewed month state if affected
      const currentMonthProjected = projectedByMonth[selectedPeriod];
      if (currentMonthProjected && currentMonthProjected.length > 0) {
        const mergedCurrent = mergeProjectedInstallments(data.cartoes, currentMonthProjected, deletedKeys);
        if (mergedCurrent.length !== data.cartoes.length) {
          saveState({ ...data, cartoes: mergedCurrent });
        }
      }

      // Injects into Firestore across all affected months
      if (currentUser && Object.keys(projectedByMonth).length > 0) {
        await addInstallmentsToCloud(currentUser.uid, projectedByMonth, data);
      }

      if (notifyUser) {
        if (totalInjected > 0) {
          addToast(
            "success",
            "Parcelas Projetadas com Sucesso!",
            `${totalInjected} parcelas existentes foram distribuídas e salvas nos meses seguintes.`
          );
        } else {
          addToast("info", "Parcelas em dia", "Todas as compras parceladas já estão projetadas nos meses seguintes.");
        }
      }

      return totalInjected;
    } catch (err) {
      console.error("Erro ao sincronizar parcelas:", err);
      return 0;
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Clean duplicate or outdated records from current month's invoice and permanently tombstone them
  const handleCleanMonthDuplicates = () => {
    const { cleaned, removedCount, removedItems } = cleanupMonthCartoes(data.cartoes, selectedPeriod);
    if (removedCount > 0) {
      const keysToTombstone: string[] = [];
      for (const item of removedItems) {
        keysToTombstone.push(item.id);
        keysToTombstone.push(
          makeExpenseSignature(item.description, item.card, item.installments || "", selectedPeriod)
        );
        keysToTombstone.push(
          makeGeneralExpenseKey(item.description, item.card, item.amount, selectedPeriod)
        );
      }
      recordDeletedExpenseKeys(keysToTombstone, currentUser?.uid);
      saveState({ ...data, cartoes: cleaned });
      addToast(
        "success",
        "Compras Duplicadas Removidas!",
        `${removedCount} lançamentos duplicados foram removidos da fatura e não voltarão mais.`
      );
    } else {
      addToast("info", "Fatura já está organizada", "Nenhuma compra duplicada encontrada neste mês.");
    }
  };

  // Switching months seamlessly: preserves existing saved months, replicates recurring items for new months
  const handleSelectPeriod = (newPeriod: string) => {
    if (newPeriod === selectedPeriod) return;

    // 1. Save current month state before switching
    try {
      localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(data));
      localStorage.setItem(LAST_PERIOD_KEY, newPeriod);
      if (currentUser) {
        saveMonthDataToCloud(currentUser.uid, selectedPeriod, data).catch(console.error);
        saveLastPeriodToCloud(currentUser.uid, newPeriod).catch(console.error);
      }
    } catch (e) {}

    // 2. Look up saved data for newPeriod or replicate from recent source month
    let targetMonthData: FinancialData;
    const rawLocal = localStorage.getItem(`fin_iq_month_${newPeriod}`);
    if (rawLocal) {
      try {
        targetMonthData = JSON.parse(rawLocal);
      } catch {
        const sourceMonth =
          (data.receitas?.length > 0 || data.gastosFixos?.length > 0)
            ? data
            : findPriorSourceMonth(newPeriod);
        targetMonthData = buildReplicatedMonthBaseline(newPeriod, sourceMonth);
      }
    } else {
      // New month: inherit recurring items from currently viewed month or prior month
      const sourceMonth =
        (data.receitas?.length > 0 || data.gastosFixos?.length > 0)
          ? data
          : findPriorSourceMonth(newPeriod);
      targetMonthData = buildReplicatedMonthBaseline(newPeriod, sourceMonth);
    }

    // Auto-replicate revenues and recurring fixed expenses if target month is missing them
    if (!targetMonthData.receitas || targetMonthData.receitas.length === 0) {
      targetMonthData.receitas = ensureMonthReceitas(newPeriod);
    }
    if (!targetMonthData.gastosFixos || targetMonthData.gastosFixos.length === 0) {
      targetMonthData.gastosFixos = ensureMonthGastosFixos(newPeriod);
    }

    // 3. Project missing installments from all existing purchases into this new period
    const deletedKeys = getDeletedExpenseKeys();
    const allExpenses = collectAllExpensesFromStorage();
    const projectedMap = projectMissingInstallmentsFromExpenses(allExpenses, deletedKeys, data.cards);
    const newPeriodProjected = projectedMap[newPeriod] || [];

    if (newPeriodProjected.length > 0) {
      targetMonthData.cartoes = mergeProjectedInstallments(
        targetMonthData.cartoes || [],
        newPeriodProjected,
        deletedKeys
      );
    }

    // Clean duplicates if any
    const { cleaned } = cleanupMonthCartoes(targetMonthData.cartoes || [], newPeriod);
    targetMonthData.cartoes = cleaned;
    targetMonthData.cards = data.cards;
    targetMonthData.monthYear = newPeriod;

    // 4. Update state and period
    setData(targetMonthData);
    setSelectedPeriod(newPeriod);

    try {
      localStorage.setItem(`fin_iq_month_${newPeriod}`, JSON.stringify(targetMonthData));
    } catch {}

    if (currentUser) {
      saveMonthDataToCloud(currentUser.uid, newPeriod, targetMonthData).catch(console.error);
      saveLastPeriodToCloud(currentUser.uid, newPeriod).catch(console.error);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      addToast("info", "Conta Desconectada", "Você agora está no modo local.");
    } catch (e) {
      console.error(e);
    }
  };

  const addToast = (
    type: ToastMessage["type"],
    title: string,
    description?: string
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Handlers for Receitas ---
  const handleAddReceita = (newRec: Omit<Receita, "id">) => {
    const item: Receita = { id: "rec_" + Date.now(), ...newRec };
    saveState({ ...data, receitas: [item, ...data.receitas] });
    addToast("success", "Receita adicionada", `${item.description} cadastrada com sucesso.`);
  };

  const handleUpdateReceita = (updated: Receita) => {
    const newReceitas = data.receitas.map((r) => (r.id === updated.id ? updated : r));
    saveState({ ...data, receitas: newReceitas });
    addToast("success", "Receita atualizada", `${updated.description} alterada com sucesso.`);
  };

  const handleDeleteReceita = (id: string) => {
    const filtered = data.receitas.filter((r) => r.id !== id);
    saveState({ ...data, receitas: filtered });
    if (filtered.length > 0) {
      saveReceitasToVault(filtered, currentUser?.uid);
    }
    addToast("info", "Receita removida");
  };

  const handleReplicateReceitasAllMonths = () => {
    if (!data.receitas || data.receitas.length === 0) {
      addToast(
        "warning",
        "Nenhuma receita para replicar",
        "Cadastre ou restaure suas receitas antes de replicar."
      );
      return;
    }
    saveReceitasToVault(data.receitas, currentUser?.uid);
    let count = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("fin_iq_month_")) {
          const mYear = key.replace("fin_iq_month_", "");
          if (mYear !== selectedPeriod) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              parsed.receitas = data.receitas.map((r) => ({
                ...r,
                id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                date: `${mYear}-${(r.date || "").split("-")[2] || "05"}`,
              }));
              localStorage.setItem(key, JSON.stringify(parsed));
              if (currentUser) {
                saveMonthDataToCloud(currentUser.uid, mYear, parsed).catch(console.error);
              }
              count++;
            }
          }
        }
      }
    } catch {}

    addToast(
      "success",
      "Receitas Replicadas com Sucesso!",
      `${data.receitas.length} fontes de renda copiadas para todos os meses do sistema.`
    );
  };

  const handleReplicateReceitasFromPreviousMonth = () => {
    const prevMonth = getPreviousMonth(selectedPeriod);
    let sourceMonth: FinancialData | null = null;
    try {
      const raw = localStorage.getItem(`fin_iq_month_${prevMonth}`);
      if (raw) sourceMonth = JSON.parse(raw);
    } catch {}
    if (!sourceMonth) sourceMonth = findPriorSourceMonth(selectedPeriod);

    if (!sourceMonth || !sourceMonth.receitas || sourceMonth.receitas.length === 0) {
      addToast(
        "warning",
        "Nenhuma receita no mês anterior",
        "Cadastre receitas no mês anterior antes de copiar."
      );
      return;
    }

    const cloned = sourceMonth.receitas.map((r, idx) => ({
      ...r,
      id: `rec_${selectedPeriod}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: `${selectedPeriod}-${(r.date || "").split("-")[2] || "05"}`,
    }));

    saveState({ ...data, receitas: cloned });
    addToast(
      "success",
      "Receitas Replicadas!",
      `${cloned.length} fontes de renda copiadas do mês anterior. Você pode alterar os valores deste mês.`
    );
  };

  const handleRestoreReceitas = () => {
    const recovered = getStoredReceitasVault();
    if (recovered.length === 0) {
      addToast("warning", "Nenhuma receita salva no cofre para recuperar.");
      return;
    }
    const mapped = recovered.map((r, idx) => ({
      ...r,
      id: `rec_${selectedPeriod}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: `${selectedPeriod}-${(r.date || "").split("-")[2] || "05"}`,
    }));
    saveState({ ...data, receitas: mapped });
    addToast(
      "success",
      "Receitas Restauradas!",
      `${mapped.length} fontes de renda recuperadas para o mês de ${selectedPeriod}.`
    );
  };

  const handleReplicateInvestments = () => {
    let sourceInvs: Investimento[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("fin_iq_month_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.investimentos) && parsed.investimentos.length > 0) {
              sourceInvs = parsed.investimentos;
              break;
            }
          }
        }
      }
    } catch {}

    if (sourceInvs.length === 0) {
      sourceInvs = INITIAL_DATA.investimentos;
    }

    const cloned = sourceInvs.map((inv) => ({
      ...inv,
      id: "inv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      date: `${selectedPeriod}-${(inv.date || "").split("-")[2] || "10"}`,
    }));

    saveState({ ...data, investimentos: cloned });
    addToast(
      "success",
      "Investimentos Replicados!",
      `${cloned.length} aportes preparados para o mês atual.`
    );
  };

  // --- Handlers for Gastos Fixos ---
  const handleAddGastoFixo = (newFixo: Omit<GastoFixo, "id">) => {
    const item: GastoFixo = { id: "fix_" + Date.now(), ...newFixo };
    saveState({ ...data, gastosFixos: [...data.gastosFixos, item] });
    addToast("success", "Gasto fixo cadastrado", `${item.description} adicionado.`);
  };

  const handleUpdateGastoFixo = (updated: GastoFixo) => {
    const newFixos = data.gastosFixos.map((f) => (f.id === updated.id ? updated : f));
    saveState({ ...data, gastosFixos: newFixos });
    addToast("success", "Gasto fixo atualizado", `${updated.description} alterado com sucesso.`);
  };

  const handleToggleFixStatus = (id: string) => {
    const updated = data.gastosFixos.map((f) => {
      if (f.id === id) {
        const nextStatus = f.status === "pago" ? "pendente" : "pago";
        return { ...f, status: nextStatus as "pago" | "pendente" };
      }
      return f;
    });
    saveState({ ...data, gastosFixos: updated });
    const targetItem = data.gastosFixos.find((f) => f.id === id);
    if (targetItem) {
      const isPaid = targetItem.status !== "pago";
      addToast("info", targetItem.description, isPaid ? "Marcado como Pago ✅" : "Marcado como Pendente ⏳");
    }
  };

  const handleMarkAllAsPaid = () => {
    const updated = data.gastosFixos.map((f) => ({ ...f, status: "pago" as const }));
    saveState({ ...data, gastosFixos: updated });
    addToast("success", "Contas atualizadas", "Todas as contas fixas foram marcadas como pagas!");
  };

  const handleDeleteGastoFixo = (id: string) => {
    saveState({ ...data, gastosFixos: data.gastosFixos.filter((f) => f.id !== id) });
    addToast("info", "Gasto fixo removido");
  };

  const handleReplicateFixedFromPreviousMonth = () => {
    const prevMonth = getPreviousMonth(selectedPeriod);
    let sourceMonth: FinancialData | null = null;
    try {
      const raw = localStorage.getItem(`fin_iq_month_${prevMonth}`);
      if (raw) sourceMonth = JSON.parse(raw);
    } catch {}
    if (!sourceMonth) sourceMonth = findPriorSourceMonth(selectedPeriod);

    if (!sourceMonth || !sourceMonth.gastosFixos || sourceMonth.gastosFixos.length === 0) {
      addToast(
        "warning",
        "Nenhuma conta fixa no mês anterior",
        "Cadastre contas no mês anterior antes de copiar."
      );
      return;
    }

    const cloned = sourceMonth.gastosFixos
      .filter((f) => f.recurring !== false)
      .map((f, idx) => ({
        ...f,
        id: `fix_${selectedPeriod}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        status: "pendente" as const,
        date: `${selectedPeriod}-${(f.date || "").split("-")[2] || "05"}`,
      }));

    saveState({ ...data, gastosFixos: cloned });
    addToast(
      "success",
      "Contas Fixas Replicadas!",
      `${cloned.length} contas copiadas do mês anterior com status pendente. Você pode alterar os valores deste mês.`
    );
  };

  const handleReplicateFixedExpenses = () => {
    const nextMonth = getNextMonth(selectedPeriod);
    const count = data.gastosFixos.length;
    if (count === 0) {
      addToast("warning", "Nenhuma conta fixa cadastrada para replicar.");
      return;
    }

    const cloned = data.gastosFixos
      .filter((f) => f.recurring !== false)
      .map((f, idx) => ({
        ...f,
        id: `fix_${nextMonth}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        status: "pendente" as const,
        date: `${nextMonth}-${(f.date || "").split("-")[2] || "05"}`,
      }));

    try {
      const rawNext = localStorage.getItem(`fin_iq_month_${nextMonth}`);
      let nextData: FinancialData;
      if (rawNext) {
        nextData = JSON.parse(rawNext);
        nextData.gastosFixos = cloned;
      } else {
        nextData = buildReplicatedMonthBaseline(nextMonth, data);
        nextData.gastosFixos = cloned;
      }
      localStorage.setItem(`fin_iq_month_${nextMonth}`, JSON.stringify(nextData));
      if (currentUser) {
        saveMonthDataToCloud(currentUser.uid, nextMonth, nextData).catch(console.error);
      }
    } catch {}

    addToast(
      "success",
      "Contas Replicadas para o Próximo Mês!",
      `${count} contas fixas copiadas para ${nextMonth}. Os valores podem ser alterados naquele mês.`
    );
  };

  // --- Handlers for Credit Cards & Installments Across Future Months ---
  const handleAddGastoCartao = async (
    newGasto: Omit<GastoCartao, "id">,
    installmentDetails?: {
      totalInstallments: number;
      startInstallment: number;
      installmentAmount: number;
      totalAmount: number;
      closingDay?: number;
    }
  ) => {
    const isMultiInstallment = installmentDetails && installmentDetails.totalInstallments > 1;
    const totalInst = isMultiInstallment ? installmentDetails.totalInstallments : 1;
    const startInst = installmentDetails?.startInstallment || 1;
    const instAmount = installmentDetails?.installmentAmount || newGasto.amount;
    const totalAmt = installmentDetails?.totalAmount || newGasto.amount;

    // A compra entra SEMPRE no mês que o usuário estiver trabalhando (selectedPeriod)
    let purchaseDate = newGasto.date || `${selectedPeriod}-10`;
    if (!purchaseDate.startsWith(selectedPeriod)) {
      const day = purchaseDate.split("-")[2] || "10";
      purchaseDate = `${selectedPeriod}-${day}`;
    }

    // Gerar identificador único de série para vincular as parcelas
    const seriesId = "series_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const generated = generateInstallments({
      description: newGasto.description,
      card: newGasto.card,
      category: newGasto.category,
      startDate: purchaseDate,
      totalInstallments: totalInst,
      startInstallment: startInst,
      installmentAmount: instAmount,
      totalPurchaseAmount: totalAmt,
      seriesId,
    });

    // Agrupar parcelas por mês
    const byMonth: Record<string, GastoCartao[]> = {};
    for (const gen of generated) {
      if (!byMonth[gen.monthYear]) {
        byMonth[gen.monthYear] = [];
      }
      byMonth[gen.monthYear].push(gen.item);
    }

    // 1. Atualizar o estado do mês ativo de trabalho (selectedPeriod) imediatamente
    const currentMonthItems = byMonth[selectedPeriod] || [];
    if (currentMonthItems.length > 0) {
      saveState({ ...data, cartoes: [...currentMonthItems, ...data.cartoes] });
    }

    // 2. Gravar parcelas dos meses futuros no LocalStorage
    for (const [mYear, items] of Object.entries(byMonth)) {
      if (mYear === selectedPeriod && currentMonthItems.length > 0) continue; // Já salvo acima
      try {
        const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
        let mData: FinancialData;
        if (raw) {
          mData = JSON.parse(raw);
          const existing = mData.cartoes || [];
          mData.cartoes = mergeProjectedInstallments(existing, items, getDeletedExpenseKeys());
          mData.cards = data.cards;
          mData.monthYear = mYear;
        } else {
          mData = buildReplicatedMonthBaseline(mYear, data);
          mData.cartoes = items;
          mData.monthYear = mYear;
        }
        localStorage.setItem(`fin_iq_month_${mYear}`, JSON.stringify(mData));
      } catch (err) {
        console.error("Erro ao salvar parcela no localStorage para", mYear, err);
      }
    }

    // 3. Propagar para a nuvem Firebase nos meses afetados
    if (currentUser) {
      await addInstallmentsToCloud(currentUser.uid, byMonth, data);
    }

    // 4. Executar projeção global para garantir que todos os meses fiquem em perfeita sintonia
    runGlobalInstallmentProjection();

    // 4. Feedback claro para o usuário
    if (isMultiInstallment) {
      addToast(
        "success",
        `Compra parcelada em ${totalInst}x adicionada!`,
        `1ª parcela lançada em ${selectedPeriod} e as demais parcelas agendadas nos meses seguintes.`
      );
    } else {
      addToast("success", "Compra no cartão lançada", `${newGasto.description} no ${newGasto.card}.`);
    }
  };

  const handleUpdateGastoCartao = (updated: GastoCartao) => {
    const newCartoes = data.cartoes.map((c) => (c.id === updated.id ? updated : c));
    saveState({ ...data, cartoes: newCartoes });
    addToast("success", "Compra no cartão atualizada", `${updated.description} alterada.`);
  };

  const handleDeleteGastoCartao = (id: string, deleteSeries = false) => {
    const targetItem = data.cartoes.find((c) => c.id === id);
    if (!targetItem) return;

    const seriesId = targetItem.installmentSeriesId;

    // Apenas tombstonar o ID específico e a série específica (sem bloquear futuras compras com nomes parecidos)
    const keysToTombstone = [targetItem.id];

    if (deleteSeries && (seriesId || targetItem.installments?.includes("/"))) {
      if (seriesId) {
        keysToTombstone.push(`series_${seriesId}`);
      }

      // Record deletions locally and in cloud
      recordDeletedExpenseKeys(keysToTombstone, currentUser?.uid);

      // 1. Remove from current month state
      const newCartoes = data.cartoes.filter(
        (c) => c.id !== id && (seriesId ? c.installmentSeriesId !== seriesId : true)
      );
      saveState({ ...data, cartoes: newCartoes });

      // 2. Remove from other months in LocalStorage
      const affectedMonths: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("fin_iq_month_")) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const mData = JSON.parse(raw);
              const originalCount = (mData.cartoes || []).length;
              const filtered = (mData.cartoes || []).filter(
                (c: GastoCartao) =>
                  c.id !== id && (seriesId ? c.installmentSeriesId !== seriesId : true)
              );
              if (filtered.length !== originalCount) {
                mData.cartoes = filtered;
                localStorage.setItem(key, JSON.stringify(mData));
                affectedMonths.push(key.replace("fin_iq_month_", ""));
              }
            }
          }
        }
      } catch (e) {
        console.error("Erro ao remover parcelas do localStorage:", e);
      }

      // 3. Remove from Firestore across months
      if (currentUser && seriesId) {
        removeInstallmentsFromCloud(currentUser.uid, seriesId, affectedMonths).catch(console.error);
      }

      addToast(
        "info",
        "Parcelas Removidas",
        "Todas as parcelas desta compra foram excluídas e não voltarão mais."
      );
    } else {
      // Delete single item
      recordDeletedExpenseKeys(keysToTombstone, currentUser?.uid);
      saveState({ ...data, cartoes: data.cartoes.filter((c) => c.id !== id) });
      addToast("info", "Lançamento removido deste mês.");
    }
  };

  const handleSaveCard = (card: CardConfig) => {
    const existingIndex = data.cards.findIndex((c) => c.id === card.id);
    let updatedCards: CardConfig[];
    if (existingIndex >= 0) {
      updatedCards = [...data.cards];
      updatedCards[existingIndex] = card;
      addToast("success", `Cartão ${card.name} atualizado`, `Fechamento dia ${card.closingDay}, vencimento dia ${card.dueDay}.`);
    } else {
      updatedCards = [...data.cards, card];
      addToast("success", `Cartão ${card.name} cadastrado`, `Fechamento dia ${card.closingDay}, vencimento dia ${card.dueDay}.`);
    }

    // Persist cards globally
    try {
      localStorage.setItem(GLOBAL_CARDS_KEY, JSON.stringify(updatedCards));
    } catch {}

    saveState({ ...data, cards: updatedCards });
  };

  const handleDeleteCard = (cardId: string) => {
    if (data.cards.length <= 1) {
      addToast("warning", "Atenção", "É necessário manter ao menos 1 cartão configurado.");
      return;
    }
    const cardName = data.cards.find((c) => c.id === cardId)?.name || "Cartão";
    const updatedCards = data.cards.filter((c) => c.id !== cardId);

    try {
      localStorage.setItem(GLOBAL_CARDS_KEY, JSON.stringify(updatedCards));
    } catch {}

    saveState({ ...data, cards: updatedCards });
    addToast("info", `Cartão ${cardName} removido`);
  };

  // --- Handlers for Investimentos ---
  const handleAddInvestimento = (newInv: Omit<Investimento, "id">) => {
    const item: Investimento = { id: "inv_" + Date.now(), ...newInv };
    const newInvs = [item, ...data.investimentos];
    saveState({ ...data, investimentos: newInvs });
    replicateInvestmentsAcrossMonths(newInvs, selectedPeriod, currentUser?.uid);
    addToast("success", "Ativo Cadastrado!", `${item.description} salvo e replicado nos meses seguintes.`);
  };

  const handleUpdateInvestimento = (updated: Investimento) => {
    const newInvs = data.investimentos.map((i) => (i.id === updated.id ? updated : i));
    saveState({ ...data, investimentos: newInvs });
    replicateInvestmentsAcrossMonths(newInvs, selectedPeriod, currentUser?.uid);
    addToast("success", "Ativo Atualizado!", `${updated.description} alterado e replicado.`);
  };

  const handleDeleteInvestimento = (id: string) => {
    const newInvs = data.investimentos.filter((i) => i.id !== id);
    saveState({ ...data, investimentos: newInvs });
    replicateInvestmentsAcrossMonths(newInvs, selectedPeriod, currentUser?.uid);
    addToast("info", "Ativo Removido", "Alteração refletida nos meses seguintes.");
  };

  // --- Handlers for Imprevistos ---
  const handleAddImprevisto = (newImp: Omit<GastoImprevisto, "id">) => {
    const item: GastoImprevisto = { id: "imp_" + Date.now(), ...newImp };
    saveState({ ...data, imprevistos: [item, ...data.imprevistos] });
    addToast("warning", "Imprevisto registrado", `${item.description} computado.`);
  };

  const handleUpdateImprevisto = (updated: GastoImprevisto) => {
    const newImps = data.imprevistos.map((imp) => (imp.id === updated.id ? updated : imp));
    saveState({ ...data, imprevistos: newImps });
    addToast("success", "Imprevisto atualizado", `${updated.description} alterado com sucesso.`);
  };

  const handleDeleteImprevisto = (id: string) => {
    saveState({ ...data, imprevistos: data.imprevistos.filter((i) => i.id !== id) });
    addToast("info", "Imprevisto removido");
  };

  // --- Handlers for Meta & Campo Riqueza ---
  const handleUpdateMetaRiqueza = (newMeta: number) => {
    saveState({ ...data, metaRiqueza: newMeta });
    addToast("success", "Meta Financeira Atualizada", "Sua meta de longo prazo foi ajustada.");
  };

  const handleUpdateInvestimentoAnterior = (val: number) => {
    saveState({ ...data, investimentoAcumuladoAnterior: val });
    addToast("success", "Patrimônio Acumulado Ajustado", "Base de cálculo patrimonial atualizada.");
  };

  // --- Process Items Extracted via WhatsApp or AI Advisor ---
  const handleProcessExtractedItems = (items: ExtractedItem[]) => {
    let count = 0;
    const newReceitas = [...data.receitas];
    const newGastosFixos = [...data.gastosFixos];
    const newCartoes = [...data.cartoes];
    const newInvestimentos = [...data.investimentos];
    const newImprevistos = [...data.imprevistos];

    const futureInstallmentsByMonth: Record<string, GastoCartao[]> = {};

    items.forEach((item) => {
      count++;
      const todayISO = getTodayISO(0);

      switch (item.type) {
        case "receita":
          newReceitas.unshift({
            id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            description: item.description,
            amount: item.amount,
            date: todayISO,
            category: item.category || "Outros",
          });
          break;

        case "gasto_fixo":
          newGastosFixos.push({
            id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            description: item.description,
            amount: item.amount,
            date: todayISO,
            status: "pendente",
            category: item.category || "Outros",
            recurring: true,
          });
          break;

        case "cartao": {
          const matchedCard =
            data.cards.find(
              (c) =>
                c.id.toLowerCase() === (item.card || "").toLowerCase() ||
                c.name.toLowerCase().includes((item.card || "").toLowerCase())
            ) || data.cards[0];

          const closingDay = matchedCard?.closingDay;
          const initialInvoiceMonth = calculateInvoiceMonth(todayISO, closingDay);

          const { current, total } = parseInstallmentString(item.installments, item.description);
          if (total > 1) {
            const seriesId = "series_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
            const generated = generateInstallments({
              description: item.description,
              card: matchedCard?.id || "Cartão",
              category: item.category || "Outros",
              startDate: todayISO,
              totalInstallments: total,
              startInstallment: current,
              installmentAmount: item.amount,
              totalPurchaseAmount: item.amount * total,
              seriesId,
              closingDay,
            });

            for (const gen of generated) {
              if (gen.monthYear === selectedPeriod) {
                newCartoes.unshift(gen.item);
              } else {
                if (!futureInstallmentsByMonth[gen.monthYear]) {
                  futureInstallmentsByMonth[gen.monthYear] = [];
                }
                futureInstallmentsByMonth[gen.monthYear].push(gen.item);
              }
            }
          } else {
            const isShifted = initialInvoiceMonth !== selectedPeriod;
            const singleItem: GastoCartao = {
              id: "card_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
              card: matchedCard?.id || "Cartão",
              description: item.description,
              amount: item.amount,
              date: todayISO,
              installments: "À vista",
              category: item.category || "Outros",
              totalInstallments: 1,
              currentInstallment: 1,
              totalPurchaseAmount: item.amount,
            };

            if (isShifted) {
              if (!futureInstallmentsByMonth[initialInvoiceMonth]) {
                futureInstallmentsByMonth[initialInvoiceMonth] = [];
              }
              futureInstallmentsByMonth[initialInvoiceMonth].push(singleItem);
            } else {
              newCartoes.unshift(singleItem);
            }
          }
          break;
        }

        case "investimento":
          newInvestimentos.unshift({
            id: "inv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            description: item.description,
            amount: item.amount,
            date: todayISO,
            type: "Renda Fixa",
          });
          break;

        case "imprevisto":
          newImprevistos.unshift({
            id: "imp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            description: item.description,
            amount: item.amount,
            date: todayISO,
            category: item.category || "Outros",
          });
          break;
      }
    });

    const updatedData: FinancialData = {
      ...data,
      receitas: newReceitas,
      gastosFixos: newGastosFixos,
      cartoes: newCartoes,
      investimentos: newInvestimentos,
      imprevistos: newImprevistos,
    };

    saveState(updatedData);

    // Save future installments in other months
    if (Object.keys(futureInstallmentsByMonth).length > 0) {
      for (const [mYear, instList] of Object.entries(futureInstallmentsByMonth)) {
        try {
          const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
          let mData: FinancialData;
          if (raw) {
            mData = JSON.parse(raw);
            mData.cartoes = mergeProjectedInstallments(mData.cartoes || [], instList, getDeletedExpenseKeys());
          } else {
            mData = buildReplicatedMonthBaseline(mYear, data);
            mData.cartoes = instList;
          }
          localStorage.setItem(`fin_iq_month_${mYear}`, JSON.stringify(mData));
        } catch (e) {}
      }

      if (currentUser) {
        addInstallmentsToCloud(currentUser.uid, futureInstallmentsByMonth, data).catch(console.error);
      }
    }

    addToast(
      "success",
      "Extração Concluída com Sucesso!",
      `${count} lançamentos foram distribuídos e categorizados automaticamente pelo FinIq.`
    );
  };

  // --- Export & Import JSON ---
  const handleExportJSON = () => {
    const jsonStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement("a");
    a.href = jsonStr;
    a.download = `FinIq_Backup_${getTodayISO(0)}.json`;
    a.click();
    addToast("info", "Backup exportado com sucesso");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.receitas) && Array.isArray(parsed.cartoes)) {
          saveState(parsed);
          addToast("success", "Dados importados com sucesso!");
        } else {
          addToast("error", "Arquivo JSON inválido.");
        }
      } catch {
        addToast("error", "Erro ao processar arquivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetData = () => {
    if (window.confirm("Deseja resetar todos os lançamentos para os dados padrão de demonstração?")) {
      saveState(INITIAL_DATA);
      addToast("info", "Dados restaurados para o padrão.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Executive Header */}
      <Header
        data={data}
        currentUser={currentUser}
        isCloudSyncing={isCloudSyncing}
        onOpenMobileSyncModal={() => setIsMobileSyncOpen(true)}
        onOpenAuditorModal={() => setIsAuditorOpen(true)}
        onLogout={handleLogout}
        onOpenWhatsAppModal={() => setIsWhatsAppOpen(true)}
        onOpenAdvisorModal={() => setIsAdvisorOpen(true)}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onResetData={handleResetData}
        onReplicateFixedExpenses={handleReplicateFixedExpenses}
        onReplicateFromPreviousMonth={handleReplicateFixedFromPreviousMonth}
        onReplicateInvestments={handleReplicateInvestments}
        onReplicateReceitasAllMonths={handleReplicateReceitasAllMonths}
        onRestoreReceitas={handleRestoreReceitas}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={handleSelectPeriod}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">

        {/* Navigation Tabs Bar */}
        <NavigationTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          metrics={metrics}
        />

        {/* Tab Views */}
        {activeTab === "resumo" && (
          <ResumoView
            data={data}
            metrics={metrics}
            onOpenAdvisorModal={() => setIsAdvisorOpen(true)}
            onOpenWhatsAppModal={() => setIsWhatsAppOpen(true)}
            onToggleFixStatus={handleToggleFixStatus}
          />
        )}

        {activeTab === "receitas" && (
          <ReceitasView
            receitas={data.receitas}
            onAddReceita={handleAddReceita}
            onUpdateReceita={handleUpdateReceita}
            onDeleteReceita={handleDeleteReceita}
            onReplicateAllMonths={handleReplicateReceitasAllMonths}
            onReplicateFromPreviousMonth={handleReplicateReceitasFromPreviousMonth}
            onRestoreReceitas={handleRestoreReceitas}
          />
        )}

        {(activeTab === "gastos-fixos" || (activeTab as string) === "fixos") && (
          <GastosFixosView
            gastosFixos={data.gastosFixos}
            onAddGastoFixo={handleAddGastoFixo}
            onUpdateGastoFixo={handleUpdateGastoFixo}
            onToggleStatus={handleToggleFixStatus}
            onMarkAllAsPaid={handleMarkAllAsPaid}
            onDeleteGastoFixo={handleDeleteGastoFixo}
            onReplicateNextMonth={handleReplicateFixedExpenses}
            onReplicateFromPreviousMonth={handleReplicateFixedFromPreviousMonth}
          />
        )}

        {activeTab === "cartoes" && (
          <CartoesView
            cards={data.cards}
            cartoes={data.cartoes}
            selectedPeriod={selectedPeriod}
            onAddGastoCartao={handleAddGastoCartao}
            onUpdateGastoCartao={handleUpdateGastoCartao}
            onDeleteGastoCartao={handleDeleteGastoCartao}
            onSaveCard={handleSaveCard}
            onDeleteCard={handleDeleteCard}
            onSyncAllInstallments={() => runGlobalInstallmentProjection(true)}
            onCleanDuplicates={handleCleanMonthDuplicates}
          />
        )}

        {activeTab === "investimentos" && (
          <InvestimentosView
            investimentos={data.investimentos}
            totalReceita={metrics.totalReceita}
            onAddInvestimento={handleAddInvestimento}
            onUpdateInvestimento={handleUpdateInvestimento}
            onDeleteInvestimento={handleDeleteInvestimento}
            onReplicateInvestimentos={handleReplicateInvestments}
          />
        )}

        {activeTab === "imprevistos" && (
          <ImprevistosView
            imprevistos={data.imprevistos}
            totalReceita={metrics.totalReceita}
            onAddImprevisto={handleAddImprevisto}
            onUpdateImprevisto={handleUpdateImprevisto}
            onDeleteImprevisto={handleDeleteImprevisto}
          />
        )}
      </main>

      {/* Global Modals & Notifications */}
      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        onProcessItems={handleProcessExtractedItems}
      />

      <AiAdvisorModal
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        data={data}
        metrics={metrics}
        onProcessItems={handleProcessExtractedItems}
      />

      <MobileSyncModal
        isOpen={isMobileSyncOpen}
        onClose={() => setIsMobileSyncOpen(false)}
        currentUser={currentUser}
      />

      <MonthAuditorModal
        isOpen={isAuditorOpen}
        onClose={() => setIsAuditorOpen(false)}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={handleSelectPeriod}
        onRestoreMonthData={saveState}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
