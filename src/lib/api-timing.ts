type TimedTask = <T>(label: string, task: () => Promise<T>) => Promise<T>;

function milliseconds(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

/** Temporary server-side instrumentation. Never logs request bodies, cookies, or user data. */
export async function withApiTiming<T>(
  request: Request,
  endpoint: string,
  handler: (time: TimedTask) => Promise<T>,
): Promise<T> {
  const requestStartedAt = performance.now();
  const phases: Record<string, number> = {};
  const requestId = crypto.randomUUID().slice(0, 8);
  const time: TimedTask = async (label, task) => {
    const phaseStartedAt = performance.now();
    try {
      return await task();
    } finally {
      phases[label] = Math.round(((phases[label] ?? 0) + milliseconds(phaseStartedAt)) * 100) / 100;
    }
  };

  try {
    return await handler(time);
  } finally {
    console.info("[api-timing]", {
      requestId,
      endpoint,
      method: request.method,
      ...phases,
      totalMs: milliseconds(requestStartedAt),
    });
  }
}
