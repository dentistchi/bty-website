import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isActiveFoundryHost,
  getFoundryHostStatus,
  grantFoundryHost,
  revokeFoundryHost,
} from "./foundryHostService";

type Row = Record<string, unknown>;

/** Minimal fake for the foundry_host_grants access patterns (upsert/update/select). */
function makeFakeAdmin() {
  const rows: Row[] = [];
  function from() {
    const q = {
      _filters: [] as Array<{ c: string; v: unknown }>,
      _mode: "select" as "select" | "update",
      _patch: {} as Row,
      select() {
        return this;
      },
      eq(c: string, v: unknown) {
        this._filters.push({ c, v });
        return this;
      },
      upsert(row: Row) {
        const i = rows.findIndex((r) => r.user_id === row.user_id);
        if (i >= 0) rows[i] = { ...rows[i], ...row };
        else rows.push({ ...row });
        return Promise.resolve({ data: null, error: null });
      },
      update(patch: Row) {
        this._mode = "update";
        this._patch = patch;
        return this;
      },
      _match(r: Row) {
        return this._filters.every((f) => r[f.c] === f.v);
      },
      maybeSingle() {
        const hit = rows.filter((r) => this._match(r))[0] ?? null;
        return Promise.resolve({ data: hit, error: null });
      },
      then(onF: (v: { data: null; error: null }) => unknown) {
        // terminal for update()
        rows.filter((r) => this._match(r)).forEach((r) => Object.assign(r, this._patch));
        return Promise.resolve({ data: null, error: null }).then(onF);
      },
    };
    return q;
  }
  return { admin: { from } as unknown as SupabaseClient, rows };
}

const U = "user-1";
const ADMIN_ACTOR = "admin-9";

describe("foundry host grants", () => {
  it("a fresh user is not a host", async () => {
    const { admin } = makeFakeAdmin();
    expect(await isActiveFoundryHost(admin, U)).toBe(false);
    expect(await getFoundryHostStatus(admin, U)).toBe("none");
  });

  it("grant makes an active host (idempotent)", async () => {
    const { admin, rows } = makeFakeAdmin();
    expect((await grantFoundryHost(admin, U, ADMIN_ACTOR)).ok).toBe(true);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
    expect(await getFoundryHostStatus(admin, U)).toBe("active");
    // idempotent — a second grant does not create a duplicate row.
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    expect(rows).toHaveLength(1);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
  });

  it("revoke removes host operation but keeps the row (idempotent)", async () => {
    const { admin, rows } = makeFakeAdmin();
    await grantFoundryHost(admin, U, ADMIN_ACTOR);

    const r1 = await revokeFoundryHost(admin, U);
    expect(r1).toEqual({ ok: true, changed: true });
    expect(await isActiveFoundryHost(admin, U)).toBe(false);
    expect(await getFoundryHostStatus(admin, U)).toBe("revoked");
    expect(rows).toHaveLength(1); // history preserved
    expect(rows[0].revoked_at).toBeTruthy();

    // idempotent — revoking again is a no-op success.
    const r2 = await revokeFoundryHost(admin, U);
    expect(r2).toEqual({ ok: true, changed: false });
  });

  it("revoking a never-granted user is a no-op success", async () => {
    const { admin } = makeFakeAdmin();
    expect(await revokeFoundryHost(admin, U)).toEqual({ ok: true, changed: false });
  });

  it("re-granting a revoked user reactivates and clears revoked_at", async () => {
    const { admin, rows } = makeFakeAdmin();
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    await revokeFoundryHost(admin, U);
    await grantFoundryHost(admin, U, ADMIN_ACTOR);
    expect(await isActiveFoundryHost(admin, U)).toBe(true);
    expect(rows[0].revoked_at).toBeNull();
    expect(rows).toHaveLength(1);
  });
});
