import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { cx } from "../../lib/cx";
import { feedbackVariants, type FeedbackVariant } from "./feedbackVariants";
import {
  ToastContext,
  type ToastAction,
  type ToastApi,
  type ToastOptions,
} from "./toastContext";

const TOAST_DURATION_MS = 4000;
const MAX_TOASTS = 3;

type ToastEntry = {
  id: number;
  message: string;
  variant: FeedbackVariant;
  action?: ToastAction;
};

type ToastItemProps = {
  toast: ToastEntry;
  onDismiss: (id: number) => void;
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { Icon, accent, border } = feedbackVariants[toast.variant];
  const [paused, setPaused] = useState(false);
  const remainingMs = useRef(TOAST_DURATION_MS);
  const staysOpen = toast.variant === "error";

  useEffect(() => {
    if (staysOpen || paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remainingMs.current);
    return () => {
      clearTimeout(timer);
      remainingMs.current -= Date.now() - startedAt;
    };
  }, [staysOpen, paused, toast.id, onDismiss]);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={handleBlur}
      className={cx(
        "pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-sm border bg-surface py-2 pr-2 pl-4 text-sm text-fg shadow-lg",
        border,
      )}
    >
      <Icon aria-hidden="true" className={cx("size-5 shrink-0", accent)} />
      <p className="flex-1">{toast.message}</p>
      {toast.action && (
        <Link
          to={toast.action.to}
          onClick={() => onDismiss(toast.id)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-1 font-extrabold text-fg underline underline-offset-2 transition-colors hover:text-cta"
        >
          {toast.action.label}
        </Link>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg-soft transition-colors hover:bg-surface-deep hover:text-fg"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ message, variant = "info", action }: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) =>
        [...current, { id, message, variant, action }].slice(-MAX_TOASTS),
      );
      return id;
    },
    [],
  );

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-20 flex flex-col items-center gap-2 md:right-6 md:bottom-6 md:left-auto md:items-end"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}
