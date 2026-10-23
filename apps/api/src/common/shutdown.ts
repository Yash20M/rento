const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

interface ShutdownOptions {
  proc?: Pick<NodeJS.Process, 'on' | 'exit'>;
  /** Runs first — flips readiness to "draining" so load balancers stop routing. */
  beforeClose?: () => void;
  forceExitMs?: number;
  log?: { log(message: string): void; error(message: string): void };
}

/**
 * Graceful shutdown (README §15): on SIGTERM/SIGINT stop accepting requests, drain in-flight work,
 * run Nest destroy hooks (ends the DB pool), then exit 0. Failure or a hang past `forceExitMs` exits 1.
 * Used instead of `enableShutdownHooks()` because it is deterministic to test without real signals.
 */
export function registerShutdownSignals(
  app: { close(): Promise<void> },
  options: ShutdownOptions = {},
): void {
  const proc = options.proc ?? process;
  const forceExitMs = options.forceExitMs ?? 10_000;
  const log = options.log ?? { log: console.log, error: console.error };
  let closing = false;

  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    log.log(`Received ${signal}, shutting down`);

    const timer = setTimeout(() => {
      log.error(`Shutdown exceeded ${forceExitMs}ms, forcing exit`);
      proc.exit(1);
    }, forceExitMs);
    timer.unref();

    void (async () => {
      try {
        options.beforeClose?.();
        await app.close();
        clearTimeout(timer);
        proc.exit(0);
      } catch (error) {
        clearTimeout(timer);
        log.error(`Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
        proc.exit(1);
      }
    })();
  };

  for (const signal of SIGNALS) proc.on(signal, () => shutdown(signal));
}
