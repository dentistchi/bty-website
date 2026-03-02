# 리더보드에서 타 유저 캐릭터(아바타)가 안 보일 때

## 증상
- 내 캐릭터만 리더보드에 보이고, 다른 유저는 기본 아이콘(실루엣)만 보임.

## 원인
리더보드 API가 `arena_profiles`에서 **모든 유저의 프로필**을 읽어와야 하는데, 아래 중 하나가 아니면 **본인 행만** 반환됩니다.

1. **서비스 역할 키 사용**  
   배포 환경(Cloudflare/Vercel 등)에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있으면, API가 admin 클라이언트로 조회해 RLS를 거치지 않고 모든 프로필을 가져옵니다.

2. **RLS 정책 적용**  
   서비스 역할 키를 쓰지 않는 경우, Supabase에 **리더보드용 SELECT 정책**이 있어야 합니다.  
   마이그레이션 `20260328000000_arena_profiles_leaderboard_select.sql`이 **프로덕션 DB에 적용**되어 있어야 합니다.

## 조치

### 1) 프로덕션 Supabase에 정책 적용

Supabase Dashboard → **SQL Editor**에서 아래를 **한 번만** 실행하세요.

```sql
-- 리더보드: 로그인한 사용자가 모든 arena_profiles 행을 읽을 수 있도록 허용
drop policy if exists "profiles_select_leaderboard" on public.arena_profiles;
create policy "profiles_select_leaderboard"
on public.arena_profiles for select
to authenticated
using (true);

comment on policy "profiles_select_leaderboard" on public.arena_profiles is
  'Allow any authenticated user to read all profiles for leaderboard display (avatar, code name, XP).';
```

적용 후 리더보드 페이지를 새로고침하면 타 유저 캐릭터가 보여야 합니다.

### 2) (선택) 서비스 역할 키로 통일

배포 환경 시크릿에 `SUPABASE_SERVICE_ROLE_KEY`를 넣어 두면, 위 RLS 정책 없이도 API가 admin으로 모든 프로필을 조회합니다.  
키는 Supabase Dashboard → Settings → API → `service_role` (secret)에서 복사합니다. **절대 클라이언트/프론트에 노출하지 마세요.**

### 3) 타 유저가 캐릭터를 설정했는지 확인

해당 유저가 Arena 대시보드에서 **캐릭터/테마를 저장**했는지 확인하세요. 저장하지 않았으면 기본 아이콘이 나오는 것이 맞습니다.

## 참고
- 마이그레이션 파일: `supabase/migrations/20260328000000_arena_profiles_leaderboard_select.sql`
- API: `bty-app/src/app/api/arena/leaderboard/route.ts` (profileClient = admin ?? supabase)
