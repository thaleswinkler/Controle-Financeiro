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
} from "./utils/installments";
import { Header } from "./components/Header";
import { NavigationTabs } from "./components/NavigationTabs";
import { ResumoView } from "./components/ResumoView";
import { ReceitasView } from "./components/ReceitasView";
import { GastosFixosView } from "./components/GastosFixosView";
import { CartoesView } from "./components/CartoesView";
import { InvestimentosView } from "./components/InvestimentosView";
import { ImprevistosView } from "./components/ImprevistosView";
import { CampoRiquezaView } from "./components/CampoRiquezaView";
import { WhatsAppModal } from "./components/WhatsAppModal";
import { AiAdvisorModal } from "./components/AiAdvisorModal";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { AuthModal } from "./components/AuthModal";
import {
  auth,
  subscribeToMonthData,
  saveMonthDataToCloud,
  addInstallmentsToCloud,
  removeInstallmentsFromCloud,
  getAllUserMonthsFromCloud,
  saveDeletionsToCloud,
  getDeletionsFromCloud,
  getStoredCloudSession,
  logoutUser,
  CloudUserSession,
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const GLOBAL_CARDS_KEY = "fin_iq_cards_config_v2";
const STORAGE_KEY = "fin_iq_pro_data_v2";
const DELETED_KEYS_STORAGE = "fin_iq_deleted_expenses_v2";
const LAST_PERIOD_KEY = "fin_iq_last_selected_period";

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

export default function App() {
  // Reference month is dynamically initialized to the upcoming month (e.g. 2026-10)
  // or user's last remembered period
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LAST_PERIOD_KEY);
      if (saved && /^\d{4}-\d{2}$/.test(saved)) {
        return saved;
      }
    } catch {}
    return getDefaultReferenceMonth();
  });

  // Load configured cards globally so changes apply across all months
  const loadStoredCards = (): CardConfig[] => {
    try {
      const savedCards = localStorage.getItem(GLOBAL_CARDS_KEY);
      if (savedCards) {
        const parsed = JSON.parse(savedCards);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_DATA.cards;
  };

  const [data, setData] = useState<FinancialData>(() => {
    const initialPeriod = (() => {
      try {
        const saved = localStorage.getItem(LAST_PERIOD_KEY);
        if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
      } catch {}
      return getDefaultReferenceMonth();
    })();

    try {
      // First check month-specific storage for initialPeriod
      const monthSpecific = localStorage.getItem(`fin_iq_month_${initialPeriod}`);
      if (monthSpecific) {
        const parsed = JSON.parse(monthSpecific);
        if (parsed && Array.isArray(parsed.cartoes)) {
          return {
            ...INITIAL_DATA,
            ...parsed,
            monthYear: initialPeriod,
            cards: loadStoredCards(),
          };
        }
      }

      // Check legacy single storage key
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.receitas) && Array.isArray(parsed.cartoes)) {
          return {
            ...INITIAL_DATA,
            ...parsed,
            monthYear: initialPeriod,
            cards: loadStoredCards(),
          };
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados do localStorage:", e);
    }
    return { ...INITIAL_DATA, monthYear: initialPeriod, cards: loadStoredCards() };
  });

  const [currentUser, setCurrentUser] = useState<CloudUserSession | null>(() =>
    getStoredCloudSession()
  );
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("resumo");
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Keep a ref to the latest data to prevent race conditions during async Firestore callbacks
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Listen to Firebase Auth state if signed in via Google
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const session: CloudUserSession = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email?.split("@")[0] || "Usuário",
          isFirebaseUser: true,
        };
        setCurrentUser(session);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Sync deleted keys from cloud whenever user logs in
  useEffect(() => {
    if (!currentUser) return;
    getDeletionsFromCloud(currentUser.uid)
      .then((cloudKeys) => {
        if (cloudKeys && cloudKeys.length > 0) {
          recordDeletedExpenseKeys(cloudKeys);
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
        if (remoteData && remoteData.monthYear === selectedPeriod) {
          const deletedKeys = getDeletedExpenseKeys();

          // Filter out any cartoes matching deleted keys or signatures
          const filteredCartoes = (remoteData.cartoes || []).filter((c) => {
            const sig = makeExpenseSignature(c.description, c.card, c.installments || "", selectedPeriod);
            const genKey = makeGeneralExpenseKey(c.description, c.card, c.amount, selectedPeriod);
            return (
              !deletedKeys.has(c.id) &&
              !deletedKeys.has(sig) &&
              !deletedKeys.has(genKey) &&
              (!c.installmentSeriesId || !deletedKeys.has(`series_${c.installmentSeriesId}`))
            );
          });

          // Ensure fixed expenses are present: if remote has none, inherit from current state
          const finalFixed =
            Array.isArray(remoteData.gastosFixos) && remoteData.gastosFixos.length > 0
              ? remoteData.gastosFixos
              : dataRef.current.gastosFixos.length > 0
              ? dataRef.current.gastosFixos.map((f) => ({
                  ...f,
                  status: "pendente" as const,
                  date: `${selectedPeriod}-${(f.date || "").split("-")[2] || "05"}`,
                }))
              : INITIAL_DATA.gastosFixos;

          const finalData: FinancialData = {
            ...remoteData,
            cartoes: filteredCartoes,
            gastosFixos: finalFixed,
            cards:
              Array.isArray(remoteData.cards) && remoteData.cards.length > 0
                ? remoteData.cards
                : dataRef.current.cards,
          };
          setData(finalData);
          try {
            localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(finalData));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(finalData));
          } catch {}
        } else {
          // If month doesn't exist on cloud yet, upload current state to seed it
          saveMonthDataToCloud(currentUser.uid, selectedPeriod, dataRef.current).catch((err) => {
            console.error("Erro ao inicializar mês na nuvem:", err);
          });
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

  // Persist state changes locally and in Firebase cloud
  const saveState = (newData: FinancialData) => {
    setData(newData);
    try {
      localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(newData));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
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

  // Helper to collect all known expenses from storage across all months
  const collectAllExpensesFromStorage = (): GastoCartao[] => {
    const allExpensesMap = new Map<string, GastoCartao>();
    for (const c of data.cartoes || []) {
      allExpensesMap.set(c.id, c);
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("fin_iq_month_") || key === STORAGE_KEY)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.cartoes)) {
              for (const c of parsed.cartoes) {
                allExpensesMap.set(c.id, c);
              }
            }
          }
        }
      }
    } catch {}
    return Array.from(allExpensesMap.values());
  };

  // Helper to build a clean baseline for a new month inheriting fixed expenses
  const buildNewMonthBaseline = (monthYear: string, source: FinancialData): FinancialData => {
    return {
      monthYear,
      cards: source.cards,
      receitas: [],
      gastosFixos: (source.gastosFixos || []).map((f) => ({
        ...f,
        id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        status: "pendente" as const,
        date: `${monthYear}-${(f.date || "").split("-")[2] || "05"}`,
      })),
      cartoes: [],
      investimentos: [],
      imprevistos: [],
      metaRiqueza: source.metaRiqueza,
      investimentoAcumuladoAnterior:
        (source.investimentoAcumuladoAnterior || 0) +
        (source.investimentos || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0),
    };
  };

  // Retroactively scan and project all existing installments across all months
  const runGlobalInstallmentProjection = async () => {
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

      // Injects into each target month in LocalStorage
      for (const [mYear, items] of Object.entries(projectedByMonth)) {
        try {
          const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
          let mData: FinancialData;
          if (raw) {
            mData = JSON.parse(raw);
            const initialCount = (mData.cartoes || []).length;
            mData.cartoes = mergeProjectedInstallments(mData.cartoes || [], items, deletedKeys);
            totalInjected += mData.cartoes.length - initialCount;
          } else {
            mData = buildNewMonthBaseline(mYear, data);
            mData.cartoes = items;
            totalInjected += items.length;
          }
          localStorage.setItem(`fin_iq_month_${mYear}`, JSON.stringify(mData));
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

      if (totalInjected > 0) {
        addToast(
          "success",
          "Parcelas Projetadas com Sucesso!",
          `${totalInjected} parcelas existentes foram distribuídas e salvas nos meses seguintes.`
        );
      } else {
        addToast("info", "Parcelas em dia", "Todas as compras parceladas já estão projetadas nos meses seguintes.");
      }
    } catch (err) {
      console.error("Erro ao sincronizar parcelas:", err);
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

  // Switching months seamlessly and ensuring installments & fixed expenses are loaded
  const handleSelectPeriod = (newPeriod: string) => {
    if (newPeriod === selectedPeriod) return;

    // 1. Save current month before switching
    try {
      localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(data));
      localStorage.setItem(LAST_PERIOD_KEY, newPeriod);
    } catch (e) {}

    // 2. Set new period
    setSelectedPeriod(newPeriod);

    // 3. Look up local data for newPeriod or build baseline
    let targetMonthData: FinancialData;
    const rawLocal = localStorage.getItem(`fin_iq_month_${newPeriod}`);
    if (rawLocal) {
      try {
        targetMonthData = JSON.parse(rawLocal);
      } catch {
        targetMonthData = buildNewMonthBaseline(newPeriod, data);
      }
    } else {
      targetMonthData = buildNewMonthBaseline(newPeriod, data);
    }

    // Ensure fixed expenses are present (inherit recurring fixed expenses if missing)
    if (!targetMonthData.gastosFixos || targetMonthData.gastosFixos.length === 0) {
      targetMonthData.gastosFixos = data.gastosFixos.map((f) => ({
        ...f,
        id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        status: "pendente" as const,
        date: `${newPeriod}-${(f.date || "").split("-")[2] || "05"}`,
      }));
    }

    // 4. Project missing installments from all existing purchases into this new period
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

    setData(targetMonthData);
    try {
      localStorage.setItem(`fin_iq_month_${newPeriod}`, JSON.stringify(targetMonthData));
    } catch {}

    if (currentUser) {
      saveMonthDataToCloud(currentUser.uid, newPeriod, targetMonthData).catch(console.error);
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
    saveState({ ...data, receitas: data.receitas.filter((r) => r.id !== id) });
    addToast("info", "Receita removida");
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

  const handleReplicateFixedExpenses = () => {
    const count = data.gastosFixos.length;
    if (count === 0) {
      addToast("warning", "Nenhuma conta fixa cadastrada para replicar.");
      return;
    }
    const cloned = data.gastosFixos.map((f) => ({
      ...f,
      id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      status: "pendente" as const,
      date: `${selectedPeriod}-${(f.date || "").split("-")[2] || "05"}`,
    }));
    saveState({ ...data, gastosFixos: cloned });
    addToast("success", "Contas replicadas com sucesso!", `${count} contas fixas preparadas para o novo mês.`);
  };

  // --- Handlers for Credit Cards & Installments Across Future Months ---
  const handleAddGastoCartao = (
    newGasto: Omit<GastoCartao, "id">,
    installmentDetails?: {
      totalInstallments: number;
      startInstallment: number;
      installmentAmount: number;
      totalAmount: number;
      closingDay?: number;
    }
  ) => {
    // 1. Identify card config and closing day
    const cardConfig = data.cards.find((c) => c.id === newGasto.card || c.name === newGasto.card);
    const closingDay = installmentDetails?.closingDay ?? cardConfig?.closingDay;

    const isMultiInstallment = installmentDetails && installmentDetails.totalInstallments > 1;
    const totalInst = isMultiInstallment ? installmentDetails.totalInstallments : 1;
    const startInst = installmentDetails?.startInstallment || 1;
    const instAmount = installmentDetails?.installmentAmount || newGasto.amount;
    const totalAmt = installmentDetails?.totalAmount || newGasto.amount;

    // 2. Determine initial invoice month based on closing day
    const purchaseDate = newGasto.date || getTodayISO(0);
    const initialInvoiceMonth = calculateInvoiceMonth(purchaseDate, closingDay);
    const isShiftedToNext = initialInvoiceMonth !== selectedPeriod;

    // 3. Generate all installments accurately
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
      closingDay,
    });

    // Group installments by invoice month
    const byMonth: Record<string, GastoCartao[]> = {};
    for (const gen of generated) {
      if (!byMonth[gen.monthYear]) {
        byMonth[gen.monthYear] = [];
      }
      byMonth[gen.monthYear].push(gen.item);
    }

    // 4. Update current active state ONLY if this month is the target for any installment
    const currentMonthItems = byMonth[selectedPeriod] || [];
    if (currentMonthItems.length > 0) {
      saveState({ ...data, cartoes: [...currentMonthItems, ...data.cartoes] });
    }

    // 5. Propagate into LocalStorage for all target months
    for (const [mYear, items] of Object.entries(byMonth)) {
      if (mYear === selectedPeriod && currentMonthItems.length > 0) continue; // Already saved above
      try {
        const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
        let mData: FinancialData;
        if (raw) {
          mData = JSON.parse(raw);
          const existing = mData.cartoes || [];
          mData.cartoes = mergeProjectedInstallments(existing, items, getDeletedExpenseKeys());
          mData.cards = data.cards;
        } else {
          mData = buildNewMonthBaseline(mYear, data);
          mData.cartoes = items;
        }
        localStorage.setItem(`fin_iq_month_${mYear}`, JSON.stringify(mData));
      } catch (err) {
        console.error("Erro ao salvar parcela no localStorage para", mYear, err);
      }
    }

    // 6. Propagate into Firestore across months if cloud is active
    if (currentUser) {
      addInstallmentsToCloud(currentUser.uid, byMonth, data).catch(console.error);
    }

    // 7. Clear, user-friendly feedback
    if (isShiftedToNext) {
      addToast(
        "info",
        `Compra agendada para ${initialInvoiceMonth}!`,
        `Como a compra foi feita após o fechamento do cartão (dia ${closingDay}), ela entrará na fatura de ${initialInvoiceMonth}.`
      );
    } else if (isMultiInstallment) {
      addToast(
        "success",
        `Compra parcelada em ${totalInst}x`,
        `${totalInst} parcelas programadas automaticamente nos meses seguintes!`
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
    const safeDesc = targetItem.description.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const safeCard = (targetItem.card || "card").toLowerCase();

    // Prepare tombstone keys to guarantee deleted items NEVER return upon reload or projection
    const keysToTombstone = [
      targetItem.id,
      makeExpenseSignature(targetItem.description, targetItem.card, targetItem.installments || "", selectedPeriod),
      makeGeneralExpenseKey(targetItem.description, targetItem.card, targetItem.amount, selectedPeriod),
    ];

    if (deleteSeries && (seriesId || targetItem.installments?.includes("/"))) {
      if (seriesId) {
        keysToTombstone.push(`series_${seriesId}`);
      }
      keysToTombstone.push(`series_${safeDesc}_${safeCard}`);

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
      // Delete single item (and permanently tombstone it for this month)
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
    saveState({ ...data, investimentos: [item, ...data.investimentos] });
    addToast("success", "Aporte registrado!", `${item.description} adicionado ao patrimônio.`);
  };

  const handleUpdateInvestimento = (updated: Investimento) => {
    const newInvs = data.investimentos.map((i) => (i.id === updated.id ? updated : i));
    saveState({ ...data, investimentos: newInvs });
    addToast("success", "Aporte atualizado", `${updated.description} alterado com sucesso.`);
  };

  const handleDeleteInvestimento = (id: string) => {
    saveState({ ...data, investimentos: data.investimentos.filter((i) => i.id !== id) });
    addToast("info", "Aporte removido");
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
            mData = buildNewMonthBaseline(mYear, data);
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
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenWhatsAppModal={() => setIsWhatsAppOpen(true)}
        onOpenAdvisorModal={() => setIsAdvisorOpen(true)}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onResetData={handleResetData}
        onReplicateFixedExpenses={handleReplicateFixedExpenses}
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
          />
        )}

        {activeTab === "cartoes" && (
          <CartoesView
            cards={data.cards}
            cartoes={data.cartoes}
            onAddGastoCartao={handleAddGastoCartao}
            onUpdateGastoCartao={handleUpdateGastoCartao}
            onDeleteGastoCartao={handleDeleteGastoCartao}
            onSaveCard={handleSaveCard}
            onDeleteCard={handleDeleteCard}
            onSyncAllInstallments={runGlobalInstallmentProjection}
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

        {activeTab === "riqueza" && (
          <CampoRiquezaView
            metrics={metrics}
            metaRiqueza={data.metaRiqueza}
            investimentoAcumuladoAnterior={data.investimentoAcumuladoAnterior}
            onUpdateMeta={handleUpdateMetaRiqueza}
            onUpdateInvestimentoAnterior={handleUpdateInvestimentoAnterior}
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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(session) => {
          setCurrentUser(session);
          addToast("success", "Sincronização Conectada!", `Bem-vindo de volta, ${session.displayName}.`);
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
