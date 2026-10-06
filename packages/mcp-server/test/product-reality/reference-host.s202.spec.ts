import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIME_TYPE, DEFAULT_CSP, ReferenceHost, cspHeader } from '../../../../scripts/product-reality/s202-reference-host.js';

/**
 * The reference host is the local gate for the conversation surface (s202-m02): Chromium, the double iframe on two
 * 127.0.0.1 origins, the spec's default CSP, the SDK's app-bridge, and the real adapter over stdio. The minimal preview
 * app must render with zero console errors and zero securitypolicyviolation events, read the compiled module through
 * the host, and the harness must fail when the extension was not negotiated.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const hosts: ReferenceHost[] = [];
afterEach(async () => { for (const host of hosts.splice(0)) await host.close(); });

describe('the reference host renders the preview app from the adapter under the default CSP (s202-m02)', () => {
  it('builds the sandbox policy from the default and a resource\'s declared domains', () => {
    expect(cspHeader()).toBe(DEFAULT_CSP);
    expect(DEFAULT_CSP).toBe("default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'");
    expect(cspHeader({ connectDomains: ['https://api.example.com'], resourceDomains: ['https://cdn.example.com'] })).toContain("connect-src https://api.example.com");
    expect(cspHeader({ connectDomains: ['https://api.example.com'], resourceDomains: ['https://cdn.example.com'] })).toContain("script-src 'self' 'unsafe-inline' https://cdn.example.com");
  });

  it('renders design_preview for a Subscription detail: the app connects, shows the version and reads the iife module through resources/read, with zero console errors and zero CSP violations', async () => {
    expect(fs.existsSync(path.join(root, 'packages/mcp-bridge/dist/preview-app/app.html')), 'the preview app must be built').toBe(true);
    const host = await ReferenceHost.open({ negotiate: true });
    hosts.push(host);
    expect(host.initialized).toMatchObject({ capabilities: { resources: {}, extensions: { 'io.modelcontextprotocol/ui': {} } } });
    const rendered = await host.render('design_preview', { object: 'Subscription', context: 'detail' });
    expect(rendered.resource.mimeType).toBe(APP_MIME_TYPE);
    expect(rendered.resourceUri).toMatch(/^ui:\/\/oods-forge\/preview\/[a-f0-9]{12}\/app\.html$/);
    await rendered.appFrame.waitForFunction(() => (window as unknown as { __oodsPreviewApp?: { connected: boolean } }).__oodsPreviewApp?.connected === true, undefined, { timeout: 60_000 });
    await rendered.appFrame.waitForFunction(() => { const state = (window as unknown as { __oodsPreviewApp?: { module: unknown; errors: string[] } }).__oodsPreviewApp; return Boolean(state?.module) || (state?.errors.length ?? 0) > 0; }, undefined, { timeout: 120_000 });
    const app = await rendered.appFrame.evaluate(() => (window as unknown as { __oodsPreviewApp: { connected: boolean; hostContext: { theme?: string; displayMode?: string }; result: { compositionId: string; version: number; resources: { modules: Record<string, string> } }; module: { uri: string; bytes: number; mimeType: string; registers: boolean } | null; errors: string[] } }).__oodsPreviewApp);
    expect(app.errors).toEqual([]);
    expect(app.connected).toBe(true);
    expect(app.hostContext).toMatchObject({ theme: 'light', displayMode: 'inline' });
    const structured = (rendered.result as { structuredContent: { compositionId: string; version: number } }).structuredContent;
    expect(app.result).toMatchObject({ compositionId: structured.compositionId, version: structured.version });
    expect(app.module).toMatchObject({ uri: app.result.resources.modules.react, mimeType: 'text/javascript', registers: true });
    expect(app.module!.bytes).toBeGreaterThan(1000);
    // The inner frame is the app document on the sandbox origin, not the host's.
    expect(rendered.sandboxFrame.url()).toContain('/sandbox.html');
    expect(await rendered.appFrame.evaluate(() => document.querySelector('[data-oods-preview-app]') !== null)).toBe(true);
    // Every act crossed the bridge as recorded, and the sandbox reported no violation of the default policy.
    expect(host.events.map(event => event.kind)).toEqual(expect.arrayContaining(['sandbox-proxy-ready', 'initialized', 'tool-result-sent', 'resources/read']));
    expect(host.events.filter(event => event.kind === 'resources/read').map(event => event.uri)).toContain(app.result.resources.modules.react);
    expect(host.cspViolations).toEqual([]);
    expect(host.consoleErrors).toEqual([]);
    expect(host.pageErrors).toEqual([]);
    expect(host.rpc.nonJson).toEqual([]);
    expect(host.rpc.negotiationReceipt()).toMatch(/oods-reference-host 0\.1\.0 .*negotiated/);
  }, 300_000);

  it('fails when the extension was not negotiated: design_preview carries no _meta.ui and the render is refused by the harness', async () => {
    const host = await ReferenceHost.open({ negotiate: false });
    hosts.push(host);
    const { tools } = await host.listTools();
    expect(tools).toHaveLength(19);
    expect(tools.find(tool => tool.name === 'design_preview')!._meta).toBeUndefined();
    await expect(host.render('design_preview', { object: 'Subscription', context: 'card' })).rejects.toThrow(/did not offer the preview app/);
    expect(host.rpc.negotiationReceipt()).toMatch(/not advertised/);
  }, 120_000);
});
