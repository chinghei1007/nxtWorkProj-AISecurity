import { AlertCircle, CheckCircle2 } from "lucide-react";

export function InlineAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: string;
}) {
  const success = tone === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={success ? "status" : "alert"}
      className={
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm " +
        (success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800")
      }
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
