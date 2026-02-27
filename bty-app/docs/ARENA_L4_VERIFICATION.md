# Arena L4 (Partner) 접근 검증

Admin이 `l4_access`를 부여한 뒤, 클라이언트에서 L4 시나리오가 보이는지 확인하는 절차.

---

## 1. Admin: L4 부여

**API:** `PATCH /api/admin/arena/l4-access`

- **인증:** Admin만 호출 가능 (BTY_ADMIN_EMAILS에 등록된 이메일).
- **Body:** `{ "userId": "<대상 사용자 uuid>", "l4_access": true }`

**예시 (curl):**

```bash
curl -X PATCH "https://<your-host>/api/admin/arena/l4-access" \
  -H "Content-Type: application/json" \
  -H "Cookie: <세션 쿠키>" \
  -d '{"userId":"<user-uuid>","l4_access":true}'
```

Supabase에서 해당 사용자의 `user_id`(auth.users.id)를 확인한 뒤 위 `userId`에 넣으면 된다.

---

## 2. 클라이언트 검증

1. **L4를 부여받은 계정으로 로그인**한다.
2. **Dashboard**로 이동한다.  
   - 경로: `/{locale}/bty/dashboard` (예: `/en/bty/dashboard`)
3. **"ARENA LEVELS" 카드**를 확인한다.
   - **Track:** leader
   - **Unlocked up to:** L4
   - **"✓ L4 (Partner) — admin-granted access. You can play Partner scenarios."** 문구가 보여야 한다.
   - **레벨 목록**에 L4: Partner (Board) 및 시나리오 개수가 표시된다.

이렇게 보이면 admin 부여 → API(`unlocked-scenarios`) → Dashboard 노출이 정상 동작한 것이다.

---

## 3. L4 해제

동일 API에 `"l4_access": false` 로 PATCH하면 된다.  
이후 해당 사용자 Dashboard에서는 Unlocked up to가 L3(또는 tenure 기준)로 바뀌고, L4 문구와 L4 레벨이 사라진다.

---

## 4. 참고

- L4 시나리오 **실제 플레이** UI(레벨/시나리오 선택 후 진행)는 Arena 메인 플로우(`/bty-arena`)와 별도로, 추후 프로그램 Arena(L1~L4) 전용 플로우에서 사용할 예정이다.
- 현재 검증 포인트: **Dashboard의 ARENA LEVELS 카드**에서 `maxUnlockedLevel === "L4"` 일 때 L4가 노출되는지이다.
