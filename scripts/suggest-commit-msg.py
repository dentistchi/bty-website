#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent

def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return result.stdout.strip()

def classify(files: list[str]) -> tuple[str, str]:
    joined = " ".join(files).lower()

    if any(k in joined for k in ["middleware", "auth", "session", "login", "logout", "cookie"]):
        return ("fix", "auth")
    if any(k in joined for k in ["/api/", "src/app/api", "route.ts", "contract"]):
        return ("feat", "api")
    if any(k in joined for k in ["src/domain", "src/lib/bty", "xp", "season", "leaderboard", "avatar", "engine"]):
        return ("feat", "domain")
    if any(k in joined for k in ["src/app", "src/components", ".tsx", "loading", "skeleton", "aria", "render"]):
        return ("fix", "ui")
    if any(k in joined for k in ["docs/", ".md"]):
        return ("docs", "board")
    return ("chore", "misc")

def summarize(files: list[str]) -> str:
    if not files:
        return "update files"

    if len(files) == 1:
        return Path(files[0]).stem.replace("_", "-")

    top = files[0]
    if "leaderboard" in " ".join(files).lower():
        return "leaderboard"
    if "avatar" in " ".join(files).lower():
        return "avatar"
    if "center" in " ".join(files).lower():
        return "center"
    if "auth" in " ".join(files).lower():
        return "auth"
    return "multi-file update"

def main():
    changed = run(["git", "diff", "--name-only"])
    staged = run(["git", "diff", "--cached", "--name-only"])

    files = [f for f in (changed.splitlines() + staged.splitlines()) if f]
    # 중복 제거, 순서 유지
    unique_files = []
    seen = set()
    for f in files:
        if f not in seen:
            seen.add(f)
            unique_files.append(f)

    kind, scope = classify(unique_files)
    subject = summarize(unique_files)

    suggestions = [
        f"{kind}({scope}): {subject}",
        f"{kind}: {subject}",
        f"chore: update {subject}",
    ]

    print("COMMIT MESSAGE SUGGESTIONS")
    print("")
    for i, s in enumerate(suggestions, start=1):
        print(f"{i}. {s}")

    print("")
    print("CHANGED FILES")
    if unique_files:
        for f in unique_files:
            print(f"- {f}")
    else:
        print("- no unstaged or staged changes detected")

if __name__ == "__main__":
    main()
