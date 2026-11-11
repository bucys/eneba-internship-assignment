import { createContext, useContext } from "react";
import type { FeedbackVariant } from "./feedbackVariants";

export type ToastOptions = {
  message: string;
  variant?: FeedbackVariant;
};

export type ToastApi = {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

// Lives apart from Toast.tsx so that file exports only components (oxlint only-export-components).
export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return api;
}
