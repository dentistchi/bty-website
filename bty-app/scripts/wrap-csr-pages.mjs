import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src/app");

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
  // 이미 있으면 그대로
  if (/^['"]use client['"];\s*/.test(code)) return code;
  return `'use client';\n\n${code}`;
}

function writeServerWrapper(serverPath, relativeClientImport) {
  const wrapper = `import { Suspense } from "react";
import ClientPage from "${relativeClientImport}";

// CSR bail-out hooks(useSearchParams/useRouter/...) 사용 페이지는 정적 프리렌더 대상이 아니므로 동적 처리
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

  const files = walk(ROOT).filter((p) => path.basename(p) === "page.tsx");

  const targets = [];
  for (const f of files) {
    const code = fs.readFileSync(f, "utf8");

    // 이미 server wrapper면 스킵 (ClientPage import + Suspense 형태)
    if (code.includes('import ClientPage from "./page.client"')) continue;

    // hook이 들어간 page만 변환
    if (!HOOK_RE.test(code)) continue;

    targets.push(f);
  }

  if (targets.length === 0) {
    console.log("No pages to wrap.");
    return;
  }

  console.log(`Found ${targets.length} page(s) to wrap:\n- ${targets.join("\n- ")}`);

  for (const serverPath of targets) {
    const dir = path.dirname(serverPath);
    const clientPath = path.join(dir, "page.client.tsx");

    // 1) 기존 page.tsx 내용을 client로 이동/병합
    const serverCode = fs.readFileSync(serverPath, "utf8");
    if (!fs.existsSync(clientPath)) {
      fs.writeFileSync(clientPath, ensureUseClientTop(serverCode), "utf8");
    } else {
      // 이미 client가 있으면 server 내용을 덮지 않고, server를 wrapper로만 교체
      // (안전하게 기존 client 유지)
      const existing = fs.readFileSync(clientPath, "utf8");
      fs.writeFileSync(clientPath, ensureUseClientTop(existing), "utf8");
    }

    // 2) server wrapper 생성
    writeServerWrapper(serverPath, "./page.client");
  }

  console.log("Done wrapping pages.");
}

main();
