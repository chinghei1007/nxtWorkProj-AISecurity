const LANGUAGE_MARKERS: Array<[string, RegExp[]]> = [
  ["TypeScript", [/\b(interface|type|enum)\s+\w+/, /:\s*(string|number|boolean|unknown)\b/, /\bimport\s+type\b/]],
  ["JavaScript", [/\b(const|let|var)\s+\w+\s*=/, /=>/, /\b(function|async|await)\b/, /console\.\w+\(/]],
  ["Python", [/^\s*(def|class)\s+\w+/m, /^\s*(from\s+\S+\s+import|import\s+\S+)/m, /:\s*\n\s{2,}\S/]],
  ["JSON", [/^\s*[\[{][\s\S]*[\]}]\s*$/, /"[^"\n]+"\s*:/]],
  ["CSS", [/[.#]?[a-z][\w-]*\s*\{[\s\S]*[\w-]+\s*:[^{}]+;?[\s\S]*\}/i, /@(media|keyframes|import|layer)\b/]],
  ["Shell", [/^#!.*\b(bash|sh|zsh)\b/m, /\b(if|then|fi|for|do|done)\b/, /\$\{?[A-Z_][A-Z0-9_]*\}?/]],
  ["SQL", [/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b[\s\S]+\b(FROM|INTO|TABLE|SET)\b/i]],
  ["HTML", [/<[a-z][^>]*>[\s\S]*<\/[^>]+>/i, /<!doctype\s+html>/i]],
];

const GENERIC_SIGNALS = [
  /[{}()[\];]/,
  /(^|\n)\s{2,}\S/,
  /\b(return|throw|try|catch|new|extends|implements)\b/,
  /[=!<>]=|&&|\|\||\+\+|--/,
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*/,
  /\w+\s*\([^)]*\)\s*[{:=]/,
  /\w+(\.\w+)+\s*\(/,
];

export function detectLanguage(source: string): string {
  let best = { language: "Unknown", score: 0 };
  for (const [language, markers] of LANGUAGE_MARKERS) {
    const score = markers.reduce((total, pattern) => total + Number(pattern.test(source)), 0);
    if (score > best.score) best = { language, score };
  }
  return best.language;
}

export function looksLikeCode(source: string): boolean {
  if (source.length > 50_000) return false;
  const value = source.trim();
  if (value.length < 8) return false;

  const languageScore = LANGUAGE_MARKERS.reduce(
    (total, [, markers]) => total + Number(markers.some((pattern) => pattern.test(value))),
    0,
  );
  const genericScore = GENERIC_SIGNALS.reduce(
    (total, pattern) => total + Number(pattern.test(value)),
    0,
  );

  if (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(value)) {
    try {
      JSON.parse(value);
      return true;
    } catch {
      // Malformed object-like source can still be code and is scored below.
    }
  }

  return (languageScore >= 1 && genericScore >= 1) || genericScore >= 3;
}
