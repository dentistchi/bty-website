/**
 * An in-memory stand-in for the Track conversation schema, faithful to
 * `20260912000000_bty_announcement_thread_v1.sql`.
 *
 * ★ WHY A FAKE DATABASE RATHER THAN MORE MOCKS.
 *
 * The property under test is ISOLATION between recipients of the SAME announcement, and a mock that
 * returns a canned answer per call cannot express it — it would pass whether or not the code ever
 * scoped anything. Only shared state with real rows, real ownership and real foreign keys can show
 * that Recipient B is refused a thread Recipient A can read.
 *
 * It models exactly what the SQL guarantees and nothing more:
 *
 *   * role is DERIVED by joining recipient -> announcement owner (never supplied)
 *   * a non-party gets `none`, indistinguishable from a missing row
 *   * messages are addressed by `recipient_id` alone — there is no announcement column
 *   * APPEND ONLY: this store exposes no update and no delete for messages, the same way
 *     `service_role` holds SELECT and INSERT and no UPDATE or DELETE grant
 *   * the client nonce is unique per (recipient_id, author_user_id, client_message_id)
 *   * `respond` writes the disposition and the first message in ONE step, or neither
 *
 * It is a test double, so it is deliberately narrow: no funnel, no binding, no notification lease.
 */

export type FakeAnnouncement = { id: string; ownerUserId: string };

export type FakeRecipientRow = {
  id: string;
  announcementId: string;
  /** Null until this person's first canonical BTY entry — an unbound row is a party to nothing. */
  userId: string | null;
  response: "ACKNOWLEDGED" | "QUESTION" | "HELP_NEEDED" | null;
  respondedAt: string | null;
  questionText: string | null;
  handledAt: string | null;
  handledByUserId: string | null;
};

export type FakeMessage = {
  id: string;
  recipientId: string;
  authorUserId: string;
  authorRole: "HOST" | "RECIPIENT";
  body: string;
  clientMessageId: string | null;
  createdAt: string;
};

/** One receipt per (message, reader) — the primary key, as a row. */
export type FakeRead = { messageId: string; readerUserId: string };

export type ThreadStore = {
  announcements: FakeAnnouncement[];
  recipients: FakeRecipientRow[];
  messages: FakeMessage[];
  reads: FakeRead[];
  /** Deterministic, monotonic clock, so ordering assertions do not depend on wall time. */
  tick: () => string;
};

export function makeRecipientRow(over: Partial<FakeRecipientRow> = {}): FakeRecipientRow {
  return {
    id: "r-a",
    announcementId: "ann-1",
    userId: "user-a",
    response: null,
    respondedAt: null,
    questionText: null,
    handledAt: null,
    handledByUserId: null,
    ...over,
  };
}

export function makeStore(over: Partial<Omit<ThreadStore, "tick">> = {}): ThreadStore {
  let n = 0;
  return {
    announcements: over.announcements ?? [{ id: "ann-1", ownerUserId: "host-1" }],
    recipients: over.recipients ?? [makeRecipientRow()],
    messages: over.messages ?? [],
    reads: [],
    tick: () => new Date(Date.UTC(2026, 8, 12, 0, 0, ++n)).toISOString(),
  };
}

/** The join the SQL performs. Owner wins when a Host is also in their own audience. */
function roleOf(store: ThreadStore, recipientId: string, actorUserId: string): "HOST" | "RECIPIENT" | "none" {
  const r = store.recipients.find((x) => x.id === recipientId);
  if (!r || !actorUserId) return "none";
  const a = store.announcements.find((x) => x.id === r.announcementId);
  if (!a) return "none";
  if (a.ownerUserId === actorUserId) return "HOST";
  // Plain equality: an UNBOUND row (userId null) matches nobody, ever.
  if (r.userId !== null && r.userId === actorUserId) return "RECIPIENT";
  return "none";
}

type Rpc = (args: Record<string, unknown>) => { data: unknown; error: null } | { data: null; error: { code: string } };

/**
 * A Supabase-shaped client over the store: the three RPCs plus the one message SELECT the service
 * performs. Anything the service asks for that is not modelled throws, so a query that silently
 * widened its scope cannot pass by accident.
 */
export function makeThreadAdmin(store: ThreadStore) {
  const rpcs: Record<string, Rpc> = {
    bty_resolve_announcement_thread_role: (a) => ({
      data: [{ role: roleOf(store, String(a.p_recipient_id ?? ""), String(a.p_actor_user_id ?? "")) }],
      error: null,
    }),

    bty_post_announcement_thread_message: (a) => {
      const recipientId = String(a.p_recipient_id ?? "");
      const actor = String(a.p_actor_user_id ?? "");
      const role = roleOf(store, recipientId, actor);
      if (role === "none") return { data: [{ result: "not_found" }], error: null };

      const body = String(a.p_body ?? "").trim();
      if (body.length < 1) return { data: [{ result: "empty_message" }], error: null };
      if (body.length > 1000) return { data: [{ result: "message_too_long" }], error: null };

      const key = a.p_client_message_id == null ? null : String(a.p_client_message_id).trim() || null;
      if (key) {
        // The partial UNIQUE index, as a lookup. Scoped under (recipient, author): one person's
        // nonce can neither collide with nor address another's.
        const dup = store.messages.find(
          (m) => m.recipientId === recipientId && m.authorUserId === actor && m.clientMessageId === key,
        );
        if (dup) {
          return {
            data: [
              {
                result: "duplicate",
                message_id: dup.id,
                author_role: dup.authorRole,
                created_at: dup.createdAt,
                reopened: false,
              },
            ],
            error: null,
          };
        }
      }

      const msg: FakeMessage = {
        id: `m-${store.messages.length + 1}`,
        recipientId,
        authorUserId: actor,
        // DERIVED. There is no path by which a caller's value reaches this field.
        authorRole: role,
        body,
        clientMessageId: key,
        createdAt: store.tick(),
      };
      store.messages.push(msg);

      /*
        ★ THE REOPEN, IN THE SAME STEP AS THE INSERT. A new RECIPIENT message clears the settled
        marker; a HOST message never does, or answering somebody would put them back on your own
        list. A duplicate reopens nothing, because no NEW thing was said.
      */
      let reopened = false;
      if (role === "RECIPIENT") {
        const row = store.recipients.find((x) => x.id === recipientId)!;
        if (row.handledAt !== null) {
          row.handledAt = null;
          row.handledByUserId = null;
          reopened = true;
        }
      }

      return {
        data: [
          { result: "posted", message_id: msg.id, author_role: msg.authorRole, created_at: msg.createdAt, reopened },
        ],
        error: null,
      };
    },

    bty_mark_announcement_thread_read: (a) => {
      const recipientId = String(a.p_recipient_id ?? "");
      const actor = String(a.p_actor_user_id ?? "");
      const role = roleOf(store, recipientId, actor);
      if (role === "none") return { data: [{ result: "not_found", role: null, marked: 0 }], error: null };

      // WHICH SIDE follows from the ROLE. There is no parameter for it, so neither party can mark
      // the other's reading done. Receipts, never a cursor -- see the migration header.
      const other = role === "HOST" ? "RECIPIENT" : "HOST";
      let marked = 0;
      for (const m of store.messages) {
        if (m.recipientId !== recipientId || m.authorRole !== other) continue;
        if (store.reads.some((x) => x.messageId === m.id && x.readerUserId === actor)) continue;
        store.reads.push({ messageId: m.id, readerUserId: actor });
        marked += 1;
      }
      // ★ IT DOES NOT HANDLE ANYTHING. `handledAt` is deliberately untouched here.
      return { data: [{ result: "read", role, marked }], error: null };
    },

    /** The 20260912 body: disposition and first message in ONE step, or neither. */
    bty_respond_to_announcement: (a) => {
      const announcementId = String(a.p_announcement_id ?? "");
      const userId = String(a.p_user_id ?? "");
      const response = String(a.p_response ?? "");
      if (!["ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"].includes(response)) {
        return { data: [{ result: "invalid_response" }], error: null };
      }
      let q: string | null = String(a.p_question_text ?? "").trim() || null;
      if (response !== "QUESTION") q = null;
      else if (q && q.length > 1000) return { data: [{ result: "question_too_long" }], error: null };

      const r = store.recipients.find((x) => x.announcementId === announcementId && x.userId === userId);
      if (!r) return { data: [{ result: "not_a_recipient" }], error: null };
      if (r.response !== null) {
        return { data: [{ result: "already_responded", response: r.response, responded_at: r.respondedAt }], error: null };
      }

      const now = store.tick();
      r.response = response as FakeRecipientRow["response"];
      r.respondedAt = now;
      r.questionText = q;
      if (response === "QUESTION" && q) {
        store.messages.push({
          id: `m-${store.messages.length + 1}`,
          recipientId: r.id,
          authorUserId: userId,
          authorRole: "RECIPIENT",
          body: q,
          clientMessageId: null,
          createdAt: now,
        });
      }
      return { data: [{ result: "responded", response, responded_at: now }], error: null };
    },
  };

  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      const fn = rpcs[name];
      if (!fn) throw new Error(`unmodelled rpc: ${name}`);
      return fn(args);
    },
    from(table: string) {
      if (table === "bty_announcement_thread_message_reads") {
        let reads = store.reads;
        const rq = {
          select(_cols: string) {
            void _cols;
            return rq;
          },
          eq(col: string, val: string) {
            if (col !== "reader_user_id") throw new Error(`unmodelled filter: ${col}`);
            reads = reads.filter((r) => r.readerUserId === val);
            return rq;
          },
          in(col: string, vals: string[]) {
            if (col !== "message_id") throw new Error(`unmodelled filter: ${col}`);
            reads = reads.filter((r) => vals.includes(r.messageId));
            return rq;
          },
          returns() {
            return Promise.resolve({ data: reads.map((r) => ({ message_id: r.messageId })), error: null });
          },
        };
        return rq;
      }
      if (table !== "bty_announcement_thread_messages") throw new Error(`unmodelled table: ${table}`);
      let rows = store.messages;
      const q = {
        // The service never selects anything else; asserting the shape here is how a widened
        // projection (a body reaching a list surface) is caught.
        select(_cols: string) {
          void _cols;
          q.__cols = _cols;
          return q;
        },
        __cols: "",
        eq(col: string, val: string) {
          if (col !== "recipient_id") throw new Error(`unmodelled filter: ${col}`);
          rows = rows.filter((m) => m.recipientId === val);
          return q;
        },
        in(col: string, vals: string[]) {
          if (col !== "recipient_id") throw new Error(`unmodelled filter: ${col}`);
          rows = rows.filter((m) => vals.includes(m.recipientId));
          return q;
        },
        /*
          (created_at, id) is a TOTAL order. Applied as ONE stable comparison rather than two passes,
          which is what the two chained `.order()` calls mean to PostgREST.
        */
        order(col: string, opts: { ascending: boolean }) {
          if (col !== "created_at" && col !== "id") throw new Error(`unmodelled order: ${col}`);
          const dir = opts.ascending ? 1 : -1;
          rows = [...rows].sort(
            (x, y) => dir * (x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id)),
          );
          return q;
        },
        returns() {
          return Promise.resolve({
            data: rows.map((m) => ({
              id: m.id,
              recipient_id: m.recipientId,
              author_user_id: m.authorUserId,
              author_role: m.authorRole,
              body: m.body,
              created_at: m.createdAt,
            })),
            error: null,
          });
        },
      };
      return q;
    },
    auth: {
      admin: {
        // Names come from the provider, never from user_metadata. The store has no directory, so
        // every author resolves to null and the surfaces must still render them.
        getUserById: async () => ({ data: { user: null }, error: null }),
      },
    },
  };
}
