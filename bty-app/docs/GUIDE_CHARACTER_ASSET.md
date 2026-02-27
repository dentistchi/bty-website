# 가이드 캐릭터 비주얼 — 에셋 1종 (Phase 1-3)

**목표**: Dr. Chi(가이드 캐릭터) 기본 일러스트/아바타 **1종**을 정하고, 챗봇·멘토에서 **공통 사용**한다.

---

## 1. 캐논(기본) 에셋 1종

| 용도 | 파일 경로 | 비고 |
|------|-----------|------|
| **기본 아바타** | `public/images/guide-character-default.png` | 차분한 미소. 챗봇·멘토 공통 기본값으로 사용. |
| **폴백** | `public/images/guide-character.png` | 위 파일 로드 실패 시 사용. 동일 캐릭터 권장. |

→ **에셋 1종** = 위 두 파일을 **같은 캐릭터(Dr. Chi)** 의 한 세트로 두고, 모든 UI에서 이 경로를 참조한다.

---

## 2. 상황별 변형 (선택)

동일 캐릭터의 표정/포즈만 바꾼 변형을 쓰려면 아래 경로를 사용한다.  
**캐논은 1종**이므로, 없으면 기본/폴백만 써도 된다.

| variant | 경로 | 사용처 |
|---------|------|--------|
| `default` | `public/images/guide-character-default.png` | 기본 대화 |
| `welcome` | `public/images/guide-character-welcome.png` | 환영/격려 (챗 첫 인사 등) |
| `warm` | `public/images/guide-character-warm.png` | 따뜻함 (멘토, Dear Me 톤) |

---

## 3. 코드에서 사용

- **컴포넌트**: `@/components/GuideCharacterAvatar`
- **챗봇**: `Chatbot.tsx` — 플로팅 버튼(닫힐 때)=`GuideCharacterAvatar`, 헤더·메시지에 이미지+「Dr. Chi」이름
- **멘토**: `bty/(protected)/mentor/page.client.tsx` — 헤더·대화 말풍선에 `GuideCharacterAvatar` 사용, 멘토는 `variant="warm"` 권장

```tsx
import { GuideCharacterAvatar } from "@/components/GuideCharacterAvatar";

<GuideCharacterAvatar variant="default" size="md" alt="Dr. Chi" />
```

---

## 4. 완료 기준 (Phase 1-3)

- [x] 캐논 에셋 1종 정의: `guide-character-default.png` + 폴백 `guide-character.png`
- [x] 챗봇에서 동일 컴포넌트·동일 경로 사용
- [x] 멘토에서 동일 컴포넌트·동일 경로 사용 (variant `warm`)
- [x] 문서화: 이 파일

에셋 파일을 교체할 때는 **위 경로의 파일만 교체**하면 챗봇·멘토 전반에 반영된다.
