import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { registerShutdownSignals } from '../../src/common/shutdown';

function fakeProcess() {
  const emitter = new EventEmitter();
  const exit = vi.fn();
  return {
    proc: { on: emitter.on.bind(emitter), exit } as unknown as NodeJS.Process,
    emit: (signal: string) => emitter.emit(signal),
    exit,
  };
}

const silentLog = { log: vi.fn(), error: vi.fn() };

describe('registerShutdownSignals', () => {
  it('U-14 closes the app once on SIGTERM, drains first, exits 0', async () => {
    const order: string[] = [];
    const close = vi.fn(async () => {
      order.push('close');
    });
    const { proc, emit, exit } = fakeProcess();
    registerShutdownSignals(
      { close },
      {
        proc,
        log: silentLog,
        beforeClose: () => order.push('drain'),
      },
    );

    emit('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(close).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['drain', 'close']);
  });

  it('U-14b also handles SIGINT', async () => {
    const close = vi.fn(async () => undefined);
    const { proc, emit, exit } = fakeProcess();
    registerShutdownSignals({ close }, { proc, log: silentLog });

    emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it('U-15 exits 1 when close fails', async () => {
    const close = vi.fn(async () => {
      throw new Error('pool refused to end');
    });
    const { proc, emit, exit } = fakeProcess();
    registerShutdownSignals({ close }, { proc, log: silentLog });

    emit('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });

  it('U-16 ignores a second signal while closing', async () => {
    let finish: () => void = () => undefined;
    const close = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { proc, emit, exit } = fakeProcess();
    registerShutdownSignals({ close }, { proc, log: silentLog });

    emit('SIGTERM');
    emit('SIGTERM');
    emit('SIGINT');
    expect(close).toHaveBeenCalledTimes(1);

    finish();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('U-17 force-exits with 1 if close hangs past the deadline', async () => {
    vi.useFakeTimers();
    try {
      const close = vi.fn(() => new Promise<void>(() => undefined));
      const { proc, emit, exit } = fakeProcess();
      registerShutdownSignals({ close }, { proc, log: silentLog, forceExitMs: 5_000 });

      emit('SIGTERM');
      await vi.advanceTimersByTimeAsync(5_001);
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
