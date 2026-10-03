/**
 * Request-scoped identity for database access.
 *
 * The app connects as `prisma_migration`, a restricted superuser, which by
 * design bypasses every row-level-security policy. When a *user* context is
 * present, the scoped Prisma layer opens a transaction, switches to the
 * non-superuser `prisma_application` role and publishes the caller's wallet as
 * `app.wallet` — the variable the RLS policies match against. That makes the
 * database itself enforce tenant isolation.
 *
 * System paths (cron, webhooks, the event indexer, admin tooling) have no user
 * context and therefore keep full access. They must say so explicitly with
 * `runAsSystem` so the intent is greppable and the CI guard can allow-list it.
 */
import { AsyncLocalStorage } from "node:async_hooks"

export type RlsContext = { kind: "user"; wallet: string } | { kind: "system" }

const storage = new AsyncLocalStorage<RlsContext>()

/** Run `fn` with the given wallet as the enforcing RLS identity. */
export function runWithWallet<T>(wallet: string, fn: () => T): T {
  return storage.run({ kind: "user", wallet: wallet.toLowerCase() }, fn)
}

/** Run `fn` with full (superuser) access, explicitly marked as a system path. */
export function runAsSystem<T>(fn: () => T): T {
  return storage.run({ kind: "system" }, fn)
}

export function currentRlsContext(): RlsContext | undefined {
  return storage.getStore()
}

/** The wallet of the current user context, or undefined for system/no context. */
export function currentWallet(): string | undefined {
  const ctx = storage.getStore()
  return ctx?.kind === "user" ? ctx.wallet : undefined
}

const scopedTxStorage = new AsyncLocalStorage<true>()

/**
 * Mark the current async context as running inside an RLS-scoped transaction.
 * The Prisma hook checks this to avoid wrapping operations again — the
 * transaction already carries the role and identity.
 */
export function runInsideScopedTx<T>(fn: () => T): T {
  return scopedTxStorage.run(true, fn)
}

export function insideScopedTx(): boolean {
  return scopedTxStorage.getStore() === true
}
