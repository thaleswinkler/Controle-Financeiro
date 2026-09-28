import { GastoCartao, CardConfig } from "../types";

/**
 * Safely adds months to a YYYY-MM-DD or YYYY-MM date string, correctly handling
 * year wrapping (e.g. 2026-12 + 1 month = 2027-01) and month lengths (e.g. Feb 28).
 */
export function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1-12
  const day = parts[2] ? parseInt(parts[2], 10) : 1;

  if (isNaN(year) || isNaN(month)) return dateStr;

  // Calculate target month and year
  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  // Clamp day to maximum days in the target month
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  const yStr = String(targetYear);
  const mStr = String(targetMonth).padStart(2, "0");
  const dStr = String(targetDay).padStart(2, "0");

  return parts.length >= 3 ? `${yStr}-${mStr}-${dStr}` : `${yStr}-${mStr}`;
}

export function getMonthYearFromDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return dateStr;
}

/**
 * In Brazilian financial management (paying bills upon salary and living with card):
 * The system reference month is ALWAYS the NEXT month (+1 from today's calendar date).
 * E.g., in September 2026, the reference month is "2026-10" (Outubro).
 */
export function getDefaultReferenceMonth(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const y = nextMonth.getFullYear();
  const m = String(nextMonth.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Calculates the invoice month (YYYY-MM).
 * Simply returns the calendar month of the purchase date without shifting.
 */
export function calculateInvoiceMonth(
  purchaseDate: string,
  _closingDay?: number
): string {
  if (!purchaseDate) return "";
  return getMonthYearFromDate(purchaseDate);
}

export interface GeneratedInstallment {
  monthYear: string;
  item: GastoCartao;
}

export interface InstallmentGenerationParams {
  description: string;
  card: string;
  category?: string;
  startDate: string; // YYYY-MM-DD
  totalInstallments: number; // 1 to 12 (or up to 24)
  startInstallment?: number; // default 1
  installmentAmount: number;
  totalPurchaseAmount: number;
  seriesId?: string;
  closingDay?: number;
}

/**
 * Generates an array of installments across months starting from `startDate`.
 * - Parcela 1 entra no mês em que o usuário está trabalhando (mês da compra).
 * - Parcela 2 entra no mês seguinte (+1).
 * - Parcela 3 entra no mês posterior (+2), e assim sucessivamente.
 */
export function generateInstallments(
  params: InstallmentGenerationParams
): GeneratedInstallment[] {
  const {
    description,
    card,
    category = "Outros",
    startDate,
    totalInstallments,
    startInstallment = 1,
    installmentAmount,
    totalPurchaseAmount,
    seriesId = "series_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
  } = params;

  const baseMonth = getMonthYearFromDate(startDate);

  if (totalInstallments <= 1) {
    return [
      {
        monthYear: baseMonth,
        item: {
          id: "card_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          card,
          description,
          amount: Math.round((totalPurchaseAmount || installmentAmount) * 100) / 100,
          date: startDate,
          installments: "À vista",
          category,
          installmentSeriesId: seriesId,
          currentInstallment: 1,
          totalInstallments: 1,
          totalPurchaseAmount: Math.round((totalPurchaseAmount || installmentAmount) * 100) / 100,
        },
      },
    ];
  }

  const results: GeneratedInstallment[] = [];

  for (let inst = startInstallment; inst <= totalInstallments; inst++) {
    // Parcela 1 fica no mês de startDate; as seguintes avançam mês a mês
    const offsetMonths = inst - startInstallment;
    const installmentDate = addMonthsToDate(startDate, offsetMonths);
    const monthYear = getMonthYearFromDate(installmentDate);

    results.push({
      monthYear,
      item: {
        id: `card_${seriesId}_inst_${inst}`,
        card,
        description,
        amount: Math.round(installmentAmount * 100) / 100,
        date: installmentDate,
        installments: `${inst}/${totalInstallments}`,
        category,
        installmentSeriesId: seriesId,
        currentInstallment: inst,
        totalInstallments,
        totalPurchaseAmount: Math.round(totalPurchaseAmount * 100) / 100,
      },
    });
  }

  return results;
}

export interface ScannedExpenseItem {
  item: GastoCartao;
  billingMonth?: string;
}

/**
 * Parses installment count from standard strings like "1/12", "1 de 12", "Parcela 1/4", "10x", "À vista", "Recorrente"
 */
export function parseInstallmentString(
  raw?: string,
  desc?: string,
  currentProp?: number,
  totalProp?: number
): {
  current: number;
  total: number;
  isRecurring: boolean;
} {
  if (typeof totalProp === "number" && totalProp > 1) {
    const curr = typeof currentProp === "number" && currentProp >= 1 ? currentProp : 1;
    return { current: curr, total: totalProp, isRecurring: false };
  }
  const str = (raw || "").trim();

  if (
    str.toLowerCase().includes("recorrente") ||
    str.toLowerCase().includes("assinatura") ||
    (desc && (desc.toLowerCase().includes("recorrente") || desc.toLowerCase().includes("assinatura")))
  ) {
    return { current: 1, total: 1, isRecurring: true };
  }

  // Matches "1/12", "1 / 12", "01/12", "1 de 12", "Parcela 1 de 12", "PARC 01/06"
  const matchSlash = str.match(/(\d+)\s*(?:\/|\s+de\s+)\s*(\d+)/i);
  if (matchSlash) {
    const current = parseInt(matchSlash[1], 10);
    const total = parseInt(matchSlash[2], 10);
    return {
      current: isNaN(current) ? 1 : current,
      total: isNaN(total) ? 1 : total,
      isRecurring: false,
    };
  }

  // Matches "10x", "12x", "2x"
  const matchX = str.match(/\b(\d+)\s*x\b/i);
  if (matchX) {
    const total = parseInt(matchX[1], 10);
    return {
      current: 1,
      total: isNaN(total) ? 1 : total,
      isRecurring: false,
    };
  }

  // Check description for "(1/6)" or "1/6" or "1 de 6" or "4/6"
  if (desc) {
    const descMatch = desc.match(/(\d+)\s*(?:\/|\s+de\s+)\s*(\d+)/i);
    if (descMatch) {
      const current = parseInt(descMatch[1], 10);
      const total = parseInt(descMatch[2], 10);
      return {
        current: isNaN(current) ? 1 : current,
        total: isNaN(total) ? 1 : total,
        isRecurring: false,
      };
    }
    const descX = desc.match(/\b(\d+)\s*x\b/i);
    if (descX) {
      const total = parseInt(descX[1], 10);
      return {
        current: 1,
        total: isNaN(total) ? 1 : total,
        isRecurring: false,
      };
    }
  }

  return { current: 1, total: 1, isRecurring: false };
}

export const INSTALLMENT_COUNT_OPTIONS = [
  { value: 1, label: "À vista (1x)" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 4, label: "4x" },
  { value: 5, label: "5x" },
  { value: 6, label: "6x" },
  { value: 7, label: "7x" },
  { value: 8, label: "8x" },
  { value: 9, label: "9x" },
  { value: 10, label: "10x" },
  { value: 11, label: "11x" },
  { value: 12, label: "12x" },
  { value: 18, label: "18x" },
  { value: 24, label: "24x" },
];

/**
 * Generates unique signatures for an expense to identify and prevent resurrecting deleted items
 */
export function makeExpenseSignature(
  desc: string,
  card: string,
  installments: string,
  monthYear: string
): string {
  const cleanDesc = (desc || "").trim().toLowerCase();
  const cleanCard = (card || "").trim().toLowerCase();
  const cleanInst = (installments || "").trim().toLowerCase();
  return `${cleanDesc}:::${cleanCard}:::${cleanInst}:::${monthYear}`;
}

export function makeExpenseItemSignature(item: GastoCartao, monthYear?: string): string {
  const mYear = monthYear || (item.date ? item.date.slice(0, 7) : "");
  return makeExpenseSignature(item.description, item.card, item.installments || "", mYear);
}

export function makeGeneralExpenseKey(
  desc: string,
  card: string,
  amount: number,
  monthYear: string
): string {
  const cleanDesc = (desc || "").trim().toLowerCase();
  const cleanCard = (card || "").trim().toLowerCase();
  const cleanAmt = Math.round(Number(amount || 0) * 100);
  return `${cleanDesc}:::${cleanCard}:::${cleanAmt}:::${monthYear}`;
}

/**
 * Scans an array of existing expenses (from current or known months),
 * identifies all purchases with installments (e.g. 1/4, 1/6, 4/6, 2x, etc.),
 * and projects all subsequent installments into their respective future months.
 * Strictly respects deletedKeys so that deleted items NEVER return.
 */
export function projectMissingInstallmentsFromExpenses(
  expenses: (GastoCartao | ScannedExpenseItem)[],
  deletedKeys?: Set<string>,
  _cardsConfig?: CardConfig[]
): Record<string, GastoCartao[]> {
  const projectedByMonth: Record<string, GastoCartao[]> = {};
  const processedSeries = new Set<string>();

  for (const entry of expenses) {
    if (!entry) continue;
    const item: GastoCartao = "item" in entry && entry.item ? entry.item : (entry as GastoCartao);
    if (!item || !item.description) continue;

    const { current, total, isRecurring } = parseInstallmentString(
      item.installments,
      item.description,
      item.currentInstallment,
      item.totalInstallments
    );

    if (isRecurring || total <= 1) continue;

    // Determine the month in which THIS installment is billed:
    // Prefer explicit billingMonth from the container month, else extract from item.date
    const rawBillingMonth =
      "billingMonth" in entry && entry.billingMonth
        ? entry.billingMonth
        : item.date && item.date.length >= 7
        ? item.date.slice(0, 7)
        : "";

    if (!rawBillingMonth || !/^\d{4}-\d{2}$/.test(rawBillingMonth)) continue;

    const safeDesc = item.description.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const safeCard = (item.card || "card").toLowerCase();
    const totalAmt = item.totalPurchaseAmount || item.amount * total;
    const seriesId =
      item.installmentSeriesId ||
      `series_${safeDesc}_${safeCard}_${Math.round(totalAmt * 100)}_${total}`;

    // Prevent re-processing the same series multiple times from different months
    const seriesKey = `${seriesId}_${total}`;
    if (processedSeries.has(seriesKey)) continue;
    processedSeries.add(seriesKey);

    // Day of purchase in month
    const dayPart = item.date && item.date.split("-")[2] ? item.date.split("-")[2] : "10";

    for (let inst = 1; inst <= total; inst++) {
      // Calculate target month for installment 'inst' relative to 'rawBillingMonth' where 'current' is billed
      const monthOffset = inst - current;
      const targetMonthYear = addMonthsToDate(rawBillingMonth + "-01", monthOffset).slice(0, 7);
      const instLabel = `${inst}/${total}`;
      const targetDate = `${targetMonthYear}-${dayPart}`;
      const instId = `card_${seriesId}_inst_${inst}`;

      // Respect user's explicit deletion of this item or series
      if (deletedKeys) {
        if (
          deletedKeys.has(instId) ||
          deletedKeys.has(`series_${seriesId}`) ||
          (item.installmentSeriesId && deletedKeys.has(`series_${item.installmentSeriesId}`))
        ) {
          continue;
        }
      }

      const newItem: GastoCartao = {
        id: instId,
        card: item.card,
        description: item.description,
        amount: Math.round(item.amount * 100) / 100,
        date: targetDate,
        installments: instLabel,
        category: item.category || "Compras",
        installmentSeriesId: seriesId,
        currentInstallment: inst,
        totalInstallments: total,
        totalPurchaseAmount: Math.round(totalAmt * 100) / 100,
      };

      if (!projectedByMonth[targetMonthYear]) {
        projectedByMonth[targetMonthYear] = [];
      }
      projectedByMonth[targetMonthYear].push(newItem);
    }
  }

  return projectedByMonth;
}

/**
 * Cleans up duplicated or stale purchases in a month's credit card invoice:
 * - Detects duplicate entries of the exact same purchase and keeps only 1.
 * Returns the cleaned list and the list of deleted items so their signatures can be tombstoned.
 */
export function cleanupMonthCartoes(
  cartoes: GastoCartao[],
  _currentMonthYear: string
): { cleaned: GastoCartao[]; removedCount: number; removedItems: GastoCartao[] } {
  const result: GastoCartao[] = [];
  const removedItems: GastoCartao[] = [];
  const seenExact = new Set<string>();

  for (const item of cartoes) {
    const cleanDesc = (item.description || "").trim().toLowerCase();
    const cleanCard = (item.card || "").trim().toLowerCase();
    const cleanInst = (item.installments || "").trim().toLowerCase();
    const cleanAmt = Math.round(Number(item.amount || 0) * 100);

    // Exact match key
    const exactKey = `${cleanDesc}:::${cleanCard}:::${cleanAmt}:::${cleanInst}`;

    if (seenExact.has(exactKey)) {
      removedItems.push(item);
      continue;
    }

    seenExact.add(exactKey);
    result.push(item);
  }

  return {
    cleaned: result,
    removedCount: removedItems.length,
    removedItems,
  };
}

/**
 * Merges projected installments into a list of card expenses without duplicating.
 * If an item of the same installment series is present with an outdated installment number,
 * it replaces it with the correctly updated one.
 */
export function mergeProjectedInstallments(
  existingCartoes: GastoCartao[],
  projected: GastoCartao[],
  deletedKeys?: Set<string>
): GastoCartao[] {
  const result = [...existingCartoes];

  for (const item of projected) {
    // Check if explicitly deleted by user
    if (deletedKeys) {
      if (
        deletedKeys.has(item.id) ||
        deletedKeys.has(`series_${item.installmentSeriesId}`) ||
        (item.installmentSeriesId && deletedKeys.has(`series_${item.installmentSeriesId}`))
      ) {
        continue;
      }
    }

    // Check if the exact installment already exists
    const exactIdx = result.findIndex(
      (c) =>
        c.id === item.id ||
        (c.installmentSeriesId &&
          item.installmentSeriesId &&
          c.installmentSeriesId === item.installmentSeriesId &&
          c.currentInstallment === item.currentInstallment) ||
        (c.description.trim().toLowerCase() === item.description.trim().toLowerCase() &&
          c.card === item.card &&
          c.installments === item.installments)
    );

    if (exactIdx >= 0) {
      // Already present
      continue;
    }

    // Check if the same series exists in this month with an outdated/wrong installment number
    const seriesIdx = result.findIndex(
      (c) =>
        (c.installmentSeriesId &&
          item.installmentSeriesId &&
          c.installmentSeriesId === item.installmentSeriesId) ||
        (c.description.trim().toLowerCase() === item.description.trim().toLowerCase() &&
          c.card === item.card &&
          c.totalInstallments === item.totalInstallments &&
          (c.totalInstallments || 1) > 1)
    );

    if (seriesIdx >= 0) {
      // Replace outdated installment in this month with the correctly projected one
      result[seriesIdx] = item;
    } else {
      result.push(item);
    }
  }

  return result;
}
