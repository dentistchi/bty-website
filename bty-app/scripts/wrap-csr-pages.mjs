import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src/app");

// CSR bail-out 유발 훅들
const HOOK_RE =
  /\buseSearchParams\s*\(|\buseRouter\s*\(|\busePathname\s*\(|\buseParams\s*\(/;

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function ensureUseClientTop(code) {
  if (/^['"]use client['"];\s*/.test(code)) return code;
  return `'use client';\n\n${code}`;
}

function writeServerWrapper(serverPath) {
  const wrapper = `import { Suspense } from "react";
import ClientPage from "./page.client";

// CSR hook(useSearchParams/useRouter/...) 페이지는 정적 프리렌더 대상이 아니므로 동적 처리
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}
`;
  fs.writeFileSync(serverPath, wrapper, "utf8");
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error("Missing src/app");
    process.exit(1);
  }

  const pages = walk(ROOT).filter((p) => path.basename(p) === "page.tsx");

  const targets = [];
  for (const pagePath of pages) {
    const code = fs.readFileSync(pagePath, "utf8");

    // 이미 서버 래퍼면 스킵
    if (code.includes('import ClientPage from "./page.client"')) continue;

    // CSR hook이 없으면 스킵
    if (!HOOK_RE.test(code)) continue;

    targets.push(pagePath);
  }

  if (targets.length === 0) {
    console.log("No CSR-hook pages to wrap.");
    return;
  }

  console.log(`Wrapping ${targets.length} page(s):\n- ${targets.join("\n- ")}\n`);

  for (const serverPath of targets) {
    const dir = path.dirname(serverPath);
    const clientPath = path.join(dir, "page.client.tsx");

    const original = fs.readFileSync(serverPath, "utf8");

    // 기존에 page.client.tsx가 없으면 server 내용을 client로 이동
    if (!fs.existsSync(clientPath)) {
      fs.writeFileSync(clientPath, ensureUseClientTop(original), "utf8");
    } else {
      // 있으면 client는 유지(최소 안전)
      const existing = fs.readFileSync(clientPath, "utf8");
      fs.writeFileSync(clientPath, ensureUseClientTop(existing), "utf8");
    }

    // server wrapper 생성
    writeServerWrapper(serverPath);
  }

  console.log("Done.");
}

main();
