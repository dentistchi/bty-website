import { z } from 'zod';
import { MAX_QUERY_LEN } from '@/domain/youtube-search';
import { MAX_LYRICS_LEN } from '@/domain/lyrics';

// Guest enqueue. Primary path: a selected search result (videoId + metadata).
// Fallback path: a manually pasted YouTube URL/ID (`youtubeInput`), resolved to
// a video id server-side. At least one of the two must be present.
export const CreateRequestSchema = z
  .object({
    guestName: z.string().trim().min(1, 'Name is required').max(40),
    searchQuery: z.string().trim().max(MAX_QUERY_LEN).optional(),
    // Selected-result path:
    youtubeVideoId: z.string().trim().min(1).max(20).optional(),
    youtubeTitle: z.string().trim().max(300).optional(),
    youtubeChannelTitle: z.string().trim().max(200).optional(),
    youtubeThumbnailUrl: z.string().url().max(600).optional(),
    // Manual fallback path:
    youtubeInput: z.string().trim().max(300).optional(),
    // BUILD 18B — a client-minted key that is STABLE across timeout/retry of one logical
    // request and NEW only for a genuinely new request. When present the server dedups on
    // it (replay-safe); when absent behaviour is exactly the legacy insert. Optional so
    // every existing caller keeps working.
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  })
  .refine((v) => Boolean(v.youtubeVideoId || v.youtubeInput), {
    message: 'Select a song or paste a YouTube link',
    path: ['youtubeVideoId'],
  });
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

// My Songs (BUILD 20A) — the account saves ONE YouTube song into its personal
// library. Ownership is the canonical account, always derived server-side from the
// session, so NO accountId/roomId/eventId/requestId/cancelToken is accepted here:
// `.strict()` rejects every field outside this contract. videoId is enforced to the
// exact canonical 11-char form (mirrors domain/youtube.ts VIDEO_ID and the DB CHECK)
// — stricter than the guest request path, which only length-bounds it. Snapshots are
// trimmed + bounded; the thumbnail must be an https URL.
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const SaveSongSchema = z
  .object({
    videoId: z.string().trim().regex(YOUTUBE_VIDEO_ID, 'Invalid video id'),
    title: z.string().trim().min(1, 'Title is required').max(300),
    artist: z.string().trim().min(1).max(200).nullish(),
    thumbnailUrl: z
      .string()
      .trim()
      .url()
      .max(600)
      .refine((u) => u.startsWith('https://'), 'Thumbnail must be https')
      .nullish(),
  })
  .strict();
export type SaveSongInput = z.infer<typeof SaveSongSchema>;

// First-room onboarding: the Host supplies ONLY a Norebang display name. The slug
// is generated server-side; no owner, slug, or redirect is ever accepted from the
// client. Bounded 1..80 to match the workspace-name and account display-name limits.
export const CreateRoomSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

// Room Settings V1: the owner edits ONLY the guest-facing identity — display name
// (required, 1..80) and an optional welcome message (0..160). Trimmed + bounded
// server-side; Korean/Unicode text passes unchanged. NO slug, owner, account, or
// workspace field is part of the contract — the route rejects/ignores anything else.
// An absent or empty welcome normalizes to null (guest renders the default, no
// empty placeholder).
export const RoomSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  guestWelcomeMessage: z.string().trim().max(160, 'Welcome message is too long').optional(),
});
export type RoomSettingsInput = z.infer<typeof RoomSettingsSchema>;

// The DJ credential now travels in the Authorization header, not the body.
// 'move_next' (먼저 부르기) is a reorder, not a status change — handled separately.
export const DjActionSchema = z.object({
  action: z.enum(['play', 'complete', 'skip', 'remove', 'move_next']),
});
export type DjActionInput = z.infer<typeof DjActionSchema>;

// DJ reorders the waiting queue: the full waiting line in the DJ's desired order.
// Ids are the request UUIDs the DJ currently sees; the server re-validates them
// against the live waiting set (room-scoped) and appends any new arrivals. The
// cap bounds a single request; a real karaoke line never approaches it.
export const ReorderQueueSchema = z.object({
  orderedRequestIds: z.array(z.string().uuid()).min(1).max(200),
});
export type ReorderQueueInput = z.infer<typeof ReorderQueueSchema>;

// DJ adds a song on a guest's behalf. Same video fields as a guest request, but
// the guest name is OPTIONAL (defaults to "DJ" server-side). Auth is the DJ
// bearer, not a guest identity.
export const DjAddRequestSchema = z
  .object({
    guestName: z.string().trim().min(1).max(40).optional(),
    searchQuery: z.string().trim().max(MAX_QUERY_LEN).optional(),
    youtubeVideoId: z.string().trim().min(1).max(20).optional(),
    youtubeTitle: z.string().trim().max(300).optional(),
    youtubeChannelTitle: z.string().trim().max(200).optional(),
    youtubeThumbnailUrl: z.string().url().max(600).optional(),
    youtubeInput: z.string().trim().max(300).optional(),
  })
  .refine((v) => Boolean(v.youtubeVideoId || v.youtubeInput), {
    message: 'Select a song or paste a YouTube link',
    path: ['youtubeVideoId'],
  });
export type DjAddRequestInput = z.infer<typeof DjAddRequestSchema>;

// Admin sets / clears the current (or a queued) song's lyrics. Plain text only —
// bounded here; the server ALSO sanitizes (control chars, blank lines) before
// storing. An empty string is a valid "clear". NOT trimmed: internal line breaks
// and indentation are the lyrics. The generous bound covers a long song.
export const SetLyricsSchema = z.object({
  lyrics: z.string().max(MAX_LYRICS_LEN, 'Lyrics are too long'),
});
export type SetLyricsInput = z.infer<typeof SetLyricsSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Enter at least 2 characters').max(MAX_QUERY_LEN),
});

// iPad redeems a one-use pairing token (read from the pairing URL, sent in the
// body — never logged). Optional label lets the operator name the device.
export const PairRedeemSchema = z.object({
  token: z.string().trim().min(1).max(256),
  label: z.string().trim().max(60).optional(),
});
export type PairRedeemInput = z.infer<typeof PairRedeemSchema>;

// Admin mints a DJ pairing token; optional friendly label for the device.
export const PairMintSchema = z
  .object({ label: z.string().trim().max(60).optional() })
  .optional();

// Guest cancels their own request with the bounded capability issued at submit.
export const CancelRequestSchema = z.object({
  token: z.string().trim().min(1).max(512),
});
export type CancelRequestInput = z.infer<typeof CancelRequestSchema>;

// Guest starts / finishes their OWN song. Same bounded capability as cancel —
// it proves "this device submitted this request". The queue rules (first in
// line, single stage) are enforced server-side, not by the token.
export const OwnerActionSchema = z.object({
  token: z.string().trim().min(1).max(512),
});
export type OwnerActionInput = z.infer<typeof OwnerActionSchema>;

// BUILD 25 — owner-only retrieval of the Guest's OWN resolved requests.
//
// A BODY, not a query string: capability tokens must not travel in URLs, where they land in
// access logs, referrers, and browser history. Batched because both Guest clients poll a handful
// of their own requests at once; bounded at RESOLVED_MAX so the endpoint cannot be turned into a
// bulk reader. Note what is NOT accepted: no owner id, no guest name, no session id, and no event
// id — the server derives Event scope canonically, so a caller cannot name another Event's rows.
export const ResolvedRequestsSchema = z.object({
  items: z
    .array(
      z.object({
        requestId: z.string().trim().uuid(),
        token: z.string().trim().min(1).max(512),
      }),
    )
    .min(1)
    .max(50),
});
export type ResolvedRequestsInput = z.infer<typeof ResolvedRequestsSchema>;

// Admin PIN enrollment. `pin` is only bounded here; the real policy (NFC, no
// whitespace, ≥6 digits / ≥8 passphrase) is enforced server-side by normalizePin.
// Do NOT .trim() the pin — whitespace handling is the normalizer's job.
export const AdminSetupSchema = z.object({
  token: z.string().min(1).max(256),
  pin: z.string().min(1).max(128),
});
export const AdminEnrollSchema = z.object({
  pin: z.string().min(1).max(128),
});

// Slug-free admin device enrollment (mobile app). Same PIN field; an optional
// device label. The room is resolved server-side (sole-admin-PIN room).
export const AdminDeviceEnrollSchema = z.object({
  pin: z.string().min(1).max(128),
  deviceName: z.string().max(60).optional(),
});
export const AdminPinRotateSchema = z.object({
  pin: z.string().min(1).max(128),
});

// Manager (global operator) login — a single shared passcode exchanged for a
// signed session token. Bounded only here; the real check is constant-time.
export const ManagerLoginSchema = z.object({
  passcode: z.string().min(1).max(256),
});

// Manager (operator) manually assigns a Host plan (FREE ↔ PRO). accountId is the
// CANONICAL Host account; reason is mandatory (audited); idempotencyKey makes the
// operation replay-safe. planCode is a closed enum — anything else is rejected here
// before the RPC is ever reached.
export const HostPlanAssignSchema = z.object({
  accountId: z.string().uuid(),
  planCode: z.enum(['FREE', 'PRO']),
  reason: z.string().trim().min(1, 'Reason is required').max(300),
  idempotencyKey: z.string().trim().min(1).max(128),
});

// Manager creates an event. Name is required; host is optional. `startNow`
// starts the karaoke night immediately (defaults to true).
export const CreateEventSchema = z.object({
  name: z.string().trim().min(1, 'Event name is required').max(80),
  hostName: z.string().trim().max(80).optional(),
  startNow: z.boolean().optional(),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

// A FREE Host requests the PRO pilot from the native app. The account is ALWAYS
// derived server-side from the session — accountId is never accepted from the body.
// roomId is optional request context; if present it must be a Room the account owns.
// idempotencyKey makes a retried create return the same request (never a duplicate).
export const ProPilotRequestSchema = z.object({
  roomId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
});

// Manager approve/decline of a pending pilot request. A fresh idempotencyKey per
// decision attempt makes it replay-safe; reason is optional and audited when present.
export const ProPilotDecisionSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128),
  reason: z.string().trim().max(300).optional(),
});

// TIMED ACCESS PASS (BUILD 17). Fixed durations only — passType is a closed enum, so an
// arbitrary time can never be issued. accountId is the canonical account (Manager side).
export const TIMED_PASS_TYPES = ['ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS'] as const;

// Manager issues a pass. reason is optional (audited when present); idempotencyKey makes a
// retried issue return the same grant instead of a duplicate.
export const IssueTimedPassSchema = z.object({
  accountId: z.string().uuid(),
  passType: z.enum(TIMED_PASS_TYPES),
  reason: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
});

// Manager revokes an unused pass. A fresh idempotencyKey per attempt makes it replay-safe.
export const RevokeTimedPassSchema = z.object({
  reason: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
});

// Host selects a pass to use. The account is ALWAYS derived server-side from the session —
// never accepted from the body. idempotencyKey is optional (selection is naturally
// idempotent: re-selecting the same pass is a no-op).
export const SelectTimedPassSchema = z.object({
  passGrantId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

// BUILD 26M — switching from the RUNNING pass to another owned one. Same shape as selection
// (the account is derived from the session and is never accepted from the body); the endpoint
// differs because the outcome differs: switching FORFEITS the residual time on the active pass,
// so it must be a distinct, explicitly-confirmed action rather than a silent variant of select.
export const SwitchTimedPassSchema = z.object({
  passGrantId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

// BUILD 26E — permanent account deletion. The account is ALWAYS derived server-side from
// the session; there is deliberately NO accountId field, so a body-supplied one has
// nowhere to land even if a client sends it. `confirmation` must equal the exact
// destructive phrase, and `reauthenticatedAt` is the client's assertion of when the user
// last proved identity to a provider — bounded server-side, never trusted on its own.
export const DeleteAccountSchema = z.object({
  confirmation: z.string().trim().min(1).max(64),
  reauthenticatedAt: z.string().trim().min(1).max(64),
  csrf: z.string().trim().min(1).max(256).optional(),
  // BUILD 26E Apple revision: the NATIVE Sign in with Apple authorization code from the
  // deletion re-auth. Required for an Apple-linked account (the server checks, not the
  // client). Single-use, exchanged server-side only, never logged, never echoed back.
  appleAuthorizationCode: z.string().trim().min(1).max(2048).optional(),
});

// Apple StoreKit transaction verification (BUILD 26P, Track B Slice 3).
//
// The ONLY accepted input is the signed transaction itself. `.strict()` rejects every other key,
// which is what makes the trust boundary structural rather than a matter of care: there is no
// accountId, purchaseOwnerRef, appAccountToken, transactionId, productId, environment or bundleId
// to prefer over the verified payload, because none of them is accepted at all. The account comes
// from the session; every Apple fact comes from the JWS after its chain is verified.
export const VerifyAppleTransactionSchema = z
  .object({
    signedTransaction: z.string().trim().min(1).max(16384),
  })
  .strict();

// BUILD 26S-R1 — Apple paid fulfilment input.
//
// The ONLY accepted input is which durable purchase to settle. `.strict()` is doing the same job
// it does above, and here it matters more: this endpoint creates ENTITLEMENT. There is no
// accountId, durationSeconds, passType, productCode, sourceType, isPaid, grantStatus,
// passGrantId, actorType or Apple transaction identity to accept, because every one of those is
// derived inside the fulfilment transaction from rows the client cannot write. A caller can name
// a purchase; it can never describe what that purchase is worth.
export const FulfilApplePurchaseSchema = z
  .object({
    purchaseId: z.string().uuid(),
  })
  .strict();
