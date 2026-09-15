import React, { useState } from "react";
import { X, Mail, Lock, Cloud, AlertCircle, LogIn, Sparkles } from "lucide-react";
import { loginWithGoogle, authenticateWithCredentials, CloudUserSession } from "../lib/firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: CloudUserSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const session = await loginWithGoogle();
      if (session) {
        onSuccess(session);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/popup-closed-by-user") {
        setErrorMsg("Janela do Google fechada antes de concluir.");
      } else if (err?.code === "auth/unauthorized-domain") {
        setErrorMsg("O domínio do Render precisa ser adicionado no Google Console. Use seu E-mail e Senha abaixo!");
      } else {
        setErrorMsg("Para conectar no Render sem depender de popup, use seu E-mail e Senha abaixo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setErrorMsg("Preencha seu e-mail e uma senha de acesso.");
      return;
    }
    if (cleanPass.length < 4) {
      setErrorMsg("A senha deve ter pelo menos 4 dígitos/letras.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const session = await authenticateWithCredentials(cleanEmail, cleanPass);
      onSuccess(session);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao conectar à nuvem. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <Cloud className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Sincronizar FinIq na Nuvem
            </h2>
            <p className="text-xs text-slate-400">
              Acesse seus dados em tempo real no PC, tablet e celular
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* E-mail / Password Form (Primary & Direct) */}
          <form onSubmit={handleCredentialsAuth} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Seu E-mail ou Usuário
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: thales_winkler@hotmail.com"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Senha / PIN de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Digite a mesma senha em qualquer dispositivo para acessar seus dados.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Conectando à nuvem...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Conectar e Sincronizar</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex-1 h-px bg-slate-800" />
            <span>ou</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Google Login Option */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9c0-.8 0-1.6 0-4z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 17C3.7 20.7 7.5 23.3 12 24z"
              />
            </svg>
            <span>Conectar com Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};
