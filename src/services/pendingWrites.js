let pending = 0
export const hasPendingWrites = () => pending > 0
export async function trackWrite(action) {
  pending++
  try { return await action() } finally { pending-- }
}
