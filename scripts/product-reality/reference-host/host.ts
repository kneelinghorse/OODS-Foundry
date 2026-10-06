/**
 * The reference host page (MCP Apps 2026-01-26, SDK app-bridge 1.7.5): renders one app resource in the double
 * iframe and drives it the way a host does. tools/call and resources/read from the app go to the real adapter over
 * stdio through the functions the harness exposes on the page (window.__mcp), every conversation act is recorded
 * (window.__record). Bundled by the harness at run time; nothing here reaches the network.
 */
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

type Json = Record<string, unknown>;
declare global {
  interface Window {
    __mcp: (method: string, params: Json) => Promise<Json>;
    __record: (event: Json) => Promise<void>;
    __referenceHost: { render: (input: RenderInput) => Promise<void>; setHostContext: (context: Json) => void; bridge: AppBridge | null };
  }
}
interface RenderInput { sandboxUrl: string; html: string; csp?: Json; tool: Json; toolInput: Json; toolResult: Json; hostContext: Json; width?: number; height?: number }

const record = (event: Json) => window.__record(event);

async function render(input: RenderInput): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  iframe.setAttribute('title', 'MCP App sandbox');
  iframe.style.width = `${input.width ?? 900}px`;
  iframe.style.height = `${input.height ?? 700}px`;
  iframe.style.border = '0';
  const url = new URL(input.sandboxUrl);
  url.searchParams.set('host', location.origin);
  if (input.csp) url.searchParams.set('csp', JSON.stringify(input.csp));
  const step = <T,>(name: string, promise: Promise<T>, ms = 30_000): Promise<T> => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`reference host: ${name} did not happen within ${ms}ms`)), ms); promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); }); });
  const proxyReady = new Promise<void>(resolve => {
    const listener = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { method?: string; type?: string } | null;
      if (data?.method === 'ui/notifications/sandbox-proxy-ready') { window.removeEventListener('message', listener); resolve(); }
    };
    window.addEventListener('message', listener);
  });
  // CSP violations the sandbox relays from the inner document; they are not JSON-RPC and never reach the bridge.
  window.addEventListener('message', event => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data as { type?: string } | null;
    if (data?.type === 'oods-csp-violation') void record({ kind: 'csp-violation', ...data });
  });
  iframe.src = url.href;
  document.getElementById('host')!.replaceChildren(iframe);
  await step('sandbox-proxy-ready', proxyReady);
  await record({ kind: 'sandbox-proxy-ready' });

  const bridge = new AppBridge(null, { name: 'oods-reference-host', version: '0.1.0' }, {
    serverTools: {}, serverResources: {}, openLinks: {}, updateModelContext: { text: {} }, message: { text: {} },
  }, { hostContext: input.hostContext as never });
  window.__referenceHost.bridge = bridge;
  bridge.oncalltool = async (params: Json) => { await record({ kind: 'tools/call', params }); return (await window.__mcp('tools/call', params)) as never; };
  bridge.onreadresource = async (params: Json) => { await record({ kind: 'resources/read', uri: params.uri }); return (await window.__mcp('resources/read', params)) as never; };
  bridge.onlistresources = async () => (await window.__mcp('resources/list', {})) as never;
  bridge.onmessage = async (params: Json) => { await record({ kind: 'ui/message', params }); return {}; };
  bridge.onupdatemodelcontext = async (params: Json) => { await record({ kind: 'ui/update-model-context', params }); return {}; };
  bridge.onrequestdisplaymode = async (params: Json) => { await record({ kind: 'ui/request-display-mode', params }); const mode = params.mode as string; bridge.sendHostContextChange({ displayMode: mode } as never); return { mode } as never; };
  bridge.onopenlink = async (params: Json) => { await record({ kind: 'ui/open-link', params }); return {}; };
  bridge.onsizechange = (params: Json) => { void record({ kind: 'size-changed', params }); };
  const initialized = new Promise<void>(resolve => { bridge.oninitialized = () => { void record({ kind: 'initialized', appVersion: bridge.getAppVersion(), appCapabilities: bridge.getAppCapabilities() }); resolve(); }; });
  await step('bridge.connect', bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!)));
  await record({ kind: 'bridge-connected' });
  await step('sendSandboxResourceReady', bridge.sendSandboxResourceReady({ html: input.html, ...(input.csp ? { csp: input.csp } : {}) } as never));
  await record({ kind: 'sandbox-resource-ready-sent' });
  await step('ui/initialize from the app', initialized, 60_000);
  await step('sendToolInput', bridge.sendToolInput({ arguments: input.toolInput } as never));
  await step('sendToolResult', bridge.sendToolResult(input.toolResult as never));
  await record({ kind: 'tool-result-sent' });
}

window.__referenceHost = {
  render,
  bridge: null,
  setHostContext: (context: Json) => { window.__referenceHost.bridge?.sendHostContextChange(context as never); void record({ kind: 'host-context-changed', context }); },
};
