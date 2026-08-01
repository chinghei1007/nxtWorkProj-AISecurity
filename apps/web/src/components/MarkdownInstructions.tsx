import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function safeUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return trimmed;
  try {
    const protocol = new URL(trimmed).protocol;
    return ["http:", "https:", "mailto:"].includes(protocol) ? trimmed : "";
  } catch {
    return "";
  }
}

export function MarkdownInstructions({ children }: { children: string }) {
  return (
    <div className="text-sm leading-6 text-slate-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeUrl}
        components={{
          h1: ({ children: value }) => <h4 className="mb-2 mt-4 text-base font-bold text-slate-950">{value}</h4>,
          h2: ({ children: value }) => <h4 className="mb-2 mt-4 text-base font-bold text-slate-950">{value}</h4>,
          h3: ({ children: value }) => <h5 className="mb-2 mt-3 font-bold text-slate-900">{value}</h5>,
          p: ({ children: value }) => <p className="my-2">{value}</p>,
          ul: ({ children: value }) => <ul className="my-2 list-disc space-y-1 pl-5">{value}</ul>,
          ol: ({ children: value }) => <ol className="my-2 list-decimal space-y-1 pl-5">{value}</ol>,
          li: ({ children: value }) => <li>{value}</li>,
          a: ({ children: value, href }) => href ? (
            <a className="font-semibold text-blue-700 underline underline-offset-2" href={href} rel="noreferrer" target="_blank">{value}</a>
          ) : <span>{value}</span>,
          blockquote: ({ children: value }) => <blockquote className="my-3 border-l-2 border-slate-300 pl-3 text-slate-600">{value}</blockquote>,
          pre: ({ children: value }) => <pre className="my-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">{value}</pre>,
          code: ({ children: value, className }) => className ? (
            <code className={className}>{value}</code>
          ) : (
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-900">{value}</code>
          ),
          img: () => null,
          table: ({ children: value }) => <div className="my-3 overflow-x-auto"><table className="min-w-full border-collapse text-left">{value}</table></div>,
          th: ({ children: value }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 font-semibold">{value}</th>,
          td: ({ children: value }) => <td className="border border-slate-200 px-2 py-1">{value}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
