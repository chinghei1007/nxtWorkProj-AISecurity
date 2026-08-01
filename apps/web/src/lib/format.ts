export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function severityTone(severity: string) {
  const tones: Record<string, string> = {
    critical: "border-red-200 bg-red-50 text-red-700",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-blue-200 bg-blue-50 text-blue-700",
    info: "border-slate-200 bg-slate-100 text-slate-600",
  };
  return tones[severity] ?? tones.info;
}
