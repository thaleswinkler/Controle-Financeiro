import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "warning" | "info" | "error";
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const bgStyles = {
          success: "bg-emerald-950/95 border-emerald-500/50 text-emerald-200",
          warning: "bg-amber-950/95 border-amber-500/50 text-amber-200",
          error: "bg-rose-950/95 border-rose-500/50 text-rose-200",
          info: "bg-slate-900/95 border-slate-700 text-slate-200",
        }[toast.type];

        const Icon = {
          success: CheckCircle2,
          warning: AlertCircle,
          error: AlertCircle,
          info: Info,
        }[toast.type];

        const iconColor = {
          success: "text-emerald-400",
          warning: "text-amber-400",
          error: "text-rose-400",
          info: "text-cyan-400",
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all transform animate-in slide-in-from-bottom-3 duration-200 ${bgStyles}`}
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-xs">
              <span className="font-bold text-white block">{toast.title}</span>
              {toast.description && (
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="opacity-70 hover:opacity-100 transition-opacity p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
