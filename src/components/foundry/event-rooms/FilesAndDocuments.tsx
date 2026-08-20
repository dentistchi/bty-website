"use client";

import { ManagerCanvas } from "./ManagerCanvas";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ModuleBuilderCopy } from "./moduleBuilderCopy";
import type { ClientAsset } from "@/lib/bty/foundry/events/moduleClient";

/**
 * Files and documents — multi-format draft attachments (Slice 2.1.2).
 *
 * One multi-select, but each file uploads in its OWN request (bounded bodies,
 * per-file progress, per-file retry, and one invalid file never discards the
 * valid ones). Images show a safe local thumbnail while uploading. All validation
 * and storage is server-authoritative; this component only orchestrates the UI.
 */

const DOC_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.md";
const IMG_ACCEPT = "image/jpeg,image/png,image/heic,image/heif,image/webp";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Upload = { localId: string; name: string; size: number; file: File; state: "uploading" | "error"; reason?: string; thumb?: string };

export function FilesAndDocuments({
  draftId,
  assets,
  onAssetsChange,
  onBusyChange,
  t,
}: {
  draftId: string;
  assets: ClientAsset[];
  onAssetsChange: React.Dispatch<React.SetStateAction<ClientAsset[]>>;
  onBusyChange: (busy: boolean) => void;
  t: ModuleBuilderCopy;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);

  const busy = uploads.some((u) => u.state === "uploading") || removing.size > 0;
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const errMessage = useCallback(
    (reason?: string) =>
      reason === "unsupported_file_type" ? t.errUnsupported : reason === "file_too_large" ? t.errTooLarge : t.errGeneric,
    [t],
  );

  const uploadOne = useCallback(
    async (localId: string, file: File) => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/bty/foundry/modules/${draftId}/assets`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          body: fd,
        });
        const data = (await res.json().catch(() => null)) as { asset?: ClientAsset; error?: string } | null;
        if (res.ok && data?.asset) {
          onAssetsChange((prev) => [...prev, data.asset as ClientAsset]);
          setUploads((prev) => {
            const gone = prev.find((u) => u.localId === localId);
            if (gone?.thumb) URL.revokeObjectURL(gone.thumb);
            return prev.filter((u) => u.localId !== localId);
          });
        } else {
          setUploads((prev) => prev.map((u) => (u.localId === localId ? { ...u, state: "error", reason: data?.error } : u)));
        }
      } catch {
        setUploads((prev) => prev.map((u) => (u.localId === localId ? { ...u, state: "error", reason: "network" } : u)));
      }
    },
    [draftId, onAssetsChange],
  );

  const onFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list);
      // Upload each file sequentially in its own request.
      for (const file of files) {
        const localId = `u${seq.current++}`;
        const thumb = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        setUploads((prev) => [...prev, { localId, name: file.name, size: file.size, file, state: "uploading", thumb }]);
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(localId, file);
      }
    },
    [uploadOne],
  );

  const retry = useCallback(
    (localId: string) => {
      const u = uploads.find((x) => x.localId === localId);
      if (!u) return;
      setUploads((prev) => prev.map((x) => (x.localId === localId ? { ...x, state: "uploading", reason: undefined } : x)));
      void uploadOne(localId, u.file);
    },
    [uploads, uploadOne],
  );

  const dismiss = useCallback((localId: string) => {
    setUploads((prev) => {
      const gone = prev.find((u) => u.localId === localId);
      if (gone?.thumb) URL.revokeObjectURL(gone.thumb);
      return prev.filter((u) => u.localId !== localId);
    });
  }, []);

  const remove = useCallback(
    async (assetId: string) => {
      setRemoving((prev) => new Set(prev).add(assetId));
      try {
        const res = await fetch(`/api/bty/foundry/modules/${draftId}/assets/${assetId}`, {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) onAssetsChange((prev) => prev.filter((a) => a.id !== assetId));
      } catch {
        /* keep the asset visible on failure */
      } finally {
        setRemoving((prev) => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        });
      }
    },
    [draftId, onAssetsChange],
  );

  useEffect(
    () => () => {
      uploads.forEach((u) => u.thumb && URL.revokeObjectURL(u.thumb));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    /*
      R4-R4B — document work gets the most room of any Manager surface. A 100-page PDF is real
      work, and its attachment list, page count and preview controls were being managed inside a
      column sized for a sentence.
    */
    <ManagerCanvas width="workspace" className="flex flex-col gap-3" testId="files-and-documents">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">{t.filesHeader}</span>
        <p className="text-sm leading-6 text-white/55">{t.filesLead}</p>
      </div>

      <input ref={docInputRef} type="file" accept={DOC_ACCEPT} multiple aria-label={t.attachFiles} onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} className="sr-only" />
      <input ref={imgInputRef} type="file" accept={IMG_ACCEPT} multiple aria-label={t.addPhoto} onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} className="sr-only" />

      <div className="flex flex-wrap gap-2.5 md:gap-3">
        <button type="button" onClick={() => docInputRef.current?.click()} className="rounded-xl border border-[#C9A66B]/50 bg-[#C9A66B]/10 px-4 py-2.5 text-sm font-semibold text-[#C9A66B]">
          {t.attachFiles}
        </button>
        <button type="button" onClick={() => imgInputRef.current?.click()} className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/80">
          {t.addPhoto}
        </button>
      </div>

      {(assets.length > 0 || uploads.length > 0) && (
        <div className="flex flex-col gap-2">
          {assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[0.95rem] font-medium text-white/90">{a.filename}</span>
                <span className="text-xs text-white/45">
                  {formatBytes(a.byte_size)} · {t.assetAttached}
                  {a.participant_delivery_ready ? ` · ${t.deliveryReady}` : ""}
                </span>
              </div>
              <button type="button" onClick={() => remove(a.id)} disabled={removing.has(a.id)} className="shrink-0 text-sm text-white/50 disabled:opacity-50">
                {t.assetRemove}
              </button>
            </div>
          ))}
          {uploads.map((u) => (
            <div key={u.localId} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {u.thumb ? <img src={u.thumb} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : null}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[0.95rem] font-medium text-white/85">{u.name}</span>
                  <span className={`text-xs ${u.state === "error" ? "text-amber-300/80" : "text-white/45"}`}>
                    {u.state === "uploading" ? `${formatBytes(u.size)} · ${t.assetUploading}` : errMessage(u.reason)}
                  </span>
                </div>
              </div>
              {u.state === "error" ? (
                <div className="flex shrink-0 items-center gap-3">
                  {u.reason === "unsupported_file_type" || u.reason === "file_too_large" ? null : (
                    <button type="button" onClick={() => retry(u.localId)} className="text-sm text-[#C9A66B]">
                      {t.retry}
                    </button>
                  )}
                  <button type="button" onClick={() => dismiss(u.localId)} className="text-sm text-white/40">
                    {t.assetRemove}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </ManagerCanvas>
  );
}
