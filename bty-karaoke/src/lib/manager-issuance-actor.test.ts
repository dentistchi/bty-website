// BUILD 26O — what the server may claim about who issued a pass.
//
// The manager session is deliberately anonymous: `signManagerSession` mints `{ m: 1, e: expiry }`
// and `managerAuthorized` returns a boolean. There is no account, no email, no operator row, and
// no session record anywhere in this path. So the ONLY honest attribution is "a valid shared
// manager credential was presented", plus enough to tell one session from another.
//
// These tests exist to stop that honesty eroding in either direction: by recording too little
// (an unattributed grant) or by recording a person the server never authenticated.

import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { managerIssuanceActor, MANAGER_ACTOR_ID, MANAGER_COOKIE } from './manager-auth.server';
import { sha256Hex } from './dj-auth.server';

/** A request carrying only what a real one carries here: the manager cookie. */
function reqWithCookie(token: string | null): NextRequest {
  return {
    cookies: { get: (n: string) => (n === MANAGER_COOKIE && token !== null ? { value: token } : undefined) },
  } as unknown as NextRequest;
}

describe('managerIssuanceActor', () => {
  it('records the credential CLASS, never a person', async () => {
    const a = await managerIssuanceActor(reqWithCookie('tok.sig'), 'manager_issue');
    expect(a).not.toBeNull();
    expect(a!.actor_kind).toBe('shared_manager_credential');
    expect(a!.actor_id).toBe(MANAGER_ACTOR_ID);
    expect(a!.version).toBe(1);
    expect(a!.source).toBe('manager_issue');
  });

  it('invents no human identity — no name, email, or account anywhere in the document', async () => {
    const a = await managerIssuanceActor(reqWithCookie('tok.sig'), 'manager_issue');
    const keys = Object.keys(a!);
    for (const forbidden of ['email', 'name', 'manager_name', 'employee', 'human', 'account_id', 'user_id', 'person']) {
      expect(keys).not.toContain(forbidden);
    }
    // And nothing that merely LOOKS like one leaked into the values.
    const serialized = JSON.stringify(a).toLowerCase();
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('chi');
    expect(serialized).not.toContain('founder');
    expect(serialized).not.toContain('admin');
  });

  it('the actor value is unchanged from the pre-26O literal, so old and new grants compare', async () => {
    const a = await managerIssuanceActor(reqWithCookie('tok.sig'), 'manager_issue');
    expect(a!.actor_id).toBe('bty_mgr');
  });

  it('carries a session fingerprint that distinguishes two sessions', async () => {
    const one = await managerIssuanceActor(reqWithCookie('session-one'), 'manager_issue');
    const two = await managerIssuanceActor(reqWithCookie('session-two'), 'manager_issue');
    expect(one!.session_fp).not.toBe(two!.session_fp);
  });

  it('is stable within one session, so a burst of issues is provably ONE session', async () => {
    // This is the exact question BUILD 26M could not answer about 15 grants in 11 seconds.
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => managerIssuanceActor(reqWithCookie('same-session'), 'manager_issue')),
    );
    expect(new Set(burst.map((b) => b!.session_fp)).size).toBe(1);
  });

  it('the fingerprint is a truncated SHA-256 of the token — never the token itself', async () => {
    const token = 'super-secret.session-token';
    const a = await managerIssuanceActor(reqWithCookie(token), 'manager_issue');
    expect(a!.session_fp).toBe((await sha256Hex(token)).slice(0, 16));
    expect(a!.session_fp).toHaveLength(16);
    expect(a!.session_fp).toMatch(/^[0-9a-f]{16}$/);
    // The credential must not be recoverable from, or present in, the record.
    expect(JSON.stringify(a)).not.toContain(token);
    expect(JSON.stringify(a)).not.toContain('super-secret');
  });

  it('no passcode or raw token appears anywhere in the document', async () => {
    const a = await managerIssuanceActor(reqWithCookie('passcode-shaped-value'), 'manager_issue');
    const serialized = JSON.stringify(a);
    expect(serialized).not.toContain('passcode');
    expect(serialized).not.toContain('passcode-shaped-value');
  });

  it('returns null with no cookie, so the caller must refuse rather than guess', async () => {
    expect(await managerIssuanceActor(reqWithCookie(null), 'manager_issue')).toBeNull();
  });

  it('takes its source from the SERVER argument, and reads nothing from a body', async () => {
    const a = await managerIssuanceActor(reqWithCookie('t'), 'some_other_route');
    expect(a!.source).toBe('some_other_route');
    // The helper's signature has no body parameter at all — attribution cannot be influenced by
    // a payload because a payload is not an input. Pinned as arity so a future third parameter
    // is a deliberate decision rather than an accident.
    expect(managerIssuanceActor.length).toBe(2);
  });
});
