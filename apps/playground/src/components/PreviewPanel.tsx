import { useRef, useEffect } from 'react';

type Props = {
  html: string | null;
  theme: 'light' | 'dark';
  loading: boolean;
};

/**
 * CSS injected into the preview iframe to highlight low-confidence slots.
 * Uses the data-oods-confidence attribute emitted by the render pipeline (S84).
 */
const CONFIDENCE_CSS = `
<style data-source="playground-confidence">
  [data-oods-confidence] {
    position: relative;
  }
  [data-oods-confidence].oods-low-confidence {
    outline: 2px dashed rgba(234, 179, 8, 0.6);
    outline-offset: 2px;
  }
  [data-oods-confidence].oods-low-confidence::after {
    content: attr(data-oods-confidence);
    position: absolute;
    top: -1.4em;
    right: 0;
    font-size: 10px;
    font-family: monospace;
    background: rgba(234, 179, 8, 0.9);
    color: #000;
    padding: 1px 5px;
    border-radius: 3px;
    pointer-events: none;
    z-index: 1000;
  }
</style>
`;

function applyTheme(doc: Document, theme: string) {
  const html = doc.documentElement;
  const body = doc.body;
  if (html) html.setAttribute('data-theme', theme);
  if (body) body.setAttribute('data-theme', theme);
}

function injectConfidenceOverlay(doc: Document) {
  // Inject confidence CSS into head
  const head = doc.head;
  if (head && !doc.querySelector('[data-source="playground-confidence"]')) {
    head.insertAdjacentHTML('beforeend', CONFIDENCE_CSS);
  }

  // Mark low-confidence elements
  const elements = doc.querySelectorAll('[data-oods-confidence]');
  elements.forEach((el) => {
    const conf = parseFloat(el.getAttribute('data-oods-confidence') ?? '1');
    if (conf < 0.5) {
      el.classList.add('oods-low-confidence');
    }
  });
}

export function PreviewPanel({ html, theme, loading }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write HTML into iframe
  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    // Apply theme and confidence overlays after write
    applyTheme(doc, theme);
    injectConfidenceOverlay(doc);
  }, [html, theme]);

  // Update theme attribute when theme changes without re-rendering HTML
  useEffect(() => {
    if (!iframeRef.current?.contentDocument || !html) return;
    applyTheme(iframeRef.current.contentDocument, theme);
  }, [theme, html]);

  return (
    <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Preview</span>
        <span className="text-xs text-gray-600">{theme}</span>
      </div>
      <div className="flex-1 relative">
        {!html && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
            Type an intent to see a live preview
          </div>
        )}
        {loading && !html && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}
        {loading && html && (
          <div className="absolute top-2 right-2 z-10">
            <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="OODS Preview"
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
          style={{ display: html ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
}
