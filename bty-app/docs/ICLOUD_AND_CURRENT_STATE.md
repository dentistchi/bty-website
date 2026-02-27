# iCloud 공유 폴더 · 현재 이 Mac 기준 정리

둘 다 맥이고 같은 폴더가 iCloud로 공유되므로, **어느 쪽에서 마지막으로 저장했는지**에 따라 이 Mac에 보이는 파일이 정해집니다. Git으로 커밋된 내용은 두 기기에서 동일하고, **커밋 안 한 변경**은 마지막에 저장한 기기 내용만 남습니다.

---

## 1. 이 Mac에서 지금 보이는 상태 (확인한 시점)

- **Git**: `main` 최신 커밋 `c5c2747` (End conversation in input area, Main nav everywhere) — 다른 Mac에서 푸시한 것과 동일.
- **수정된 파일 (이 Mac에서 변경됨)**  
  - `bty-app/src/app/api/auth/session/route.ts`  
  - `bty-app/src/app/api/mentor/route.ts`  
  - `bty-app/src/contexts/AuthContext.tsx`  
  - `bty-app/src/middleware.ts`  
  → 위는 이쪽 세션에서 수정한 내용이 반영된 상태입니다.
- **추가만 되고 커밋 안 된 파일**  
  - `docs/` 여러 개 (CHATBOT_TRAINING_CHECKLIST, CODEBASE_VS_DOCS_STATUS 등)  
  - `src/lib/bty/mentor/` (drChiCharacter.ts, mentorFewshotRouter.ts, 데이터셋 등)  
  - `src/lib/bty/arena/activityXp.ts`, `not-found.tsx` 등  
  → iCloud로 동기화돼 있다면 **다른 Mac에서 만든 파일이 이 Mac에도 보이는** 상태일 수 있습니다. 반대로, 이 Mac에서 만든 수정이 다른 Mac에 덮어쓴 상태일 수도 있습니다.

즉, **“다른 Mac에서만 있고 이 Mac에는 없다”**라고 단정할 수는 없고, **지금 이 Mac 폴더에 있는 내용 = iCloud 기준으로 최종 반영된 내용**입니다.

---

## 2. 코드 기준으로 본 “다른 Mac 작업” 반영 여부

- **멘토 훈련용 자료**  
  - `src/lib/bty/mentor/` 아래에  
    - `drChiCharacter.ts`  
    - `mentorFewshotRouter.ts` (주제별 few-shot 번들)  
    - `mentor_training_dataset_v1.json`, `drChiExamples.json`  
  이 **이 Mac에도 존재**합니다.  
  - 다만 **멘토 API**(`api/mentor/route.ts`)는 아직 **이걸 쓰지 않고**  
    - `GEMINI_API_KEY` 있으면 **Gemini 먼저**  
    - 없거나 실패하면 **OpenAI**  
  로만 동작합니다.  
  → “다른 Mac에서 많이 훈련시켰다”는 게 이 라이브러리라면, **파일은 이 Mac에 있지만 API에 연결돼 있지 않은 상태**입니다.
- **챗**  
  - `api/chat/route.ts`는 이미 **OpenAI만** 사용합니다 (Gemini 없음).

---

## 3. 배포 실패 (스크린샷 기준)

- **#254** (c5c2747), **#253** (4e52fc2) 두 번 모두 **Cloudflare Workers (OpenNext)** 배포 실패.
- push는 `dentistchi`가 했고, **자동 배포(CI/CD)** 가 main 푸시 시 실행된 것으로 보입니다.  
  “왜 배포했는지 모르겠다”면, **연동된 저장소에서 main에 push할 때마다 배포가 트리거**되도록 설정돼 있을 가능성이 큽니다.

---

## 4. “다른 Mac 작업을 기준으로 진행”하려면

- **이 Mac에 새로 저장된(iCloud로 공유된) 파일**만 따로 “이것만 다른 Mac 것이다”라고 구분하는 건 **불가능**합니다.  
  - iCloud는 “동기화”만 하므로, **현재 이 폴더에 보이는 파일 = 두 Mac 중 하나가 마지막으로 저장한 공통 상태**입니다.
- 대신 다음은 할 수 있습니다.  
  1. **지금 이 Mac에 있는 코드/문서를 기준**으로,  
     - 멘토·챗 모두 **OpenAI만 쓰도록** 통일하고  
     - 멘토는 `drChiCharacter` / `mentorFewshotRouter` 를 쓰도록 API를 연결하는 식으로 **“다른 Mac에서 하기로 한 방향”에 맞추기**.  
  2. **배포**는 원하면 main 푸시 시 자동 배포를 끄거나, 배포 전에 로컬/스테이징에서만 확인하도록 설정을 바꿀 수 있습니다.

**적용함:** 멘토 API에서 Gemini 호출을 제거하고 **OpenAI만** 사용하도록 수정했습니다. 챗은 원래 OpenAI만 사용 중이므로, 이제 **챗·멘토 모두 OpenAI 전용**입니다. `.env.local`에는 `OPENAI_API_KEY`만 있으면 됩니다 (Gemini 키 불필요).
