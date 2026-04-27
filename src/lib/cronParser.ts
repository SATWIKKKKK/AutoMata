/**
 * Cron schedule parser using the cron-parser package.
 * Supports standard 5-field cron expressions.
 */

// Use dynamic import so cron-parser (CommonJS) works in both Node + browser contexts
let cronParserInstance: any = null;

async function getCronParser() {
  if (!cronParserInstance) {
    cronParserInstance = await import('cron-parser');
  }
  return cronParserInstance;
}

export async function getNextRunTime(cronExpression: string): Promise<Date> {
  try {
    const { parseExpression } = await getCronParser();
    const interval = parseExpression(cronExpression, {
      currentDate: new Date(),
      tz: 'Asia/Kolkata',
    });
    return interval.next().toDate();
  } catch (err) {
    console.warn('[cronParser] failed to parse:', cronExpression, err);
    // Fallback: next hour
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  }
}

export async function shouldRunNow(
  cronExpression: string,
  lastRunAt?: string | null,
): Promise<boolean> {
  if (!cronExpression) return false;
  try {
    const { parseExpression } = await getCronParser();

    const referenceDate = lastRunAt ? new Date(lastRunAt) : new Date(0);
    const interval = parseExpression(cronExpression, {
      currentDate: referenceDate,
      tz: 'Asia/Kolkata',
    });
    const next = interval.next().toDate();
    return next <= new Date();
  } catch {
    return false;
  }
}
