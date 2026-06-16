import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Renders a node's contents (its `description`) as readable, GitHub-flavored
 * markdown with syntax-highlighted fenced code blocks — at a fixed legible size,
 * independent of the canvas zoom. This is the "file contents / code" face of a
 * node. Heavy (markdown + Prism), so it's imported lazily by callers via
 * React.lazy so it stays out of the main bundle until a node's contents are
 * first viewed.
 *
 * Default export so `React.lazy(() => import('./NodeContentRenderer'))` works.
 */
interface NodeContentRendererProps {
  content: string;
  /** Smaller type + tighter spacing for the on-canvas peek panel. */
  compact?: boolean;
  className?: string;
}

export default function NodeContentRenderer({ content, compact = false, className = '' }: NodeContentRendererProps) {
  const trimmed = (content ?? '').trim();
  if (!trimmed) {
    return <div className="text-sm text-gray-500 italic">No contents yet.</div>;
  }

  const prose = compact
    ? 'text-xs leading-relaxed'
    : 'text-sm leading-relaxed';

  return (
    <div
      data-testid="node-content-rendered"
      className={`node-content text-gray-200 ${prose} ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings — readable hierarchy without a full prose framework.
          h1: ({ children }) => <h1 className={`font-bold text-gray-100 ${compact ? 'text-sm' : 'text-lg'} mt-3 mb-1.5 first:mt-0`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`font-bold text-gray-100 ${compact ? 'text-sm' : 'text-base'} mt-3 mb-1.5 first:mt-0`}>{children}</h2>,
          h3: ({ children }) => <h3 className={`font-semibold text-gray-100 ${compact ? 'text-xs' : 'text-sm'} mt-2 mb-1 first:mt-0`}>{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-5 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-600 pl-3 text-gray-400 italic my-2">{children}</blockquote>,
          table: ({ children }) => <table className="border-collapse my-2 text-xs">{children}</table>,
          th: ({ children }) => <th className="border border-gray-700 px-2 py-1 bg-gray-800 text-left">{children}</th>,
          td: ({ children }) => <td className="border border-gray-700 px-2 py-1">{children}</td>,
          code(props) {
            const { children, className: cn, ...rest } = props as any;
            const match = /language-(\w+)/.exec(cn || '');
            const isInline = !(cn || '').includes('language-') && !String(children).includes('\n');
            if (isInline) {
              return (
                <code className="bg-gray-800 text-emerald-300 rounded px-1 py-0.5 text-[0.85em]" {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <SyntaxHighlighter
                language={match ? match[1] : 'text'}
                style={oneDark}
                customStyle={{
                  margin: '0.5rem 0',
                  borderRadius: '0.5rem',
                  fontSize: compact ? '0.7rem' : '0.8rem',
                  background: '#1e1e2e',
                }}
                PreTag="div"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },
        }}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
