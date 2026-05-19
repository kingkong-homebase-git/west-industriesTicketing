/**
 * Per-ticket debounce for fire-and-forget Notion pushes.
 *
 * The map lives at module scope so that multiple mutations on the same ticket
 * within the debounce window collapse to a single Notion push. Errors are
 * caught and logged here because the caller has already returned to the user —
 * push.ts is responsible for writing the sync_logs row regardless of outcome.
 */

const timers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 2000;

export function debouncePush(
  ticketId: string,
  pushFn: () => Promise<void>
): void {
  const existing = timers.get(ticketId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(ticketId);
    pushFn().catch((err) => {
      console.error(
        `[sync] Debounced push for ticket ${ticketId} failed:`,
        err
      );
    });
  }, DEBOUNCE_MS);

  timers.set(ticketId, timer);
}
