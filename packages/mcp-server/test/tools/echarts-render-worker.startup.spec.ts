import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("MCP startup ECharts render boundary", () => {
  it("warms the worker before accepting tools while keeping ECharts out of the main realm", async () => {
    const serverEntry = new URL("../../src/index.ts", import.meta.url).href;
    const poisonMarker = "OODS_MAIN_REALM_ECHARTS_IMPORT";
    const hookUrl = `data:text/javascript,${encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === "echarts" || specifier.startsWith("echarts/")) {
          throw new Error(${JSON.stringify(poisonMarker)} + ":" + specifier);
        }
        return nextResolve(specifier, context);
      }
    `)}`;
    const script = `
      import { register } from 'node:module';

      void (async () => {
        register(${JSON.stringify(hookUrl)}, import.meta.url);

        let poisonVerified = false;
        try {
          await import('echarts/core');
        } catch (error) {
          if (!String(error?.message ?? error).includes(${JSON.stringify(poisonMarker)})) {
            throw error;
          }
          poisonVerified = true;
        }
        if (!poisonVerified) {
          throw new Error('ECharts import poison hook did not reject echarts/core');
        }

        await import(${JSON.stringify(serverEntry)});
        const { getEChartsRenderWorkerState } = await import('@oods/viz-render');
        const state = await getEChartsRenderWorkerState();
        process.stdout.write(
          'OODS_STARTUP_PROBE=' + JSON.stringify({ poisonVerified, state }),
          () => process.exit(0),
        );
      })().catch((error) => {
        process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
      });
    `;

    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script],
      {
        cwd: fileURLToPath(new URL("../..", import.meta.url)),
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          MCP_HEALTH_PORT: "0",
          OODS_OTLP_ENDPOINT: "",
        },
      },
    );

    // s228-m01: stdin EOF now shuts the native server down. Keep the client's input pipe open
    // while startup runs; spawnSync closes it before the probe can observe the warmed worker.
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    const exited = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Startup probe timed out: ${stderr}`)); }, 30_000);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
    });
    expect(exited.signal).toBeNull();
    expect(exited.code, stderr).toBe(0);
    const match = stdout.match(/OODS_STARTUP_PROBE=(\{.*\})/);
    expect(match).not.toBeNull();
    const probe = JSON.parse(match?.[1] ?? "{}") as {
      poisonVerified?: boolean;
      state?: Record<string, unknown>;
    };
    expect(probe.poisonVerified).toBe(true);
    expect(probe.state).toMatchObject({
      workerCreated: true,
      echartsLoaded: true,
      spawnCount: 1,
      loadCount: 1,
    });
  }, 35_000);
});
