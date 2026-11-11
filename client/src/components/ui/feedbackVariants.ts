import { CircleCheck, CircleExclamationPoint, Info } from "lucide-react";

export type FeedbackVariant = "info" | "success" | "error";

// Shared by Alert and Toast so both use the same icon and accent per variant.
export const feedbackVariants = {
  info: { Icon: Info, accent: "text-link", border: "border-link" },
  success: {
    Icon: CircleCheck,
    accent: "text-success",
    border: "border-success",
  },
  error: {
    Icon: CircleExclamationPoint,
    accent: "text-danger",
    border: "border-danger",
  },
} as const;
