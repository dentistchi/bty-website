# BTY Teams Bot

Microsoft Teams bot that connects to bty-ai-core for leadership reflection.

## Flow

1. User sends a message in Teams
2. Bot forwards to `POST {BTY_BACKEND_URL}/chat`
3. Request body: `{ userId, role, message }`
   - `userId`: Teams user ID (Azure AD object ID when available)
   - `role`: `leader` | `doctor` | `staff` (from Azure AD group; defaults to `staff`)
   - `message`: User's text
4. Bot returns AI reply
5. If `maturitySignal` exists, sends a secondary adaptive card

## Setup

1. Create a bot in [Azure Portal](https://portal.azure.com) > Azure Bot
2. Add Teams channel
3. Copy App ID and Password to `.env`
4. Set `BTY_BACKEND_URL` to your bty-ai-core URL

```env
MicrosoftAppId=your-app-id
MicrosoftAppPassword=your-password
BTY_BACKEND_URL=https://your-bty-ai-core.azurewebsites.net
```

## Run

```bash
npm install
npm start
```

## Role Mapping (Azure AD Groups)

Role is resolved from Microsoft Graph API group membership:

| Group                         | Role   |
|------------------------------|--------|
| `AZURE_AD_GROUP_LEADER`       | leader |
| `AZURE_AD_GROUP_DOCTOR`       | doctor |
| Not in either                | staff  |

### Setup

1. In Azure Portal: your Bot’s App registration → **API permissions**
2. Add **Application** permissions:
   - `User.Read.All`
   - `GroupMember.Read.All`
3. Grant admin consent
4. Add to `.env`:

```env
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_GROUP_LEADER=leadership-group-object-id
AZURE_AD_GROUP_DOCTOR=doctor-group-object-id
```

To find group Object IDs: Azure Portal → Azure Active Directory → Groups → select group → **Object ID**.

## Testing with Bot Framework Emulator

1. Start **bty-ai-core** on port 4000: `cd bty-ai-core && npm run dev`
2. Start the bot: `cd bty-teams-bot && npm start`
3. Open [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator/releases)
4. Connect to: `http://localhost:3978/api/messages`
5. **Microsoft App ID** and **Password**: leave **both empty** for local testing
6. Send a message

### "Send fail" Troubleshooting

| Cause | Solution |
|-------|----------|
| bty-ai-core not running | Run `cd bty-ai-core && npm run dev` first. Bot needs backend on port 4000. |
| Wrong Emulator credentials | For localhost, leave App ID and Password **empty** in Emulator. |
| Connection refused | Ensure bot is running on 3978. Try `127.0.0.1:3978` if `localhost` fails. |
| Backend error in console | Check bty-ai-core terminal for errors. Ensure `BTY_BACKEND_URL=http://localhost:4000` in `.env`. |
