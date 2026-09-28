import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  Calendar,
  MessageSquareText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  CopyPlus,
  Cloud,
  LogOut,
  LogIn,
  CheckCircle2,
} from "lucide-react";
import { FinancialData } from "../types";
import { exportToCSV } from "../utils/formatters";
import { getDefaultReferenceMonth } from "../utils/installments";
import type { CloudUserSession } from "../lib/firebase";

interface HeaderProps {
  data: FinancialData;
  currentUser: CloudUserSession | null;
  isCloudSyncing: boolean;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onOpenWhatsAppModal: () => void;
  onOpenAdvisorModal: () => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetData: () => void;
  onReplicateFixedExpenses: () => void;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  currentUser,
  isCloudSyncing,
  onOpenAuthModal,
  onLogout,
  onOpenWhatsAppModal,
  onOpenAdvisorModal,
  onExportJSON,
  onImportJSON,
  onResetData,
  onReplicateFixedExpenses,
  selectedPeriod,
  onSelectPeriod,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const years = [2026, 2027, 2028];
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const handlePrevMonth = () => {
    const [y, m] = selectedPeriod.split("-").map(Number);
    let prevYear = y;
    let prevMonth = m - 1;
    if (prevMonth < 1) {
      prevYear--;
      prevMonth = 12;
    }
    const nextVal = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    onSelectPeriod(nextVal);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedPeriod.split("-").map(Number);
    let nextYear = y;
    let nextMonth = m + 1;
    if (nextMonth > 12) {
      nextYear++;
      nextMonth = 1;
    }
    const nextVal = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    onSelectPeriod(nextVal);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black">
              <BrainCircuit className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  FinIq
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  AI Pro 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle Financeiro Inteligente & Automações
              </p>
            </div>
          </div>

          {/* Period Selector (Mobile & Desktop) */}
          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/80 rounded-xl px-1.5 py-1 text-xs text-slate-200 shadow-sm">
            <button
              onClick={handlePrevMonth}
              title="Mês anterior"
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                value={selectedPeriod}
                onChange={(e) => onSelectPeriod(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                {years.map((year) => (
                  <optgroup key={year} label={`Ano ${year}`} className="bg-slate-950 font-bold text-emerald-400">
                    {monthNames.map((name, idx) => {
                      const val = `${year}-${String(idx + 1).padStart(2, "0")}`;
                      const isRefMonth = val === getDefaultReferenceMonth();
                      return (
                        <option key={val} value={val} className="bg-slate-900 text-white font-normal">
                          {name} {year} {isRefMonth ? "★ (Mês Referência)" : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
            <button
              onClick={handleNextMonth}
              title="Próximo mês"
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
          {/* Cloud Sync / Auth Status */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-xs text-slate-200">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isCloudSyncing ? "bg-amber-400" : "bg-emerald-400"} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isCloudSyncing ? "bg-amber-500" : "bg-emerald-500"}`}></span>
              </span>
              <span className="text-[11px] text-emerald-400 font-medium truncate max-w-[110px] sm:max-w-[140px]" title={currentUser.email || "Conectado"}>
                {currentUser.displayName || currentUser.email?.split("@")[0] || "Nuvem Ativa"}
              </span>
              <button
                onClick={onLogout}
                className="ml-1 p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/50 transition-colors"
                title="Desconectar conta"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              id="btn-cloud-login"
              onClick={onOpenAuthModal}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Entrar para sincronizar seus dados em todos os aparelhos"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sincronizar Nuvem</span>
              <span className="sm:hidden">Entrar</span>
            </button>
          )}

          {/* AI Advisor Button */}
          <button
            id="btn-ai-advisor"
            onClick={onOpenAdvisorModal}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-2 shadow-sm hover:border-emerald-500/40 active:scale-95"
            title="Diagnóstico Financeiro com Inteligência Artificial"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden sm:inline">Diagnóstico IA</span>
          </button>

          {/* WhatsApp AI Extraction Button */}
          <button
            id="btn-whatsapp-extract"
            onClick={onOpenWhatsAppModal}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <MessageSquareText className="w-4 h-4" />
            <span>Extração WhatsApp (AI)</span>
          </button>

          {/* Data & Backup Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="btn-data-menu"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-slate-300 hover:text-white text-xs transition-all flex items-center gap-1"
              title="Gerenciar Dados e Exportações"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    onExportJSON();
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Backup (JSON)</span>
                </button>

                <button
                  onClick={() => {
                    exportToCSV(data);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>Exportar Planilha (CSV)</span>
                </button>

                <label className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Importar Backup (JSON)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      onImportJSON(e);
                      setDropdownOpen(false);
                    }}
                    className="hidden"
                  />
                </label>

                <hr className="border-slate-800 my-1" />

                <button
                  onClick={() => {
                    onReplicateFixedExpenses();
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center gap-2.5 text-indigo-300 hover:text-indigo-200 transition-colors"
                >
                  <CopyPlus className="w-4 h-4 text-indigo-400" />
                  <span>Replicar Fixos para Próx. Mês</span>
                </button>

                <hr className="border-slate-800 my-1" />

                <button
                  onClick={() => {
                    onResetData();
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-rose-500/10 flex items-center gap-2.5 text-rose-400 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>Resetar Dados de Exemplo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
