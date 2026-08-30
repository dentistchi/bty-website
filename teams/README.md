# BTY Teams app — "Save to BTY" (Slice T1)

One action, one endpoint, no Graph.

## What it does

Adds **Save to BTY** to the `…` menu on a Teams message. The selected message becomes a
`bty_action_captures` row and appears in BTY's **Saved for later** lane with a link back to the
original conversation.

It does **not** create an Action Contract, a deadline, a verification obligation, XP, AIR, or a
Today commitment. *Capture ≠ Commitment.*

## Microsoft permissions

**Graph delegated: NONE. Graph application: NONE.**

Teams delivers the message the user explicitly picked inside the invoke payload, so BTY never reads
any other message. `ChatMessage.Read.All`, `Chat.Read` and `ChannelMessage.Read.All` are **not**
requested and must not be added to make anything work — if something appears to need them, the
architecture assumption is wrong and the slice stops.

`"permissions": ["identity"]` in the manifest is the Teams app-level declaration, not a Graph scope.

## Identity

The invoke carries `channelData.tenant.id` (`tid`) and `activity.from.aadObjectId` (Entra `oid`).
Those two, and only those two, resolve to a BTY user through
`bty_resolve_user_from_microsoft_identity`.

Never used for identity: `activity.from.id` (a Bot-Framework `29:…` address), `sub` /
`provider_id` (per-application), email, UPN, or display name.

An unresolvable user gets *"Sign in to BTY with Microsoft first."* — no BTY user is ever created
from a Teams message.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `TEAMS_BOT_APP_ID` | Worker secret | The bot's Microsoft App ID. Verified as the **audience** of every incoming Bot Framework token. Without it the endpoint rejects all traffic (fails closed). |

No client secret is needed by this route: it only *verifies* inbound tokens; it never calls back
into the Bot Connector. Secrets are never committed.

**This is a separate application identity from the Supabase Azure OAuth app used for BTY web
sign-in.** They are deliberately not shared. The canonical *human* identity remains `tid` + `oid`.

## Packaging and install

1. Register a bot (Azure Bot / Microsoft App ID) with messaging endpoint:
   `https://arena.btydaily.com/api/bty/teams/invoke`
2. Set `TEAMS_BOT_APP_ID` as a Worker secret.
3. Substitute `${TEAMS_APP_ID}` (a fresh GUID for the Teams app) and `${TEAMS_BOT_APP_ID}` in
   `manifest/manifest.json`.
4. Zip the **contents** of `manifest/` (manifest.json, color.png, outline.png) — not the folder.
5. Upload in Teams (*Apps → Manage your apps → Upload an app*) or via the org catalog.

`manifest.json` targets manifest schema **v1.17**; the `$schema` URL in the file is the authority
if Teams later requires a newer version.

## Icons

`color.png` (192×192, BTY navy) and `outline.png` (32×32, white) are minimal placeholders that
satisfy Teams' packaging requirements. Replace with real brand assets before any wide publish.
