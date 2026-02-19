"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/read-json";

type OrganizationRow = {
  id: string;
  name: string;
  created_at: string | null;
};

type OrgsResp = { organizations?: OrganizationRow[] };

export default function AdminOrganizationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const r = await fetchJson<OrgsResp>("/api/admin/organizations");

      if (cancelled) return;

      if (!r.ok) {
        if (!cancelled) setError("조직 목록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setOrganizations(r.json?.organizations ?? []);
        setError(null);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Organizations</h1>
        <p className="mt-3 text-sm text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Organizations</h1>
        <p className="mt-3 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Organizations</h1>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Name</th>
              <th className="p-3">ID</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-medium">{o.name}</td>
                <td className="p-3 font-mono text-xs">{o.id}</td>
                <td className="p-3">{o.created_at ? new Date(o.created_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr>
                <td className="p-3" colSpan={3}>
                  조직이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
