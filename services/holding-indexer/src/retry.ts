export interface RetryOptions {
  attempts: number;
  baseDelayMs?: number;
  maximumDelayMs?: number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maximumDelayMs = options.maximumDelayMs ?? 30_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts) break;
      const exponential = Math.min(maximumDelayMs, baseDelayMs * 2 ** attempt);
      const delayMs = Math.floor(exponential * (0.75 + Math.random() * 0.5));
      options.onRetry?.(error, attempt + 1, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
