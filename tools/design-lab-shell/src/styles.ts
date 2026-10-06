const STYLE_ID = 'design-lab-shell-styles';

const STYLE_PAYLOAD = `
:root {
  --shell-bg: #0b1224;
  --panel-bg: #0f172a;
  --panel-border: #1e293b;
  --panel-glow: rgba(125, 211, 252, 0.08);
  --accent: #7dd3fc;
  --accent-strong: #22d3ee;
  --text-primary: #e2e8f0;
  --text-muted: #94a3b8;
  --danger: #fb7185;
  --warning: #fbbf24;
  --success: #34d399;
  font-family: "Space Grotesk", "Inter", system-ui, -apple-system, sans-serif;
}

.design-lab-shell {
  display: grid;
  grid-template-columns: 320px 1fr 1fr;
  gap: 16px;
  padding: 16px;
  background: radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.05), transparent 35%),
    radial-gradient(circle at 80% 0%, rgba(125, 211, 252, 0.05), transparent 30%),
    var(--shell-bg);
  color: var(--text-primary);
  min-height: 420px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.35);
}

@media (max-width: 1100px) {
  .design-lab-shell {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(220px, auto);
  }
}

.design-pane {
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(9, 14, 26, 0.95));
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  min-height: 260px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--panel-glow);
}

.design-pane__title {
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.design-pane__hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.design-pane__body {
  margin-top: 10px;
  flex: 1;
  overflow: auto;
}

.design-pane__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.design-pane__card {
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
}

.design-chat__item {
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 8px;
  font-size: 13px;
}

.design-chat__role {
  text-transform: uppercase;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.06em;
}

.design-chat__text {
  color: var(--text-primary);
}

.design-chat__item[data-status="ok"] {
  border-color: rgba(52, 211, 153, 0.4);
}

.design-chat__item[data-status="error"] {
  border-color: rgba(251, 113, 133, 0.6);
}

.design-chat__item[data-status="pending"] {
  border-color: rgba(125, 211, 252, 0.35);
}

.design-chat__meta {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 4px;
}

.design-chat__composer {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.design-chat__composer input {
  flex: 1;
  border: 1px solid var(--panel-border);
  background: #0a0f1f;
  color: #e5e7eb;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
}

.design-chat__composer button {
  border: 1px solid var(--panel-border);
  background: linear-gradient(135deg, rgba(125, 211, 252, 0.18), rgba(34, 211, 238, 0.18));
  color: var(--text-primary);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
}

.design-chat__composer button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.design-json {
  background: #0a0f1f;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 12px;
  color: #e5e7eb;
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.design-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(125, 211, 252, 0.12);
  color: var(--accent-strong);
}

.design-status[data-variant="error"] {
  background: rgba(251, 113, 133, 0.16);
  color: var(--danger);
}

.design-status[data-variant="warning"] {
  background: rgba(251, 191, 36, 0.16);
  color: var(--warning);
}

.design-status[data-variant="ready"] {
  background: rgba(52, 211, 153, 0.16);
  color: var(--success);
}

.design-preview__section {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.design-preview__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--panel-border);
  font-size: 12px;
}

.design-preview__errors {
  border: 1px solid var(--danger);
  background: rgba(251, 113, 133, 0.08);
  color: var(--text-primary);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.design-placeholder {
  border: 1px dashed var(--panel-border);
  border-radius: 10px;
  padding: 12px;
  color: var(--text-muted);
  text-align: center;
}

.design-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.design-toggle {
  display: inline-flex;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  overflow: hidden;
}

.design-toggle button {
  background: transparent;
  color: var(--text-primary);
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.design-toggle button[data-active="true"] {
  background: rgba(125, 211, 252, 0.14);
  color: var(--accent-strong);
}

.design-actions {
  display: flex;
  gap: 8px;
}

.design-actions button {
  border: 1px solid var(--panel-border);
  background: linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(34, 211, 238, 0.2));
  color: var(--text-primary);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
}

.design-actions button:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.2);
}

.design-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.design-editor__block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.design-textarea {
  width: 100%;
  min-height: 140px;
  border: 1px solid var(--panel-border);
  background: #0a0f1f;
  color: #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

.design-validation {
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.design-validation[data-status="error"] {
  border-color: var(--danger);
  background: rgba(251, 113, 133, 0.08);
}

.design-validation[data-status="invalid"] {
  border-color: var(--warning);
  background: rgba(251, 191, 36, 0.08);
}

.design-validation__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
}

.design-diff,
.design-history {
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.01);
}

.design-diff ul,
.design-history ul {
  margin: 6px 0 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.design-history li,
.design-diff li {
  color: var(--text-primary);
  font-size: 13px;
}
`;

export function ensureDesignLabStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = STYLE_PAYLOAD;
  document.head.appendChild(styleEl);
}
