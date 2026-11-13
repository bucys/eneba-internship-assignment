import { useEffect, useId, useState, type FormEvent } from "react";
import {
  firstInvalidField,
  formatCardNumber,
  formatExpiry,
  validateCardForm,
  type CardField,
  type CardFieldErrors,
  type CardFormValues,
} from "../../lib/cardInput";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";

type CardPaymentFormProps = {
  onSubmit: (values: CardFormValues) => void;
  /** The payment request is running: fields and Pay are locked. */
  pending: boolean;
  /** The cart is refreshing: Pay is disabled, fields stay editable. */
  disabled?: boolean;
  fieldErrors?: CardFieldErrors;
  formError?: string;
  totalLabel: string;
};

const EMPTY_VALUES: CardFormValues = {
  card_number: "",
  card_expiry: "",
  card_cvc: "",
  card_name: "",
};

export function CardPaymentForm({
  onSubmit,
  pending,
  disabled = false,
  fieldErrors,
  formError,
  totalLabel,
}: CardPaymentFormProps) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [clientErrors, setClientErrors] = useState<CardFieldErrors>({});
  // Unique per form, so two forms on one page (the /ui showcase) never share ids.
  const idPrefix = useId();
  const fieldId = (field: CardField) => `${idPrefix}-${field}`;

  // Client errors win while they exist; a new submit clears them and the server's.
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const shownErrors = hasClientErrors ? clientErrors : (fieldErrors ?? {});

  function focusField(field: CardField | undefined) {
    if (!field) return;
    document.getElementById(fieldId(field))?.focus();
  }

  useEffect(() => {
    const field = fieldErrors && firstInvalidField(fieldErrors);
    if (field) document.getElementById(`${idPrefix}-${field}`)?.focus();
  }, [fieldErrors, idPrefix]);

  function update(field: CardField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;

    const errors = validateCardForm(values);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusField(firstInvalidField(errors));
      return;
    }
    onSubmit(values);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby={`${idPrefix}-heading`}
      className="flex flex-col gap-5"
    >
      <h2 id={`${idPrefix}-heading`} className="text-xl font-extrabold">
        Payment
      </h2>
      <Alert>
        Demo payment, no real money. Use 4242 4242 4242 4242 to pay, 4000 0000
        0000 0002 for a decline, or 4000 0000 0000 9995 for insufficient funds.
      </Alert>

      <fieldset disabled={pending} className="flex flex-col gap-4">
        <legend className="sr-only">Card details</legend>
        <TextField
          id={fieldId("card_number")}
          label="Card number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={values.card_number}
          error={shownErrors.card_number}
          onChange={(event) =>
            update("card_number", formatCardNumber(event.target.value))
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            id={fieldId("card_expiry")}
            label="Expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            maxLength={5}
            value={values.card_expiry}
            error={shownErrors.card_expiry}
            onChange={(event) =>
              update("card_expiry", formatExpiry(event.target.value))
            }
          />
          <TextField
            id={fieldId("card_cvc")}
            label="CVC"
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
            value={values.card_cvc}
            error={shownErrors.card_cvc}
            onChange={(event) =>
              update("card_cvc", event.target.value.replace(/\D/g, ""))
            }
          />
        </div>
        <TextField
          id={fieldId("card_name")}
          label="Name on card"
          autoComplete="cc-name"
          maxLength={100}
          value={values.card_name}
          error={shownErrors.card_name}
          onChange={(event) => update("card_name", event.target.value)}
        />
      </fieldset>

      {formError && <Alert variant="error">{formError}</Alert>}

      <Button
        type="submit"
        size="lg"
        loading={pending}
        disabled={disabled && !pending}
        className="w-full"
      >
        {pending ? "Processing payment…" : `Pay ${totalLabel}`}
      </Button>
    </form>
  );
}
