"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Locale = "en" | "ko";

type RoomState =
  | "pre_join"
  | "joined"
  | "closed_joined"
  | "closed"
  | "removed"
  | "inactive";

type Snapshot = {
  event: { title: string; status: "open" | "closed" } | null;
  participant: { display_name: string; joined_at: string } | null;
  room_state: RoomState;
};

type Copy = {
  eyebrow: string;
  enterName: string;
  namePlaceholder: string;
  join: string;
  joining: string;
  youreIn: string;
  roomGuide: string;
  closedTitle: string;
  closedBody: string;
  endedTitle: string;
  endedBody: string;
  removed: string;
  inactive: string;
  nameError: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    eyebrow: "FOUNDRY",
    enterName: "Enter your name to join.",
    namePlaceholder: "Your name",
    join: "Join event",
    joining: "Joining…",
    youreIn: "YOU’RE IN",
    roomGuide: "This room will guide today’s session.",
    closedTitle: "THIS EVENT IS CLOSED",
    closedBody: "New participants can no longer join.",
    endedTitle: "EVENT CLOSED",
    endedBody: "This session has ended.",
    removed: "Your access to this event has ended.",
    inactive: "This invitation is no longer active.",
    nameError: "Please enter your name.",
  },
  ko: {
    eyebrow: "FOUNDRY",
    enterName: "이름을 입력하고 입장하세요.",
    namePlaceholder: "이름",
    join: "입장하기",
    joining: "입장 중…",
    youreIn: "입장했습니다",
    roomGuide: "이 방이 오늘의 세션을 안내합니다.",
    closedTitle: "종료된 이벤트입니다",
    closedBody: "더 이상 새로 입장할 수 없습니다.",
    endedTitle: "이벤트가 종료되었습니다",
    endedBody: "이 세션은 끝났습니다.",
    removed: "이 이벤트에 대한 접근이 종료되었습니다.",
    inactive: "이 초대는 더 이상 유효하지 않습니다.",
    nameError: "이름을 입력해 주세요.",
  },
};

function resolveLocale(): Locale {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ko")) {
    return "ko";
  }
  return "en";
}

/** Fill-screen navy frame with safe-area padding. No nav, no login, no app chrome. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-[#0B1F3A] text-white antialiased"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6">{children}</div>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#C9A66B]/90">
      {children}
    </span>
  );
}

export default function FoundryJoinClient({ token }: { token: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState(false);
  const submittingRef = useRef(false);

  const t = COPY[locale];

  useEffect(() => {
    setLocale(resolveLocale());
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bty/foundry/public/${encodeURIComponent(token)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as Snapshot;
      setSnapshot(data);
    } catch {
      setSnapshot({ event: null, participant: null, room_state: "inactive" });
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onJoin = useCallback(async () => {
    if (submittingRef.current) return;
    if (name.trim().length < 1) {
      setNameError(true);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setNameError(false);
    try {
      const res = await fetch(`/api/bty/foundry/public/${encodeURIComponent(token)}/join`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setSnapshot({
          event: data.event ?? null,
          participant: data.participant ?? null,
          room_state: data.room_state ?? "joined",
        });
      } else if (data?.error === "name_required" || data?.error === "name_too_long") {
        setNameError(true);
      } else {
        // inactive / rotated / closed — reload the canonical snapshot for the right surface.
        await load();
      }
    } catch {
      await load();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [name, token, load]);

  // Quiet stable frame while the first snapshot resolves (no spinner, no flash).
  if (!loaded || !snapshot) {
    return (
      <Frame>
        <div aria-hidden className="flex-1" />
      </Frame>
    );
  }

  const title = snapshot.event?.title ?? "";
  const state = snapshot.room_state;

  if (state === "joined") {
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center gap-3">
          <Eyebrow>{t.youreIn}</Eyebrow>
          <h1 className="text-2xl font-semibold leading-snug text-white">{title}</h1>
          <p className="text-sm leading-6 text-white/60">{t.roomGuide}</p>
        </div>
      </Frame>
    );
  }

  if (state === "closed_joined") {
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center gap-3">
          <Eyebrow>{t.endedTitle}</Eyebrow>
          <h1 className="text-2xl font-semibold leading-snug text-white">{title}</h1>
          <p className="text-sm leading-6 text-white/60">{t.endedBody}</p>
        </div>
      </Frame>
    );
  }

  if (state === "closed") {
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center gap-3">
          <Eyebrow>{t.closedTitle}</Eyebrow>
          {title ? <h1 className="text-2xl font-semibold leading-snug text-white">{title}</h1> : null}
          <p className="text-sm leading-6 text-white/60">{t.closedBody}</p>
        </div>
      </Frame>
    );
  }

  if (state === "removed") {
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center">
          <p className="text-base leading-6 text-white/70">{t.removed}</p>
        </div>
      </Frame>
    );
  }

  if (state === "inactive") {
    return (
      <Frame>
        <div className="btyFadeIn flex flex-1 flex-col justify-center">
          <p className="text-base leading-6 text-white/70">{t.inactive}</p>
        </div>
      </Frame>
    );
  }

  // pre_join — the name form.
  return (
    <Frame>
      <div className="btyFadeIn flex flex-1 flex-col justify-center gap-5">
        <div className="flex flex-col gap-2">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="text-2xl font-semibold uppercase leading-snug tracking-wide text-white">
            {title}
          </h1>
          <p className="text-sm leading-6 text-white/60">{t.enterName}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onJoin();
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="text"
            inputMode="text"
            autoComplete="name"
            enterKeyHint="go"
            maxLength={60}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(false);
            }}
            placeholder={t.namePlaceholder}
            aria-label={t.namePlaceholder}
            aria-invalid={nameError}
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/35 outline-none focus:border-[#C9A66B]/60"
          />
          {nameError ? <p className="text-xs text-white/50">{t.nameError}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#C9A66B] px-4 py-3.5 text-base font-semibold text-[#0B1F3A] transition-opacity disabled:opacity-60"
          >
            {submitting ? t.joining : t.join}
          </button>
        </form>
      </div>
    </Frame>
  );
}
