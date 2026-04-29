/**
 * GET: Admin only.
 * - ?file=xxx.sql → migration 파일 내용 반환 (supabase/migrations/ 내부만, path traversal 방지).
 * - no query → migrations 폴더 내 .sql 파일 목록 반환.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function safeFilename(name: string): boolean {
  return /^[0-9a-zA-Z_.-]+\.sql$/.test(name) && !name.includes("..");
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const file = req.nextUrl.searchParams.get("file");

  try {
    if (!file) {
      const names = readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql")).sort();
      return NextResponse.json({ files: names });
    }

    if (!safeFilename(file)) {
      return NextResponse.json({ error: "INVALID_FILENAME" }, { status: 400 });
    }

    const content = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    return NextResponse.json({ file, content });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "READ_FAILED", detail: message }, { status: 500 });
  }
}
