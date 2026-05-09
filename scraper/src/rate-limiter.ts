let lastRequest = 0;

export async function rateLimit(ms: number = 1000): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < ms) {
    await new Promise((r) => setTimeout(r, ms - elapsed));
  }
  lastRequest = Date.now();
}

export function resetRateLimit(): void {
  lastRequest = 0;
}
