/**
 * Scoped Prisma client — makes PostgreSQL enforce tenant isolation itself.
 *
 * The app's base connection authenticates as `prisma_migration`, a restricted
 * superuser that bypasses every RLS policy. When a *user* context is active,
 * this wrapper runs each operation inside a transaction that:
 *
 *   1. `SET LOCAL ROLE prisma_application` — switches to the platform-provided
 *      non-superuser role (transaction-scoped, so the pooled session is never
 *      left switched), and
 *   2. publishes the caller's wallet as `app.wallet`.
 *
 * The RLS policies then match `lower(<owner column>)` against
 * `lower(current_setting('app.wallet', true))` — the database, not the query
 * author, decides who sees what.
 *
 * Gated by RLS_MODE so rollout is controlled:
 *   off     (default) — every hook passes through; behaviour is unchanged.
 *   enforce           — user-context operations are scoped; system / no-context
 *                       operations keep full access (system paths use runAsSystem
 *                       explicitly — see lib/rls/context.ts).
 *
 * Known gap: Prisma Client extensions cannot intercept `$transaction`, so
 * interactive transactions opened directly with `prisma.$transaction(...)`
 * would execute their inner operations unscoped. User-context code must use the
 * scoped-transaction helper instead (tracked by the CI guard); one-shot
 * operations are scoped automatically.
 */
import type { PrismaClient } from "@prisma/client"
import { currentRlsContext, insideScopedTx } from "./context"

export type RlsMode = "off" | "enforce"

export function rlsMode(): RlsMode {
  return process.env.RLS_MODE === "enforce" ? "enforce" : "off"
}

type DynamicDelegate = Record<string, (args: unknown) => Promise<unknown>>

interface ScopeableTx {
  $executeRawUnsafe: (query: string, ...params: unknown[]) => Promise<unknown>
  $queryRawUnsafe: (query: string, ...params: unknown[]) => Promise<unknown>
}

/** Raw operations that must also run scoped when called outside a transaction. */
const SCOPED_RAW_OPS = new Set([
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
])

/** Publish the caller's wallet and switch to the RLS-enforcing role. */
async function enterScope(tx: ScopeableTx, wallet: string): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL ROLE prisma_application`)
  await tx.$queryRawUnsafe(`SELECT set_config('app.wallet', $1, true)`, wallet)
}

/**
 * Prisma Postgres occasionally answers "Unable to start a transaction in the
 * given time" (P2028) when many scoped operations run close together — the
 * default 2s maxWait is too tight while connections are being recycled. The
 * scoped transaction therefore waits up to 10s, and a transient P2028 is
 * retried once before surfacing to the caller.
 */
const SCOPED_TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const

function isTransactionStartTimeout(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  return err?.code === "P2028" && /Unable to start a transaction/.test(err?.message ?? "")
}

async function runScopedTransaction<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!isTransactionStartTimeout(error)) throw error
    await new Promise((resolve) => setTimeout(resolve, 200))
    return await run()
  }
}

/**
 * Wrap a base client with the RLS scoping hook. The returned client exposes the
 * same API, so existing call sites need no changes.
 */
export function createScopedPrisma<T extends PrismaClient>(base: T) {
  const scoped = base.$extends({
    query: {
      $allOperations({ args, query, operation, model }) {
        const ctx = currentRlsContext()

        // System paths and the off mode keep full (superuser) access.
        if (rlsMode() === "off" || !ctx || ctx.kind === "system") {
          return query(args)
        }

        // Inside a scoped transaction (scopedTransaction helper) the role and
        // identity are already set; re-wrapping would nest transactions.
        if (insideScopedTx()) {
          return query(args)
        }

        // Lifecycle and other non-query client methods pass through untouched.
        if (!model && !SCOPED_RAW_OPS.has(operation)) {
          return query(args)
        }

        return runScopedTransaction(() =>
          base.$transaction(async (tx) => {
            await enterScope(tx, ctx.wallet)

            // Model operations dispatch to the transaction delegate; raw
            // operations (model === undefined) dispatch to the raw client itself.
            // The assertion is the standard dynamic-dispatch shape for Prisma
            // extension hooks and is confined to this call.
            const delegate = (
              model
                ? (tx as unknown as Record<string, DynamicDelegate>)[model]
                : (tx as unknown as DynamicDelegate)
            )
            return delegate[operation](args)
          }, SCOPED_TX_OPTIONS)
        )
      },
    },
  })

  return scoped
}
