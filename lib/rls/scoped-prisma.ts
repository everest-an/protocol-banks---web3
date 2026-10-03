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
import { currentRlsContext } from "./context"

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

        // Lifecycle and other non-query client methods pass through untouched.
        if (!model && !SCOPED_RAW_OPS.has(operation)) {
          return query(args)
        }

        return base.$transaction(async (tx) => {
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
        })
      },
    },
  })

  return scoped
}
