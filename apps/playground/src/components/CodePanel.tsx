import { useMemo } from 'react';
import { useCopyToClipboard } from '../hooks';

type Props = {
  code: string | null;
  framework: string;
  loading: boolean;
};

/** Lightweight keyword-level syntax highlighting (no external dep). */
function highlightCode(code: string, framework: string): string {
  if (framework === 'html') {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>')
      .replace(/([\w-]+)(=)/g, '<span class="hl-attr">$1</span>$2')
      .replace(/(".*?")/g, '<span class="hl-str">$1</span>');
  }

  // React / Vue highlighting
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(\/\/.*)/gm, '<span class="hl-comment">$1</span>')
    .replace(/\b(import|export|from|const|let|function|return|type|interface|default|async|await)\b/g,
      '<span class="hl-kw">$1</span>')
    .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="hl-str">$1</span>')
    .replace(/(&lt;\/?)([A-Z]\w*)/g, '$1<span class="hl-comp">$2</span>');
}

export function CodePanel({ code, framework, loading }: Props) {
  const [copied, copy] = useCopyToClipboard();

  const ext = framework === 'react' ? '.tsx' : framework === 'vue' ? '.vue' : '.html';
  const highlighted = useMemo(
    () => (code ? highlightCode(code, framework) : null),
    [code, framework],
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Code <span className="text-gray-600 ml-1">{ext}</span>
        </span>
        {code && (
          <button
            onClick={() => copy(code)}
            className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {!code && !loading && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Generated code will appear here
          </div>
        )}
        {loading && !code && (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}
        {highlighted && (
          <pre
            className="p-4 text-xs leading-relaxed text-gray-300 font-mono whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        )}
      </div>
    </div>
  );
}
