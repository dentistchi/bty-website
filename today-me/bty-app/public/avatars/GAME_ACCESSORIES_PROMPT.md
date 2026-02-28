# 게임용 악세사리 이미지 생성 — 다른 Cursor 전달용

아래 지시문을 **복사해서 다른 Cursor 창에 붙여넣고** 실행하세요.  
옷(outfits)은 이미 그려져 있음. **게임용 악세사리만** 그리면 됨.

---

## 지시문 (전체 복사)

```
다음 경로에 게임용 악세사리 아이콘을 그려줘.

**저장 경로:** `today-me/bty-app/public/avatars/accessories/`

**규칙**
- 각 항목당 64x64 픽셀(또는 비슷한 정사각 비율) 아이콘 생성.
- 스타일: 단순한 플랫 아이콘 또는 실루엣. 배경은 투명(PNG) 또는 흰색.
- 게임/판타지 RPG 느낌으로 통일 (다크 톤 또는 밝은 포인트 컬러).
- 파일명은 아래 id와 동일하게 (예: sword.png, shield.png).

**그릴 목록 (게임용 악세사리 33개)**

1. sword — 검 (날 + 자루 + 가드)
2. shield — 방패 (전형적인 둥근/타워 실루엣)
3. crown — 왕관
4. ring — 반지
5. cloak — 망토
6. wings — 날개 한 쌍
7. halo — 후광/광环
8. bow — 활
9. staff — 지팡이/마법봉
10. potion — 물약 병
11. gem — 보석
12. coin — 동전
13. key — 열쇠
14. pet_cat — 고양이 (작은 펫 실루엣)
15. pet_dragon — 드래곤 (작은 펫 실루엣)
16. pet_dog — 개 (작은 펫 실루엣)
17. map — 지도/두루마리
18. compass — 나침반
19. lantern — 등불/랜턴
20. book — 책
21. scroll — 두루마리
22. amulet — 목걸이/부적
23. bracelet — 팔찌
24. boots — 부츠
25. helmet — 투구
26. gauntlet — 건틀릿(장갑)
27. dagger — 단검
28. wand — 마법봉(짧은)
29. rune — 룬 문자/돌
30. weapon — 일반 무기(검/도끼 등 하나)
31. hat — 모자(모험가 느낌)
32. glasses — 안경
33. accessory — 소형 악세사리(펜던트 등)
34. quiver — 화살통
35. belt — 허리띠/벨트

**출력 형식:** 각 id별로 이미지 파일 하나씩 생성해 `public/avatars/accessories/{id}.png` 경로에 저장. (기존 placeholder SVG가 있으면 같은 이름으로 PNG로 교체해도 됨.)
```

---

## 참고: 치과 악세사리 쪽

치과 악세사리는 **이 Cursor(현재 창)** 에서 별도로 그리므로, 위 지시문에서는 **게임용만** 처리하면 됨.
