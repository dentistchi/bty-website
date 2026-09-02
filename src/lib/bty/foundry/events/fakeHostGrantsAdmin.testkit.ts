import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A `foundry_host_grants` stand-in for unit tests. TEST SUPPORT ONLY.
 *
 * ★ IT ENFORCES THE DATABASE'S CHECK CONSTRAINT.
 *
 * The migration adds `check ((status = 'active') = (manual_granted or microsoft_manager_granted))`.
 * A fake that accepted any row would let a provenance bug pass here and fail in production on the
 * first write, so every write is validated the way Postgres will validate it. A test that violates
 * the invariant throws with the offending row.
 *
 * It also mirrors PostgREST's upsert semantics: `ON CONFLICT DO UPDATE` writes only the columns in
 * the payload, so a column left out is preserved. That is exactly the behaviour `grantFoundryHost`
 * and `setMicrosoftManagerGrant` rely on to avoid clobbering each other's flag.
 */

export type GrantRow = {
  user_id: string;
  status: "active" | "revoked";
  manual_granted: boolean;
  microsoft_manager_granted: boolean;
  microsoft_manager_synced_at: string | null;
  granted_by_user_id: string | null;
  granted_at: string;
  revoked_at: string | null;
};

function assertCheckConstraint(row: Record<string, unknown>) {
  const active = row.status === "active";
  const anySource = row.manual_granted === true || row.microsoft_manager_granted === true;
  if (active !== anySource) {
    throw new Error(
      `foundry_host_grants_effective_check violated: ${JSON.stringify({
        status: row.status,
        manual_granted: row.manual_granted,
        microsoft_manager_granted: row.microsoft_manager_granted,
      })}`,
    );
  }
}

const DEFAULTS = {
  status: "revoked",
  manual_granted: false,
  microsoft_manager_granted: false,
  microsoft_manager_synced_at: null,
  granted_by_user_id: null,
  granted_at: "2026-09-01T00:00:00.000Z",
  revoked_at: null,
};

export function makeFakeHostAdmin(seed: Partial<GrantRow>[] = []) {
  const rows: Record<string, unknown>[] = seed.map((r) => ({ ...DEFAULTS, ...r }));
  for (const r of rows) assertCheckConstraint(r);

  const rpcHandlers = new Map<string, (args: unknown) => { data: unknown; error: unknown }>();

  function from(_table: string) {
    const q = {
      _filters: [] as Array<{ c: string; v: unknown }>,
      _mode: "select" as "select" | "update",
      _patch: {} as Record<string, unknown>,
      select() {
        return this;
      },
      returns() {
        return this;
      },
      order() {
        return this;
      },
      eq(c: string, v: unknown) {
        this._filters.push({ c, v });
        return this;
      },
      _match(r: Record<string, unknown>) {
        return this._filters.every((f) => r[f.c] === f.v);
      },
      upsert(row: Record<string, unknown>) {
        const i = rows.findIndex((r) => r.user_id === row.user_id);
        // PostgREST writes only the supplied columns; the rest survive (insert uses defaults).
        const next = i >= 0 ? { ...rows[i], ...row } : { ...DEFAULTS, ...row };
        assertCheckConstraint(next);
        if (i >= 0) rows[i] = next;
        else rows.push(next);
        return Promise.resolve({ data: null, error: null });
      },
      update(patch: Record<string, unknown>) {
        this._mode = "update";
        this._patch = patch;
        return this;
      },
      maybeSingle() {
        return Promise.resolve({ data: rows.filter((r) => this._match(r))[0] ?? null, error: null });
      },
      then(onF: (v: { data: unknown; error: null }) => unknown) {
        if (this._mode === "update") {
          rows
            .filter((r) => this._match(r))
            .forEach((r) => {
              const next = { ...r, ...this._patch };
              assertCheckConstraint(next);
              Object.assign(r, this._patch);
            });
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        return Promise.resolve({ data: rows.filter((r) => this._match(r)), error: null }).then(onF);
      },
    };
    return q;
  }

  function rpc(name: string, args: unknown) {
    const handler = rpcHandlers.get(name);
    return Promise.resolve(handler ? handler(args) : { data: null, error: { code: "42883" } });
  }

  return {
    admin: { from, rpc } as unknown as SupabaseClient,
    rows,
    row: (userId: string) => rows.find((r) => r.user_id === userId) as GrantRow | undefined,
    onRpc(name: string, handler: (args: unknown) => { data: unknown; error: unknown }) {
      rpcHandlers.set(name, handler);
    },
  };
}
