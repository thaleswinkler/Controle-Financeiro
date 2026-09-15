import React, { useState, useEffect, useMemo } from "react";
import { FinancialData, FinancialMetrics, TabType, ExtractedItem, Receita, GastoFixo, GastoCartao, Investimento, GastoImprevisto } from "./types";
import { INITIAL_DATA } from "./data/mockData";
import { calculateMetrics, getTodayISO } from "./utils/formatters";
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
  getStoredCloudSession,
  logoutUser,
  CloudUserSession,
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const STORAGE_KEY = "fin_iq_pro_data_v2";

export default function App() {
  const [data, setData] = useState<FinancialData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.receitas) && Array.isArray(parsed.cartoes)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados do localStorage:", e);
    }
    return INITIAL_DATA;
  });

  const [currentUser, setCurrentUser] = useState<CloudUserSession | null>(() =>
    getStoredCloudSession()
  );
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("resumo");
  const [selectedPeriod, setSelectedPeriod] = useState("2026-09");
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
          setData(remoteData);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
          } catch {}
        } else {
          // If month doesn't exist on cloud yet, upload current state to seed it
          saveMonthDataToCloud(currentUser.uid, selectedPeriod, data).catch((err) => {
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

  // --- Handlers for Modules ---

  const handleAddReceita = (newRec: Omit<Receita, "id">) => {
    const item: Receita = { id: "rec_" + Date.now(), ...newRec };
    saveState({ ...data, receitas: [item, ...data.receitas] });
    addToast("success", "Receita adicionada", `${item.description} cadastrada com sucesso.`);
  };

  const handleDeleteReceita = (id: string) => {
    saveState({ ...data, receitas: data.receitas.filter((r) => r.id !== id) });
    addToast("info", "Receita removida");
  };

  const handleAddGastoFixo = (newFixo: Omit<GastoFixo, "id">) => {
    const item: GastoFixo = { id: "fix_" + Date.now(), ...newFixo };
    saveState({ ...data, gastosFixos: [...data.gastosFixos, item] });
    addToast("success", "Gasto fixo cadastrado", `${item.description} adicionado.`);
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
    // Duplicates all recurring fixed expenses with 'pendente' status
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

  const handleAddGastoCartao = (newGasto: Omit<GastoCartao, "id">) => {
    const item: GastoCartao = { id: "card_" + Date.now(), ...newGasto };
    saveState({ ...data, cartoes: [item, ...data.cartoes] });
    addToast("success", "Compra no cartão lançada", `${item.description} no ${item.card}.`);
  };

  const handleDeleteGastoCartao = (id: string) => {
    saveState({ ...data, cartoes: data.cartoes.filter((c) => c.id !== id) });
    addToast("info", "Lançamento de cartão removido");
  };

  const handleAddInvestimento = (newInv: Omit<Investimento, "id">) => {
    const item: Investimento = { id: "inv_" + Date.now(), ...newInv };
    saveState({ ...data, investimentos: [item, ...data.investimentos] });
    addToast("success", "Aporte registrado!", `${item.description} adicionado ao patrimônio.`);
  };

  const handleDeleteInvestimento = (id: string) => {
    saveState({ ...data, investimentos: data.investimentos.filter((i) => i.id !== id) });
    addToast("info", "Aporte removido");
  };

  const handleAddImprevisto = (newImp: Omit<GastoImprevisto, "id">) => {
    const item: GastoImprevisto = { id: "imp_" + Date.now(), ...newImp };
    saveState({ ...data, imprevistos: [item, ...data.imprevistos] });
    addToast("warning", "Imprevisto registrado", `${item.description} computado.`);
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

  // --- Automation: Bulk AI / WhatsApp Confirm ---
  const handleConfirmExtractedTransactions = (items: ExtractedItem[]) => {
    const newReceitas = [...data.receitas];
    const newFixos = [...data.gastosFixos];
    const newCartoes = [...data.cartoes];
    const newInvestimentos = [...data.investimentos];
    const newImprevistos = [...data.imprevistos];

    let count = 0;

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
        newCartoes.unshift({
          id: "card_ai_" + Date.now() + "_" + count,
          ...baseEntry,
          card: item.card || "BB",
          installments: "À vista",
          category: item.category || "Alimentação",
        });
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

    saveState({
      ...data,
      receitas: newReceitas,
      gastosFixos: newFixos,
      cartoes: newCartoes,
      investimentos: newInvestimentos,
      imprevistos: newImprevistos,
    });

    addToast(
      "success",
      "Extração Concluída com Sucesso!",
      `${count} lançamentos foram distribuídos e categorizados automaticamente pelo FinIq.`
    );
  };

  // --- Export & Import JSON ---
  const handleExportJSON = () => {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
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
        onSelectPeriod={setSelectedPeriod}
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
            onDeleteReceita={handleDeleteReceita}
          />
        )}

        {activeTab === "gastos-fixos" && (
          <GastosFixosView
            gastosFixos={data.gastosFixos}
            onAddGastoFixo={handleAddGastoFixo}
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
            onDeleteGastoCartao={handleDeleteGastoCartao}
          />
        )}

        {activeTab === "investimentos" && (
          <InvestimentosView
            investimentos={data.investimentos}
            totalReceita={metrics.totalReceita}
            onAddInvestimento={handleAddInvestimento}
            onDeleteInvestimento={handleDeleteInvestimento}
          />
        )}

        {activeTab === "imprevistos" && (
          <ImprevistosView
            imprevistos={data.imprevistos}
            totalReceita={metrics.totalReceita}
            onAddImprevisto={handleAddImprevisto}
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
