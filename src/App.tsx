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
  projectMissingInstallmentsFromExpenses,
  mergeProjectedInstallments,
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
  getStoredCloudSession,
  logoutUser,
  CloudUserSession,
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const GLOBAL_CARDS_KEY = "fin_iq_cards_config_v2";
const STORAGE_KEY = "fin_iq_pro_data_v2";

export default function App() {
  const [selectedPeriod, setSelectedPeriod] = useState("2026-09");

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
    try {
      // First check month-specific storage
      const monthSpecific = localStorage.getItem(`fin_iq_month_2026-09`);
      if (monthSpecific) {
        const parsed = JSON.parse(monthSpecific);
        if (parsed && Array.isArray(parsed.cartoes)) {
          return {
            ...INITIAL_DATA,
            ...parsed,
            cards: loadStoredCards(),
          };
        }
      }

      // Fallback to legacy single storage key
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.receitas) && Array.isArray(parsed.cartoes)) {
          return {
            ...INITIAL_DATA,
            ...parsed,
            cards: loadStoredCards(),
          };
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados do localStorage:", e);
    }
    return { ...INITIAL_DATA, cards: loadStoredCards() };
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
          const finalData: FinancialData = {
            ...remoteData,
            // Ensure cards are preserved and not empty
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

  // Retroactively scan and project all existing installments across all months
  const runGlobalInstallmentProjection = async () => {
    setIsCloudSyncing(true);
    try {
      const allExpensesMap = new Map<string, GastoCartao>();

      // 1. Current active state expenses
      for (const c of data.cartoes || []) {
        allExpensesMap.set(c.id, c);
      }

      // 2. Local storage all months
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
      } catch (e) {}

      // 3. Cloud months if user is signed in
      if (currentUser) {
        try {
          const cloudMonths = await getAllUserMonthsFromCloud(currentUser.uid);
          for (const m of cloudMonths) {
            if (Array.isArray(m?.cartoes)) {
              for (const c of m.cartoes) {
                allExpensesMap.set(c.id, c);
              }
            }
          }
        } catch (e) {}
      }

      const allExpenses = Array.from(allExpensesMap.values());
      const projectedByMonth = projectMissingInstallmentsFromExpenses(allExpenses);

      let totalInjected = 0;

      // Injects into each target month in LocalStorage
      for (const [mYear, items] of Object.entries(projectedByMonth)) {
        try {
          const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
          let mData: FinancialData;
          if (raw) {
            mData = JSON.parse(raw);
            const initialCount = (mData.cartoes || []).length;
            mData.cartoes = mergeProjectedInstallments(mData.cartoes || [], items);
            totalInjected += mData.cartoes.length - initialCount;
          } else {
            mData = {
              monthYear: mYear,
              cards: data.cards,
              receitas: [],
              gastosFixos: data.gastosFixos
                .filter((f) => f.recurring)
                .map((f) => ({
                  ...f,
                  id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                  status: "pendente" as const,
                })),
              cartoes: items,
              investimentos: [],
              imprevistos: [],
              metaRiqueza: data.metaRiqueza,
              investimentoAcumuladoAnterior: data.investimentoAcumuladoAnterior,
            };
            totalInjected += items.length;
          }
          localStorage.setItem(`fin_iq_month_${mYear}`, JSON.stringify(mData));
        } catch (err) {}
      }

      // Injects into currently viewed month state if affected
      const currentMonthProjected = projectedByMonth[selectedPeriod];
      if (currentMonthProjected && currentMonthProjected.length > 0) {
        const mergedCurrent = mergeProjectedInstallments(data.cartoes, currentMonthProjected);
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
      }
    } catch (err) {
      console.error("Erro ao sincronizar parcelas:", err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Run auto-projection once on initial load and when currentUser is authenticated
  useEffect(() => {
    const timer = setTimeout(() => {
      runGlobalInstallmentProjection();
    }, 1200);
    return () => clearTimeout(timer);
  }, [currentUser]);

  // Switching months seamlessly
  const handleSelectPeriod = (newPeriod: string) => {
    if (newPeriod === selectedPeriod) return;

    // 1. Save current month before switching
    try {
      localStorage.setItem(`fin_iq_month_${selectedPeriod}`, JSON.stringify(data));
    } catch (e) {}

    // 2. Set new period
    setSelectedPeriod(newPeriod);

    // 3. Immediately look up local data for newPeriod
    try {
      const rawLocal = localStorage.getItem(`fin_iq_month_${newPeriod}`);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed && Array.isArray(parsed.cartoes)) {
          // If the month has no fixed expenses, inherit recurring expenses from current month
          const fixedExpenses =
            Array.isArray(parsed.gastosFixos) && parsed.gastosFixos.length > 0
              ? parsed.gastosFixos
              : data.gastosFixos
                  .filter((f) => f.recurring)
                  .map((f) => ({
                    ...f,
                    id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                    status: "pendente" as const,
                  }));

          setData({
            ...parsed,
            monthYear: newPeriod,
            cards: data.cards, // Keep cards up to date
            gastosFixos: fixedExpenses,
          });
          return;
        }
      }
    } catch (e) {}

    // 4. If not found locally, create fresh baseline for the new month inheriting recurring fixed expenses
    const baseline: FinancialData = {
      monthYear: newPeriod,
      cards: data.cards,
      receitas: [],
      gastosFixos: data.gastosFixos
        .filter((f) => f.recurring)
        .map((f) => ({
          ...f,
          id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          status: "pendente" as const,
        })),
      cartoes: [],
      investimentos: [],
      imprevistos: [],
      metaRiqueza: data.metaRiqueza,
      investimentoAcumuladoAnterior:
        (data.investimentoAcumuladoAnterior || 0) +
        (data.investimentos || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0),
    };
    setData(baseline);
    try {
      localStorage.setItem(`fin_iq_month_${newPeriod}`, JSON.stringify(baseline));
    } catch (e) {}
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
    }
  ) => {
    const isMultiInstallment = installmentDetails && installmentDetails.totalInstallments > 1;

    if (!isMultiInstallment) {
      // Single purchase (À vista or single month)
      const item: GastoCartao = {
        id: "card_" + Date.now(),
        ...newGasto,
        totalInstallments: 1,
        currentInstallment: 1,
      };
      saveState({ ...data, cartoes: [item, ...data.cartoes] });
      addToast("success", "Compra no cartão lançada", `${item.description} no ${item.card}.`);
      return;
    }

    // Multi-installment purchase: generate installments across future months
    const seriesId = "series_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const generated = generateInstallments({
      description: newGasto.description,
      card: newGasto.card,
      category: newGasto.category,
      startDate: newGasto.date || getTodayISO(0),
      totalInstallments: installmentDetails.totalInstallments,
      startInstallment: installmentDetails.startInstallment || 1,
      installmentAmount: installmentDetails.installmentAmount,
      totalPurchaseAmount: installmentDetails.totalAmount,
      seriesId,
    });

    // Group installments by month
    const byMonth: Record<string, GastoCartao[]> = {};
    for (const gen of generated) {
      if (!byMonth[gen.monthYear]) {
        byMonth[gen.monthYear] = [];
      }
      byMonth[gen.monthYear].push(gen.item);
    }

    // 1. Add current month installment(s) to active state
    const currentMonthItems = byMonth[selectedPeriod] || [];
    let updatedCurrentCartoes = [...data.cartoes];
    if (currentMonthItems.length > 0) {
      updatedCurrentCartoes = [...currentMonthItems, ...updatedCurrentCartoes];
    } else if (generated.length > 0) {
      // If start date is another month, still place the first item in current view
      updatedCurrentCartoes = [generated[0].item, ...updatedCurrentCartoes];
    }
    saveState({ ...data, cartoes: updatedCurrentCartoes });

    // 2. Propagate future installments into each respective month in LocalStorage
    for (const [mYear, items] of Object.entries(byMonth)) {
      if (mYear === selectedPeriod) continue; // Already added to active state above
      try {
        const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
        let mData: FinancialData;
        if (raw) {
          mData = JSON.parse(raw);
          const existing = mData.cartoes || [];
          // Avoid duplicate additions
          const merged = [...items, ...existing.filter((e) => !items.some((i) => i.id === e.id))];
          mData.cartoes = merged;
          mData.cards = data.cards; // ensure cards are up to date
        } else {
          mData = {
            monthYear: mYear,
            cards: data.cards,
            receitas: [],
            gastosFixos: data.gastosFixos
              .filter((f) => f.recurring)
              .map((f) => ({
                ...f,
                id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                status: "pendente" as const,
              })),
            cartoes: items,
            investimentos: [],
            imprevistos: [],
            metaRiqueza: data.metaRiqueza,
            investimentoAcumuladoAnterior: data.investimentoAcumuladoAnterior,
          };
        }
        localStorage.setItem(`fin_iq_month_${mYear}`, JSON.stringify(mData));
      } catch (err) {
        console.error("Erro ao salvar parcela no localStorage para", mYear, err);
      }
    }

    // 3. Propagate into Firestore across future months if cloud is active
    if (currentUser) {
      addInstallmentsToCloud(currentUser.uid, byMonth, data).catch((err) => {
        console.error("Erro ao sincronizar parcelas na nuvem:", err);
      });
    }

    addToast(
      "success",
      `Compra parcelada em ${installmentDetails.totalInstallments}x`,
      `${installmentDetails.totalInstallments} parcelas programadas automaticamente nos meses seguintes!`
    );
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

    if (deleteSeries && (seriesId || targetItem.installments?.includes("/"))) {
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

      addToast("info", "Parcelas Removidas", "Todas as parcelas desta compra foram excluídas dos meses atuais e futuros.");
    } else {
      // Delete only single item
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
      addToast("success", `Cartão ${card.name} atualizado`, `Vencimento ajustado para dia ${card.dueDay}.`);
    } else {
      updatedCards = [...data.cards, card];
      addToast("success", `Cartão ${card.name} cadastrado`, `Vencimento dia ${card.dueDay}, fechamento dia ${card.closingDay}.`);
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
    addToast("success", "Imprevisto atualizado", `${updated.description} alterado.`);
  };

  const handleDeleteImprevisto = (id: string) => {
    saveState({ ...data, imprevistos: data.imprevistos.filter((imp) => imp.id !== id) });
    addToast("info", "Imprevisto removido");
  };

  const handleUpdateMetaRiqueza = (val: number) => {
    saveState({ ...data, metaRiqueza: val });
    addToast("success", "Meta de patrimônio atualizada");
  };

  const handleUpdateInvestimentoAnterior = (val: number) => {
    saveState({ ...data, investimentoAcumuladoAnterior: val });
    addToast("success", "Saldo histórico ajustado");
  };

  // --- Automation: Bulk AI / WhatsApp Confirm with Installments Support ---
  const handleConfirmExtractedTransactions = (items: ExtractedItem[]) => {
    const newReceitas = [...data.receitas];
    const newFixos = [...data.gastosFixos];
    const newCartoes = [...data.cartoes];
    const newInvestimentos = [...data.investimentos];
    const newImprevistos = [...data.imprevistos];

    let count = 0;
    const futureInstallmentsByMonth: Record<string, GastoCartao[]> = {};

    for (const item of items) {
      count++;
      const baseEntry = {
        description: item.description,
        amount: item.amount,
        date: item.date || getTodayISO(0),
      };

      if (item.type === "receita") {
        newReceitas.unshift({
          id: "rec_ai_" + Date.now() + "_" + count,
          ...baseEntry,
          category: item.category || "Receitas",
        });
      } else if (item.type === "gasto_fixo") {
        newFixos.push({
          id: "fix_ai_" + Date.now() + "_" + count,
          ...baseEntry,
          status: "pendente",
          category: item.category || "Moradia",
          recurring: true,
        });
      } else if (item.type === "cartao") {
        // Detect installments from description or category, e.g. "TV em 10x" or "1/10"
        const instInfo = parseInstallmentString(item.description);

        if (instInfo.total > 1 && !instInfo.isRecurring) {
          const seriesId = "series_ai_" + Date.now() + "_" + count;
          const generated = generateInstallments({
            description: item.description,
            card: item.card || "BB",
            category: item.category || "Alimentação",
            startDate: item.date || getTodayISO(0),
            totalInstallments: instInfo.total,
            startInstallment: instInfo.current,
            installmentAmount: item.amount,
            totalPurchaseAmount: item.amount * instInfo.total,
            seriesId,
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
          newCartoes.unshift({
            id: "card_ai_" + Date.now() + "_" + count,
            ...baseEntry,
            card: item.card || "BB",
            installments: instInfo.isRecurring ? "Recorrente" : "À vista",
            category: item.category || "Alimentação",
          });
        }
      } else if (item.type === "investimento") {
        newInvestimentos.unshift({
          id: "inv_ai_" + Date.now() + "_" + count,
          ...baseEntry,
          type: "Ações",
        });
      } else if (item.type === "imprevisto") {
        newImprevistos.unshift({
          id: "imp_ai_" + Date.now() + "_" + count,
          ...baseEntry,
          category: item.category || "Saúde",
        });
      }
    }

    // Save current month
    saveState({
      ...data,
      receitas: newReceitas,
      gastosFixos: newFixos,
      cartoes: newCartoes,
      investimentos: newInvestimentos,
      imprevistos: newImprevistos,
    });

    // Propagate future installments if any were extracted
    const futureMonthKeys = Object.keys(futureInstallmentsByMonth);
    if (futureMonthKeys.length > 0) {
      for (const [mYear, instList] of Object.entries(futureInstallmentsByMonth)) {
        try {
          const raw = localStorage.getItem(`fin_iq_month_${mYear}`);
          let mData: FinancialData;
          if (raw) {
            mData = JSON.parse(raw);
            mData.cartoes = [...instList, ...(mData.cartoes || [])];
          } else {
            mData = {
              monthYear: mYear,
              cards: data.cards,
              receitas: [],
              gastosFixos: data.gastosFixos
                .filter((f) => f.recurring)
                .map((f) => ({
                  ...f,
                  id: "fix_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                  status: "pendente" as const,
                })),
              cartoes: instList,
              investimentos: [],
              imprevistos: [],
              metaRiqueza: data.metaRiqueza,
              investimentoAcumuladoAnterior: data.investimentoAcumuladoAnterior,
            };
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

      {/* Floating WhatsApp AI Extração Modal */}
      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        onConfirmTransactions={handleConfirmExtractedTransactions}
      />

      {/* Floating AI Financial Advisor Modal */}
      <AiAdvisorModal
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        data={data}
        metrics={metrics}
      />

      {/* Cloud Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(session) => {
          setCurrentUser(session);
          addToast("success", "Nuvem Conectada!", `Sincronizando como ${session.email}`);
        }}
      />

      {/* Interactive Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
