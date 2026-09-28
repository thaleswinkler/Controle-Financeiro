import { GastoCartao } from "../types";

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
}

/**
 * Generates an array of installments across months starting from `startDate`
 * (or from the specified `startInstallment`).
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

  if (totalInstallments <= 1) {
    const monthYear = getMonthYearFromDate(startDate);
    return [
      {
        monthYear,
        item: {
          id: "card_" + Date.now(),
          card,
          description,
          amount: totalPurchaseAmount || installmentAmount,
          date: startDate,
          installments: "À vista",
          category,
          installmentSeriesId: seriesId,
          currentInstallment: 1,
          totalInstallments: 1,
          totalPurchaseAmount: totalPurchaseAmount || installmentAmount,
        },
      },
    ];
  }

  const results: GeneratedInstallment[] = [];

  for (let inst = startInstallment; inst <= totalInstallments; inst++) {
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
        totalPurchaseAmount,
      },
    });
  }

  return results;
}

/**
 * Parses installment count from standard strings like "1/12", "1/3", "À vista", "Recorrente"
 */
export function parseInstallmentString(raw: string): {
  current: number;
  total: number;
  isRecurring: boolean;
} {
  if (!raw) return { current: 1, total: 1, isRecurring: false };
  const str = raw.trim();

  if (str.toLowerCase().includes("recorrente") || str.toLowerCase().includes("assinatura")) {
    return { current: 1, total: 1, isRecurring: true };
  }

  const match = str.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    const current = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    return {
      current: isNaN(current) ? 1 : current,
      total: isNaN(total) ? 1 : total,
      isRecurring: false,
    };
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
