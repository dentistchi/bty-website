// bty-app/scripts/extract-questions.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SRC = path.resolve("scripts/script.js");
const OUT_DIR = path.resolve("src/content/assessment");
const OUT = path.join(OUT_DIR, "questions.ko.json");

const code = fs.readFileSync(SRC, "utf8");

// script.js 안에서 questionDatabase를 찾아 VM으로 안전하게 평가해서 꺼내는 방식
// (script.js가 DOM을 바로 만지면 실패할 수 있어, 그 경우 아래 1-3 대안을 사용)
const sandbox = { console };
vm.createContext(sandbox);

function extractQuestionDatabase(jsText) {
  // questionDatabase = {...} 형태를 통째로 잡아낸다(대부분 이 구조)
  const m = jsText.match(/const\s+questionDatabase\s*=\s*(\{[\s\S]*?\n\});/);
  if (!m) throw new Error("questionDatabase 블록을 찾지 못했습니다.");

  const expr = m[1];
  const wrapped = `globalThis.__QDB__ = ${expr};`;
  vm.runInContext(wrapped, sandbox, { timeout: 1000 });

  const qdb = sandbox.__QDB__;
  if (!qdb) throw new Error("questionDatabase 평가 결과가 비었습니다.");
  return qdb;
}

const qdb = extractQuestionDatabase(code);

// qdb 구조 가정: { sections: [ { key, section, questions: [{id,text,reverse},...] }, ... ] }
// 혹은 key별 객체 등. 실제 구조에 맞춰 매핑은 아래에서 흡수한다.
function normalize(qdb) {
  // 1) sections 배열이 있으면 거기서 읽기
  if (Array.isArray(qdb.sections)) {
    const out = [];
    for (const sec of qdb.sections) {
      const dimension = sec.key; // core | compassion | stability | growth | social
      for (const q of sec.questions ?? []) {
        out.push({
          id: q.id,
          dimension,
          text: q.text,
          reverse: !!(q.reverse ?? q.reverse_scored),
        });
      }
    }
    return out.sort((a, b) => a.id - b.id);
  }

  // 2) core/compassion/... 키로 바로 들어있는 구조면
  const dims = ["core", "compassion", "stability", "growth", "social"];
  if (dims.some((k) => qdb[k])) {
    const out = [];
    for (const dim of dims) {
      const arr = qdb[dim]?.questions ?? qdb[dim] ?? [];
      for (const q of arr) {
        out.push({
          id: q.id,
          dimension: dim,
          text: q.text,
          reverse: !!(q.reverse ?? q.reverse_scored),
        });
      }
    }
    return out.sort((a, b) => a.id - b.id);
  }

  throw new Error("알려진 questionDatabase 구조가 아닙니다. normalize 규칙 추가 필요.");
}

const questions = normalize(qdb);

if (questions.length !== 50) {
  throw new Error(`문항 개수가 50이 아닙니다: ${questions.length}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(questions, null, 2), "utf8");

console.log(`[ok] wrote ${questions.length} questions -> ${OUT}`);
