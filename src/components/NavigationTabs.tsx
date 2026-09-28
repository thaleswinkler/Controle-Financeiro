import React from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  CreditCard,
  PiggyBank,
  AlertOctagon,
} from "lucide-react";
import { TabType, FinancialMetrics } from "../types";

interface NavigationTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  metrics: FinancialMetrics;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  metrics,
}) => {
  const tabs: {
    id: TabType;
    label: string;
    icon: React.ReactNode;
    badge?: string | number | null;
    badgeColor?: string;
  }[] = [
    {
      id: "resumo",
      label: "Quadro Resumo",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "receitas",
      label: "Receitas",
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: "gastos-fixos",
      label: "Gastos Fixos",
      icon: <Receipt className="w-4 h-4 text-indigo-400" />,
      badge: metrics.totalFixosPendentes > 0 ? "Pendente" : null,
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    {
      id: "cartoes",
      label: "Cartões de Crédito",
      icon: <CreditCard className="w-4 h-4 text-purple-400" />,
    },
    {
      id: "investimentos",
      label: "Patrimônio & Investimentos",
      icon: <PiggyBank className="w-4 h-4 text-cyan-400" />,
      badge: metrics.savingsRate > 0 ? `${metrics.savingsRate.toFixed(0)}%` : null,
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
    {
      id: "imprevistos",
      label: "Gastos Imprevistos",
      icon: <AlertOctagon className="w-4 h-4 text-rose-400" />,
      badge: metrics.totalImprevistos > 0 ? "Alerta" : null,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  ];

  return (
    <div className="overflow-x-auto pb-1 scrollbar-none">
      <nav className="flex space-x-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 min-w-max">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span className={isActive ? "text-slate-950" : ""}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && !isActive && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                    tab.badgeColor || "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
