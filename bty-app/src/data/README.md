# BTY Chain Workspace

이 폴더는 BTY Arena용 체인 시나리오 작업공간입니다.

구조 원칙:
- 각 앵커 시나리오마다 폴더 1개
- 각 폴더 안에 노드 파일 3개
  - S1_anchor_seed.json
  - S2_consequence_seed.json
  - S3_identity_seed.json

권장 작업 흐름:
1. source_material의 압박/트레이드오프를 읽는다
2. S1에서 3명의 인간(avoid / structure / confront) 선택지를 만든다
3. S2에서 S1 선택이 만든 사회적 결과(오해, 평판, 거리감)를 만든다
4. S3에서 관계와 평판의 무게를 안고도 오늘 어떤 리더로 살 것인지 묻는다
5. 각 노드는 validator에 통과시킨다

중요:
- JSON 데이터와 validator/engine 코드는 분리한다
- 새 시나리오가 생길 때마다 `chains/<scenario_id>/` 폴더를 만들고
  동일하게 S1 / S2 / S3 파일 3개를 추가하면 된다
- 즉, "한 시나리오 = 파일 3개" 구조로 가면 된다
