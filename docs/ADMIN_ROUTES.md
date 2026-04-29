# Admin 경로 정리

배포 URL 기준: `https://bty-website.ywamer2022.workers.dev`

## 경로 요약

| 경로 | 용도 |
|------|------|
| **/admin/login** | 관리자 로그인 (이메일·비밀번호). 로그인 후 `/admin/debug` 등으로 이동 |
| **/admin/arena-membership** | **Arena 멤버십 승인** — pending 요청 목록 + [승인] 버튼. **승인은 여기서 합니다.** |
| **/admin/users** | 사용자 관리 (목록·추가·수정·삭제) |
| **/admin/organizations** | 조직 목록. 쿼리 없이 호출 시 Admin 이메일 허용 목록(BTY_ADMIN_EMAILS)으로 전체 목록 조회. `organizations` 테이블이 없으면 오류 표시 |
| **/admin/debug** | 디버깅 (에러 제보, 제보 목록, 패치 배포 등) |
| **/admin/quality** | Quality Events |
| **/admin** | 접속 시 `/admin/debug`로 리다이렉트 |

## 승인(approval)이 있는 곳

- **Arena 멤버십 승인**: `/admin/arena-membership`  
  - 유저가 Arena 가입 시 직군·입사일·리더시작일 제출 → 상태가 **pending**  
  - 관리자가 이 페이지에서 목록을 보고 **[승인]** 클릭 → `approved`로 변경, tenure 반영  
  - 사용자 관리(`/admin/users`)에는 승인 기능이 없음.

## 네비게이션

- Admin 로그인 후 상단/레이아웃에서 **Arena 승인**, **사용자 관리**, **디버깅** 등 링크로 이동 가능.  
- “승인하는 곳이 안 보인다”면 **Arena 승인** (= `/admin/arena-membership`) 메뉴를 사용하면 됨.

## 404 (페이지를 찾을 수 없습니다)가 나올 때

- `/en/admin/arena-membership` 접속 시 **페이지를 찾을 수 없습니다**가 나오면, 배포 빌드에 해당 라우트가 아직 반영되지 않았을 수 있음.
- **조치**: `main`에 최신 코드 푸시 후 GitHub Actions에서 배포가 끝날 때까지 대기한 뒤, 다시 접속.
- Admin 레이아웃은 로그인/권한 없을 때 `/${locale}/admin/login`(예: `/en/admin/login`)으로 리다이렉트하므로, 로그인 후 **Arena 승인** 링크로 이동하면 됨.
