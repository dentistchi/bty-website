"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/read-json";

type User = {
  id: string;
  email: string;
  createdAt: number;
};

type UsersResp = { users?: User[]; error?: string };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchJson<UsersResp>("/api/admin/users");
      if (r.ok) {
        setUsers(r.json?.users ?? []);
      } else {
        setError(r.json?.error ?? r.raw?.slice(0, 200) ?? "사용자 목록을 불러올 수 없습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createPassword || createPassword.length < 6) {
      setError("이메일과 비밀번호(6자 이상)를 입력해주세요.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const r = await fetchJson<{ error?: string }>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: createEmail, password: createPassword }),
      });
      if (r.ok) {
        setCreateEmail("");
        setCreatePassword("");
        setShowCreateForm(false);
        await fetchUsers();
      } else {
        setError(r.json?.error ?? r.raw?.slice(0, 200) ?? "사용자 생성에 실패했습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`정말로 ${email} 사용자를 삭제하시겠습니까?`)) return;
    setError(null);
    try {
      const r = await fetchJson<{ error?: string }>(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      if (r.ok) {
        await fetchUsers();
      } else {
        setError(r.json?.error ?? r.raw?.slice(0, 200) ?? "사용자 삭제에 실패했습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    }
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setError(null);
    try {
      const r = await fetchJson<{ error?: string }>("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, password: newPassword }),
      });
      if (r.ok) {
        setEditingUserId(null);
        setNewPassword("");
        alert("비밀번호가 변경되었습니다.");
      } else {
        setError(r.json?.error ?? r.raw?.slice(0, 200) ?? "비밀번호 변경에 실패했습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">사용자 관리</h1>
          <p className="mt-1 text-sm text-neutral-600">
            일반 사용자 계정을 생성, 수정, 삭제할 수 있습니다.
          </p>
        </div>
        <Link
          href="/admin/quality"
          className="text-sm text-neutral-600 hover:text-neutral-900 underline"
        >
          Quality Events로 돌아가기
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {showCreateForm ? "취소" : "+ 새 사용자 생성"}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-3 text-lg font-medium text-neutral-900">새 사용자 생성</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700">이메일</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">비밀번호</label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                placeholder="6자 이상"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {creating ? "생성 중..." : "생성"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-neutral-600">로딩 중...</div>
      ) : users.length === 0 ? (
        <div className="rounded border border-neutral-200 bg-white p-8 text-center text-neutral-600">
          등록된 사용자가 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-700">
                  이메일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-700">
                  생성일
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-700">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm text-neutral-900">{user.email}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {new Date(user.createdAt).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {editingUserId === user.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="새 비밀번호"
                          className="rounded border border-neutral-300 px-2 py-1 text-xs focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdatePassword(user.id)}
                          className="rounded bg-neutral-900 px-2 py-1 text-xs text-white hover:bg-neutral-800"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(null);
                            setNewPassword("");
                          }}
                          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingUserId(user.id)}
                          className="text-xs text-neutral-600 hover:text-neutral-900 underline"
                        >
                          비밀번호 변경
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user.id, user.email)}
                          className="text-xs text-red-600 hover:text-red-800 underline"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        <p className="font-semibold mb-1">⚠️ 참고사항</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>사용자 관리는 Supabase Auth를 사용합니다.</li>
          <li>목록·생성·삭제·비밀번호 변경은 Supabase 대시보드에서도 가능합니다.</li>
        </ul>
      </div>
    </div>
  );
}
