import { useState, type KeyboardEvent } from "react";
import { MAX_PRICE_EUROS, parsePrice } from "../../lib/storeParams";
import { TextField } from "../ui/TextField";

export const PRICE_FORMAT_ERROR = `Enter a whole number from 0 to ${MAX_PRICE_EUROS}`;
export const PRICE_ORDER_ERROR = "Min must not exceed max";

type PriceRangeFieldsProps = {
  min: number | null;
  max: number | null;
  onApply: (min: number | null, max: number | null) => void;
};

type FieldErrors = { min?: string; max?: string };

const toDraft = (value: number | null) => (value === null ? "" : String(value));

/** Two fields that apply on blur or Enter; an empty field removes that bound (spec 0012 AC-6). */
export function PriceRangeFields({ min, max, onApply }: PriceRangeFieldsProps) {
  const [minDraft, setMinDraft] = useState(toDraft(min));
  const [maxDraft, setMaxDraft] = useState(toDraft(max));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [syncedFrom, setSyncedFrom] = useState({ min, max });

  // Back, forward, a chip, or Clear all changed the URL: the drafts follow it.
  if (syncedFrom.min !== min || syncedFrom.max !== max) {
    setSyncedFrom({ min, max });
    setMinDraft(toDraft(min));
    setMaxDraft(toDraft(max));
    setErrors({});
  }

  function commit() {
    const minText = minDraft.trim();
    const maxText = maxDraft.trim();
    const nextMin = minText === "" ? null : parsePrice(minText);
    const nextMax = maxText === "" ? null : parsePrice(maxText);
    const nextErrors: FieldErrors = {};

    if (minText !== "" && nextMin === null) nextErrors.min = PRICE_FORMAT_ERROR;
    if (maxText !== "" && nextMax === null) nextErrors.max = PRICE_FORMAT_ERROR;
    if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
      nextErrors.min = PRICE_ORDER_ERROR;
    }

    setErrors(nextErrors);
    if (nextErrors.min || nextErrors.max) return;
    onApply(nextMin, nextMax);
  }

  function commitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField
        label="Min"
        inputMode="numeric"
        autoComplete="off"
        value={minDraft}
        error={errors.min}
        onChange={(event) => setMinDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={commitOnEnter}
      />
      <TextField
        label="Max"
        inputMode="numeric"
        autoComplete="off"
        value={maxDraft}
        error={errors.max}
        onChange={(event) => setMaxDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={commitOnEnter}
      />
    </div>
  );
}
