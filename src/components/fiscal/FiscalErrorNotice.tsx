import { explainFiscalError } from "@/lib/fiscalErrorGuide";

export function FiscalErrorNotice({ message, variant = "error" }: { message: string; variant?: "error" | "warning" }) {
  if (!message.trim()) return null;
  const explained = explainFiscalError(message);
  const box = variant === "warning"
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : "border-rose-200 bg-rose-50 text-rose-950";
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${box}`} role="alert">
      <p className="font-semibold">{explained.title}</p>
      <p className="mt-1">{explained.reason}</p>
      {explained.fix ? <p className="mt-2"><span className="font-semibold">Como corrigir: </span>{explained.fix}</p> : null}
      {!explained.fix && explained.unmapped ? <p className="mt-2">Este texto veio da Webmania. O Flow não tem um passo de correção cadastrado para ele.</p> : null}
    </div>
  );
}
