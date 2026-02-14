# BTY Bot (Emulator용)

Bot Framework Emulator로 테스트할 수 있도록, bty-ai-core와 연동하는 봇입니다.

## 사전 조건

- **bty-ai-core** 가 먼저 실행 중이어야 합니다.
  ```bash
  cd bty-website/bty-ai-core && npm run dev
  ```
  (기본: http://localhost:4000)

## 실행

```bash
cd bty-website/bty-bot
npm install
npm start
```

기본 포트: **3978**

## 재시작

1. **터미널에서 `Ctrl + C` (Mac: `Cmd + C`)** 로 종료
2. 다시 `npm start` 실행

또는 프로세스 직접 종료:
```bash
lsof -i :3978 -t | xargs kill
cd bty-website/bty-bot && npm start
```

## Emulator 연결

1. [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator/releases) 실행
2. **Open Bot** 또는 **Create new bot configuration**
3. Bot URL: `http://localhost:3978/api/messages`
4. Microsoft App ID / Password 는 **비워 두기** (로컬 테스트)
5. Connect 후 메시지 입력 (예: "안녕", "요즘 스트레스가 많아요")

## 환경 변수 (.env)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| PORT | 봇 서버 포트 | 3978 |
| BTY_AI_CORE_URL | bty-ai-core 주소 | http://localhost:4000 |
| DEFAULT_ROLE | 채팅에 사용할 역할 | leader |
| DEFAULT_USER_ID | 사용자 식별자 | emulator-user |

## "BTY AI 서버에 연결할 수 없어요" 가 나올 때

1. **bty-ai-core가 실행 중인지 확인**
   ```bash
   curl http://localhost:4000/health
   ```
   - `{"status":"ok",...}` → 정상. 봇을 재시작해 보세요.
   - `Connection refused` → bty-ai-core를 먼저 실행하세요:
     ```bash
     cd bty-website/bty-ai-core && npm run dev
     ```

2. **봇에서 백엔드 연결 상태 확인**
   ```bash
   curl http://localhost:3978/health
   ```
   - `bty_ai_core.reachable: true` → 연결됨. 에뮬레이터에서 다시 메시지 보내 보세요.
   - `bty_ai_core.reachable: false` → bty-ai-core를 켠 뒤 봇을 재시작하세요.

3. **두 터미널 모두 켜 두기**
   - 터미널 1: `cd bty-website/bty-ai-core && npm run dev`
   - 터미널 2: `cd bty-website/bty-bot && npm start`

## 400 에러가 날 때 (POST 400 directline.postActivity)

1. **Emulator 설정**: Microsoft App ID와 Password를 **비워두세요** (로컬 테스트용)
2. **봇 .env**: `MicrosoftAppId`, `MicrosoftAppPassword`를 설정하지 않거나 주석 처리
3. **bty-ai-core**가 4000 포트에서 실행 중인지 확인
4. 봇 재시작 후 Emulator에서 **Restart Conversation** → 새 메시지 전송
