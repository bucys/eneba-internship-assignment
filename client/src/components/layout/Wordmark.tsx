import { Link } from "react-router";

export function Wordmark() {
  return (
    <Link
      to="/"
      aria-label="Eneba marketplace home"
      className="inline-flex min-h-11 items-center rounded-sm text-2xl font-extrabold tracking-tight lowercase"
    >
      eneba
    </Link>
  );
}
