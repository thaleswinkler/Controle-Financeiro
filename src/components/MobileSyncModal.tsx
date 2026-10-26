import React, { useState } from "react";
import {
  X,
  Smartphone,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Share2,
  ExternalLink,
  Laptop,
  ArrowRight,
  Info,
} from "lucide-react";
import type { CloudUserSession } from "../lib/firebase";

interface MobileSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CloudUserSession | null;
  onOpenAuthModal: () => void;
}

export const MobileSyncModal: React.FC<MobileSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAuthModal,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build the synchronization URL with session credentials so phone auto-connects
  const baseUrl = window.location.origin + window.location.pathname;
  const syncParams = currentUser
    ? `?sync_uid=${encodeURIComponent(currentUser.uid)}&sync_email=${encodeURIComponent(
        currentUser.email || ""
      )}&sync_name=${encodeURIComponent(currentUser.displayName || "")}`
    : "";
  const fullSyncUrl = baseUrl + syncParams;

  // Safe QR Code generation using qrserver public API with fallback
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
    fullSyncUrl
  )}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullSyncUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `FinIq - Acessar meu Controle Financeiro no Celular:\n${fullSyncUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Smartphone className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Conectar FinIq no Celular
            </h2>
            <p className="text-xs text-slate-400">
              Acesse suas receitas, faturas e contas no celular em tempo real
            </p>
          </div>
        </div>

        {currentUser ? (
          <div className="space-y-5">
            {/* Connected status badge */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-emerald-300">
                    Sincronização em Nuvem Ativa
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Conectado como <strong className="text-white">{currentUser.email || currentUser.displayName}</strong>
                  </p>
                </div>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>

            {/* QR Code Card */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 flex flex-col items-center text-center">
              <p className="text-xs font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Aponte a câmera do seu celular para escanear:</span>
              </p>

              <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-slate-800/80">
                <img
                  src={qrCodeImageUrl}
                  alt="QR Code para sincronização móvel"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg"
                />
              </div>

              <p className="text-[11px] text-slate-400 mt-3 max-w-xs">
                Ao abrir o link no celular, seus lançamentos do computador serão carregados automaticamente!
              </p>
            </div>

            {/* Action buttons to copy or send to WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleCopyLink}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copiar Link de Acesso</span>
                  </>
                )}
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-slate-950" />
                <span>Enviar pelo WhatsApp</span>
              </button>
            </div>

            {/* How it works info */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Como manter o celular e o PC sempre iguais:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Qualquer receita, gasto fixo ou compra no cartão lançada em um aparelho atualiza o outro em tempo real.</li>
                <li>Se abrir no celular sem usar o QR Code, basta clicar em "Entrar" no topo e colocar o mesmo e-mail e senha.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white mb-1">
                  Ative a sincronização em nuvem primeiro
                </p>
                <p className="text-slate-300">
                  Para que o seu celular acesse exatamente os lançamentos deste computador, você só precisa definir seu e-mail ou conectar via Google. É rápido, seguro e gratuito!
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Laptop className="w-8 h-8 text-emerald-400 shrink-0" />
                <ArrowRight className="w-5 h-5 text-slate-600 shrink-0" />
                <Smartphone className="w-8 h-8 text-cyan-400 shrink-0" />
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuthModal();
                }}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                Conectar Agora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
