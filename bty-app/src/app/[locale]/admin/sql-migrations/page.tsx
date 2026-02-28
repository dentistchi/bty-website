"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ListResp = { files: string[]; error?: string };
type ContentResp = { file: string; content: string; error?: string };

export default function AdminSqlMigrationsPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/sql-migrations", { credentials: "include" });
      const data: ListResp = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((data as { error?: string }).error ?? `HTTP ${r.status}`);
        setFiles([]);
        return;
      }
      const list = Array.isArray((data as { files?: string[] }).files) ? (data as { files: string[] }).files : [];
      setFiles(list);
      if (list.length > 0 && !selected) setSelected(list[list.length - 1]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selected) {
      setContent("");
      return;
    }
    let alive = true;
    setContentLoading(true);
    setError(null);
    fetch(`/api/admin/sql-migrations?file=${encodeURIComponent(selected)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: ContentResp) => {
        if (!alive) return;
        if (data.error) {
          setError(data.error);
          setContent("");
        } else {
          setContent(typeof data.content === "string" ? data.content : "");
        }
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load content");
        setContent("");
      })
      .finally(() => {
        if (alive) setContentLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  const copyToClipboard = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(
      () => {
        setCopyDone(true);
        setTimeout(() => setCopyDone(false), 2000);
      },
      () => setError("Copy failed")
    );
  }, [content]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">SQL 마이그레이션 복사</h1>
          <p className="mt-1 text-sm text-neutral-600">
            파일을 고른 뒤 [복사] 버튼으로 클립보드에 넣고, 에디터(Supabase SQL 등)에서 실행하세요.
          </p>
        </div>
        <Link href="/admin/debug" className="text-sm text-neutral-600 underline hover:text-neutral-900">
          디버깅
        </Link>
      </div>

      {loading && <p className="text-sm text-neutral-600">목록 불러오는 중…</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!loading && files.length > 0 && (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">파일 선택</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full max-w-md rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              {files.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {contentLoading && <p className="text-sm text-neutral-600">내용 불러오는 중…</p>}

          {!contentLoading && content && (
            <div className="rounded border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <span className="text-sm font-medium text-neutral-700">{selected}</span>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  {copyDone ? "복사됨" : "복사"}
                </button>
              </div>
              <pre className="max-h-[60vh] overflow-auto p-4 text-left text-xs leading-relaxed text-neutral-800 whitespace-pre-wrap break-all">
                {content}
              </pre>
            </div>
          )}
        </div>
      )}

      {!loading && files.length === 0 && !error && (
        <p className="text-sm text-neutral-600">마이그레이션 파일이 없습니다.</p>
      )}

      <div className="mt-6 rounded border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <p>
          <Link href="/admin/arena-membership" className="underline hover:text-neutral-900">Arena 멤버십 승인</Link>
          {" · "}
          <Link href="/admin/quality" className="underline hover:text-neutral-900">Quality</Link>
        </p>
      </div>
    </div>
  );
}
