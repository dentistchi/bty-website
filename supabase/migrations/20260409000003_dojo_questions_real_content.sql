-- Dojo 50문항 실제 콘텐츠 투입 (DOJO_DEAR_ME_DB_NEXT_PHASE_DESIGN §2-4).
-- 기존 플레이스홀더 "문항 N" → 실제 한국어·영어 문항 텍스트로 UPDATE.
-- 5영역 × 10문항 = 50건. 5단계 리커트. scale_type=likert_5 유지.

-- perspective_taking (역지사지) 1–10
update public.dojo_questions set text_ko = '상대방의 입장에서 상황을 바라보려 노력한다', text_en = 'I try to see the situation from the other person''s perspective' where id = 1;
update public.dojo_questions set text_ko = '다른 사람의 감정을 이해하려 한다', text_en = 'I try to understand other people''s feelings' where id = 2;
update public.dojo_questions set text_ko = '의견이 다를 때 상대의 이유를 먼저 생각해 본다', text_en = 'When opinions differ, I first consider the other person''s reasoning' where id = 3;
update public.dojo_questions set text_ko = '갈등 상황에서 상대가 왜 그렇게 행동했는지 생각한다', text_en = 'In conflicts, I think about why the other person acted that way' where id = 4;
update public.dojo_questions set text_ko = '나와 다른 배경을 가진 사람의 시각을 존중한다', text_en = 'I respect the perspectives of people with different backgrounds' where id = 5;
update public.dojo_questions set text_ko = '상대방의 말을 들을 때 그 사람의 처지를 떠올린다', text_en = 'When listening, I consider what the speaker might be going through' where id = 6;
update public.dojo_questions set text_ko = '내 행동이 다른 사람에게 어떤 영향을 줄지 미리 생각한다', text_en = 'I think ahead about how my actions might affect others' where id = 7;
update public.dojo_questions set text_ko = '다른 사람의 실수에도 이유가 있을 수 있다고 생각한다', text_en = 'I consider that others'' mistakes may have reasons behind them' where id = 8;
update public.dojo_questions set text_ko = '상대의 입장이 되어 보는 연습을 의식적으로 한다', text_en = 'I consciously practice putting myself in others'' shoes' where id = 9;
update public.dojo_questions set text_ko = '비판하기 전에 상대의 상황을 먼저 파악하려 한다', text_en = 'Before criticizing, I try to understand the other person''s situation first' where id = 10;

-- communication (소통·경청) 11–20
update public.dojo_questions set text_ko = '대화할 때 상대의 말을 끝까지 듣는다', text_en = 'I listen to the end when someone is speaking' where id = 11;
update public.dojo_questions set text_ko = '상대의 이야기에 진심으로 관심을 보인다', text_en = 'I show genuine interest in what others are saying' where id = 12;
update public.dojo_questions set text_ko = '내 의견을 명확하고 차분하게 전달한다', text_en = 'I express my opinions clearly and calmly' where id = 13;
update public.dojo_questions set text_ko = '피드백을 받으면 방어하지 않고 열린 마음으로 수용한다', text_en = 'I receive feedback with an open mind, without becoming defensive' where id = 14;
update public.dojo_questions set text_ko = '대화 중 상대가 불편해 보이면 알아차린다', text_en = 'I notice when someone seems uncomfortable during a conversation' where id = 15;
update public.dojo_questions set text_ko = '상대의 말을 요약하거나 되묻기를 통해 확인한다', text_en = 'I confirm understanding by summarizing or asking follow-up questions' where id = 16;
update public.dojo_questions set text_ko = '어려운 주제도 회피하지 않고 이야기할 수 있다', text_en = 'I can discuss difficult topics without avoiding them' where id = 17;
update public.dojo_questions set text_ko = '내 감정을 적절한 말로 표현할 수 있다', text_en = 'I can express my emotions in appropriate words' where id = 18;
update public.dojo_questions set text_ko = '비언어적 신호(표정, 몸짓)에도 주의를 기울인다', text_en = 'I pay attention to nonverbal cues like facial expressions and gestures' where id = 19;
update public.dojo_questions set text_ko = '상대가 말하는 동안 미리 반박을 준비하지 않는다', text_en = 'I don''t prepare rebuttals while the other person is still speaking' where id = 20;

-- leadership (리더십·책임) 21–30
update public.dojo_questions set text_ko = '팀에서 해야 할 일이 보이면 먼저 나선다', text_en = 'When I see something that needs doing, I step up first' where id = 21;
update public.dojo_questions set text_ko = '내가 맡은 일에 대해 끝까지 책임진다', text_en = 'I take full responsibility for the tasks I commit to' where id = 22;
update public.dojo_questions set text_ko = '다른 사람의 강점을 파악하고 적절히 역할을 나눈다', text_en = 'I identify others'' strengths and delegate roles accordingly' where id = 23;
update public.dojo_questions set text_ko = '어려운 결정을 내릴 때 주저하지 않는다', text_en = 'I don''t hesitate when making difficult decisions' where id = 24;
update public.dojo_questions set text_ko = '실수했을 때 변명하지 않고 인정한다', text_en = 'When I make a mistake, I admit it without making excuses' where id = 25;
update public.dojo_questions set text_ko = '팀원에게 건설적인 피드백을 줄 수 있다', text_en = 'I can give constructive feedback to team members' where id = 26;
update public.dojo_questions set text_ko = '목표가 불명확할 때 방향을 제시할 수 있다', text_en = 'I can provide direction when goals are unclear' where id = 27;
update public.dojo_questions set text_ko = '압박 상황에서도 침착하게 행동한다', text_en = 'I remain calm under pressure' where id = 28;
update public.dojo_questions set text_ko = '다른 사람의 성장을 돕는 것에 보람을 느낀다', text_en = 'I find fulfillment in helping others grow' where id = 29;
update public.dojo_questions set text_ko = '결과뿐 아니라 과정도 중요하게 생각한다', text_en = 'I value the process as much as the outcome' where id = 30;

-- conflict (갈등·협상) 31–40
update public.dojo_questions set text_ko = '갈등이 생기면 피하지 않고 해결하려 한다', text_en = 'When conflict arises, I try to resolve it instead of avoiding it' where id = 31;
update public.dojo_questions set text_ko = '상대와 나 모두 이익이 되는 방법을 찾으려 한다', text_en = 'I look for solutions that benefit both sides' where id = 32;
update public.dojo_questions set text_ko = '논쟁이 격해질 때 한 발 물러서서 생각할 수 있다', text_en = 'I can step back and think when an argument gets heated' where id = 33;
update public.dojo_questions set text_ko = '내 요구와 상대의 요구 사이에서 균형을 찾는다', text_en = 'I find a balance between my needs and others'' needs' where id = 34;
update public.dojo_questions set text_ko = '감정적이 되지 않고 문제에 집중할 수 있다', text_en = 'I can focus on the problem without becoming emotional' where id = 35;
update public.dojo_questions set text_ko = '양보할 수 있는 부분과 양보할 수 없는 부분을 구분한다', text_en = 'I distinguish between what I can and cannot compromise on' where id = 36;
update public.dojo_questions set text_ko = '갈등 후에도 관계를 유지하려고 노력한다', text_en = 'After a conflict, I make an effort to maintain the relationship' where id = 37;
update public.dojo_questions set text_ko = '불공평하다고 느끼면 적절하게 의견을 표현한다', text_en = 'When something feels unfair, I express my concerns appropriately' where id = 38;
update public.dojo_questions set text_ko = '협상할 때 상대가 무엇을 원하는지 먼저 파악한다', text_en = 'In negotiations, I first understand what the other party wants' where id = 39;
update public.dojo_questions set text_ko = '갈등의 원인을 사람이 아닌 상황에서 찾으려 한다', text_en = 'I look for the cause of conflict in the situation, not in the person' where id = 40;

-- teamwork (팀·협업) 41–50
update public.dojo_questions set text_ko = '팀의 목표를 내 개인 목표보다 우선시할 수 있다', text_en = 'I can prioritize team goals over my personal goals' where id = 41;
update public.dojo_questions set text_ko = '팀원의 의견을 존중하고 반영하려 한다', text_en = 'I respect and try to incorporate team members'' opinions' where id = 42;
update public.dojo_questions set text_ko = '내 역할이 아니어도 팀에 필요하면 돕는다', text_en = 'I help out even when it''s not strictly my role, if the team needs it' where id = 43;
update public.dojo_questions set text_ko = '팀원을 신뢰하고 맡긴 일에 간섭하지 않는다', text_en = 'I trust my teammates and don''t micromanage their work' where id = 44;
update public.dojo_questions set text_ko = '함께 일할 때 분위기를 긍정적으로 만들려 한다', text_en = 'I try to create a positive atmosphere when working together' where id = 45;
update public.dojo_questions set text_ko = '팀 내 갈등이 있을 때 중재 역할을 할 수 있다', text_en = 'I can mediate when there is conflict within the team' where id = 46;
update public.dojo_questions set text_ko = '다른 사람의 기여를 인정하고 감사를 표현한다', text_en = 'I acknowledge others'' contributions and express gratitude' where id = 47;
update public.dojo_questions set text_ko = '정보나 자원을 팀원과 기꺼이 공유한다', text_en = 'I willingly share information and resources with teammates' where id = 48;
update public.dojo_questions set text_ko = '팀의 약점을 보완하기 위해 내가 할 수 있는 것을 찾는다', text_en = 'I look for ways to compensate for the team''s weaknesses' where id = 49;
update public.dojo_questions set text_ko = '혼자 하는 것보다 함께하면 더 좋은 결과가 나온다고 믿는다', text_en = 'I believe teamwork produces better results than working alone' where id = 50;
