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
 * Calculates the credit card invoice month (YYYY-MM).
 * In Brazilian credit card rules:
 * If the purchase day is on or after the card's closingDay (dia de fechamento / melhor dia de compra),
 * the current invoice is closed and the purchase automatically enters NEXT month's invoice!
 */
export function calculateInvoiceMonth(
  purchaseDate: string,
  closingDay?: number
): string {
  if (!purchaseDate) return "";
  const parts = purchaseDate.split("-");
  if (parts.length < 3) return purchaseDate.slice(0, 7);
  const day = parseInt(parts[2], 10);

  // If purchase day >= closingDay, invoice has closed for this month, belongs to next month!
  if (closingDay && closingDay > 0 && day >= closingDay) {
    return addMonthsToDate(purchaseDate, 1).slice(0, 7);
  }
  return `${parts[0]}-${parts[1]}`;
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
 * Generates an array of installments across months starting from `startDate`
 * (or from the specified `startInstallment`), accurately honoring the credit card closing day.
 * If purchase day >= closingDay:
 *   - The 1st installment starts in NEXT month!
 *   - Subsequent installments follow month by month.
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
    closingDay,
  } = params;

  // Determine initial invoice month based on closing day
  const initialInvoiceMonth = calculateInvoiceMonth(startDate, closingDay);
  const calendarMonth = getMonthYearFromDate(startDate);
  const isPostClosing = initialInvoiceMonth !== calendarMonth;

  if (totalInstallments <= 1) {
    const itemDate = isPostClosing ? addMonthsToDate(startDate, 1) : startDate;
    return [
      {
        monthYear: initialInvoiceMonth,
        item: {
          id: "card_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          card,
          description,
          amount: Math.round((totalPurchaseAmount || installmentAmount) * 100) / 100,
          date: itemDate,
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
    // If purchase was made after closing day, the 1st installment starts in +1 month
    const offsetMonths = inst - startInstallment + (isPostClosing ? 1 : 0);
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
  if (currentProp && totalProp && totalProp > 1) {
    return { current: currentProp, total: totalProp, isRecurring: false };
  }
  const str = (raw || "").trim();

  if (str.toLowerCase().includes("recorrente") || str.toLowerCase().includes("assinatura")) {
    return { current: 1, total: 1, isRecurring: true };
  }

  // Matches "1/12", "1 / 12", "01/12", "1 de 12", "Parcela 1 de 12"
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

  // Matches "10x", "12x"
  const matchX = str.match(/(\d+)\s*x/i);
  if (matchX) {
    const total = parseInt(matchX[1], 10);
    return {
      current: 1,
      total: isNaN(total) ? 1 : total,
      isRecurring: false,
    };
  }

  // Check description for "(1/6)" or "1/6" or "1 de 6"
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
 * Scans an array of existing expenses (e.g. from current or previous months),
 * identifies all purchases with installments (e.g. 1/4, 1/6, 2/6, etc.),
 * and projects all missing subsequent installments into their respective future months.
 * Strictly checks `deletedKeys` so that deleted items NEVER return.
 */
export function projectMissingInstallmentsFromExpenses(
  expenses: GastoCartao[],
  deletedKeys?: Set<string>,
  cardsConfig?: CardConfig[]
): Record<string, GastoCartao[]> {
  const projectedByMonth: Record<string, GastoCartao[]> = {};
  const processedSeries = new Set<string>();

  for (const item of expenses) {
    const { current, total, isRecurring } = parseInstallmentString(
      item.installments,
      item.description,
      item.currentInstallment,
      item.totalInstallments
    );

    if (isRecurring || total <= 1) continue;

    const safeDesc = item.description.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const safeCard = (item.card || "card").toLowerCase();
    const seriesId =
      item.installmentSeriesId ||
      `series_${safeDesc}_${safeCard}_${Math.round(item.amount * 100)}_${total}`;

    // Prevent re-processing the same series multiple times from different months
    const seriesKey = `${seriesId}_${total}`;
    if (processedSeries.has(seriesKey)) continue;
    processedSeries.add(seriesKey);

    const totalAmt = item.totalPurchaseAmount || item.amount * total;
    const cardConfig = cardsConfig?.find((c) => c.id === item.card || c.name === item.card);
    const closingDay = cardConfig?.closingDay;

    // Determine the base invoice month of installment 1
    // If the item itself is installment `current`, find where installment 1 was
    const itemMonth = item.date ? item.date.slice(0, 7) : "";
    const baseInvoiceMonth = addMonthsToDate(itemMonth + "-01", -(current - 1)).slice(0, 7);

    for (let inst = current + 1; inst <= total; inst++) {
      const offsetFromBase = inst - 1;
      const targetMonthYear = addMonthsToDate(baseInvoiceMonth + "-01", offsetFromBase).slice(0, 7);
      const instLabel = `${inst}/${total}`;

      // Pick a representative date in the target month (e.g. same day of original purchase)
      const dayPart = item.date && item.date.split("-")[2] ? item.date.split("-")[2] : "10";
      const targetDate = `${targetMonthYear}-${dayPart}`;

      // Check if user previously deleted this specific installment or the series
      const signature = makeExpenseSignature(item.description, item.card, instLabel, targetMonthYear);
      const generalKey = makeGeneralExpenseKey(item.description, item.card, item.amount, targetMonthYear);
      const instId = `card_${seriesId}_inst_${inst}`;

      if (deletedKeys) {
        if (
          deletedKeys.has(instId) ||
          deletedKeys.has(signature) ||
          deletedKeys.has(generalKey) ||
          deletedKeys.has(`series_${seriesId}`) ||
          deletedKeys.has(`series_${safeDesc}_${safeCard}`)
        ) {
          continue; // Respect user deletion!
        }
      }

      const newItem: GastoCartao = {
        id: instId,
        card: item.card,
        description: item.description,
        amount: item.amount,
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
 * - Detects conflicting installments (e.g. an old 1/6 and a newer 2/6 in the same month).
 * Returns the cleaned list and the list of deleted items so their signatures can be tombstoned.
 */
export function cleanupMonthCartoes(
  cartoes: GastoCartao[],
  currentMonthYear: string
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
 */
export function mergeProjectedInstallments(
  existingCartoes: GastoCartao[],
  projected: GastoCartao[],
  deletedKeys?: Set<string>
): GastoCartao[] {
  const result = [...existingCartoes];

  for (const item of projected) {
    // Check if deleted
    if (deletedKeys) {
      const sig = makeExpenseItemSignature(item);
      const genKey = makeGeneralExpenseKey(
        item.description,
        item.card,
        item.amount,
        item.date ? item.date.slice(0, 7) : ""
      );
      if (
        deletedKeys.has(item.id) ||
        deletedKeys.has(sig) ||
        deletedKeys.has(genKey) ||
        (item.installmentSeriesId && deletedKeys.has(`series_${item.installmentSeriesId}`))
      ) {
        continue;
      }
    }

    const alreadyExists = result.some(
      (c) =>
        c.id === item.id ||
        (c.description.trim().toLowerCase() === item.description.trim().toLowerCase() &&
          c.card === item.card &&
          (c.installments === item.installments ||
            (c.currentInstallment === item.currentInstallment &&
              c.totalInstallments === item.totalInstallments &&
              item.totalInstallments &&
              item.totalInstallments > 1)))
    );

    if (!alreadyExists) {
      result.push(item);
    }
  }

  return result;
}
