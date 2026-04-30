# Notification testing scenario

End-to-end manual test for the two notification surfaces of Pretou:

| Surface | Where it shows up | Trigger |
|---|---|---|
| **Mobile push (OS notification)** | Phone notification tray (banner / sound / lock screen) | New `annonce`, new `evenement`, new direct message |
| **Web in-app realtime** | Unread badge on the **Messages** nav link, thread updates without refresh | New direct message |

Web has **no OS push** — there is no service-worker push registered. The web "notification" is the realtime unread badge plus live message updates inside a conversation.

---

## Prerequisites

### Local stack
```bash
pnpm dev:all                    # starts Supabase + web + mobile in one shot
```

The web app runs at http://localhost:3000. The Expo CLI prints a QR code; scan it with your phone.

### Mobile build requirement (push notifications)
- **Real OS push only fires from a development build, not Expo Go.** `apps/mobile/src/lib/notifications.ts` short-circuits to `null` when `Constants.appOwnership === "expo"`.
- Build once with EAS (Android, since there is no iOS dev account):
  ```bash
  cd apps/mobile
  eas build --profile development --platform android --local
  # install the resulting .apk on the phone
  ```
- The phone must be a **physical device** (`Device.isDevice` guard).
- Once installed, `pnpm dev:all` is enough — the dev build attaches to the same Metro bundler.

### Edge function + DB trigger requirement (direct-message push)
- Local edge function for new-message push:
  ```bash
  npx supabase functions serve notify_new_message --no-verify-jwt
  ```
- Populate `runtime_config` so the DB trigger knows where to call:
  ```sql
  -- inside Studio SQL editor at http://localhost:54323
  insert into public.runtime_config (key, value) values
    ('functions_url',     'http://host.docker.internal:54321/functions/v1'),
    ('service_role_key',  '<SUPABASE_SERVICE_ROLE_KEY from `npx supabase status`>')
  on conflict (key) do update set value = excluded.value;
  ```
  `host.docker.internal` lets the Postgres container reach the function server running on the host. On Linux you may need `--add-host=host.docker.internal:host-gateway` when starting Supabase, or use the host's LAN IP instead.

### Annonce / evenement push requirement
- Local edge function:
  ```bash
  npx supabase functions serve push-notification --no-verify-jwt
  ```
- A database webhook on `posts INSERT` is needed in cloud envs (configured in Supabase Studio → Database → Webhooks). For **local** testing, the simplest path is to call the function directly from Studio after creating the post (see "Annonce push (cloud only)" below).

---

## Test users (from `supabase/seed.sql`)

All passwords: `demo1234`.

| Email | Role | Commune |
|---|---|---|
| `secretaire@saintmedard64.fr` | admin | Saint-Médard-en-Jalles (64) |
| `pierre.m@email.fr` | resident | Saint-Médard |
| `jeanne.l@email.fr` | resident | Saint-Médard |
| `marie.d@email.fr` | resident | Saint-Médard |

If you wiped the DB, run `npx supabase db reset` to reseed.

---

## Scenario A — Direct message push (cross-device)

Goal: prove that a message sent from web to a phone fires an OS notification, and that the phone's reply lights up the web unread badge in real time.

### Setup
1. **Phone (Pierre)** — install the dev build, log in as `pierre.m@email.fr`. Allow notifications when prompted. The app silently registers an Expo push token in `push_tokens`. Verify in Studio:
   ```sql
   select user_id, platform, left(token, 25) || '…' as token
   from public.push_tokens;
   ```
   Pierre's row should appear.
2. **Browser tab 1 — incognito (Jeanne)** — open http://localhost:3000, log in as `jeanne.l@email.fr`.
3. **Browser tab 2 — normal profile (Marie or Secretaire)** — log in as `secretaire@saintmedard64.fr` and publish one `entraide` post titled e.g. "Tonte de pelouse — disponible ce week-end". This is the post that Pierre and Jeanne will use to start a conversation. (Any non-`annonce` post type works.)

### Steps & expected results

| # | Action (where) | Expected on phone (Pierre) | Expected on web (Jeanne) |
|---|---|---|---|
| 1 | Jeanne opens the entraide post and clicks **Contacter** | — | Conversation page opens, empty thread |
| 2 | Jeanne sends "Bonjour, vous êtes encore disponible ?" | OS notification: title = "Jeanne L.", body = first 100 chars of message. Tapping it deep-links to `/messages/<convId>` | Message bubble appears immediately (optimistic update — no refresh) |
| 3 | Pierre opens the message from the notification | Notification dismissed | Thread on Jeanne's side: still shows her message; no unread indicator |
| 4 | Pierre replies "Oui, samedi matin ?" | — | **Within ~1s**, Jeanne's open thread shows the new bubble (Supabase Realtime). If Jeanne navigates back to `/app/messages`, the conversation is bold-faced and the **Messages** nav link shows a `1` badge if she navigated away after Pierre replied |
| 5 | Pierre sends a second message right after, **without** Jeanne reading | **No second push** — the edge function coalesces because Jeanne already has 1 unread (`priorUnread >= 1` in `notify_new_message/index.ts:52`) | Both bubbles appear in real time if the thread is open. If Jeanne is elsewhere, the badge count stays `1` — coalescing applies to push only, not the badge logic |
| 6 | Jeanne opens the thread | — | `mark_conversation_read` RPC fires, badge clears |
| 7 | Pierre sends a third message | OS push fires again (the unread counter was reset by step 6) | New bubble or badge depending on Jeanne's location |

### What to inspect if a step fails

| Symptom | Where to look |
|---|---|
| Phone never receives a push | `select * from public.push_tokens` — token must exist for Pierre. If empty, the dev build didn't register; check `expo-notifications` permissions on the phone |
| Token exists but no push | Tail `npx supabase functions serve notify_new_message`. The trigger `messages_notify_after_insert` calls it on every insert. If you see no log, `runtime_config` is empty or unreachable from the DB container |
| Push fires for the sender | Bug — the edge function picks the recipient explicitly (`conv.user_a === sender ? user_b : user_a`). Investigate, do not patch around it |
| Web thread doesn't update without refresh | Confirm `messages` is in the `supabase_realtime` publication. The `20260430120000_messages_realtime.sql` migration adds it; if missing, run `npx supabase db reset` |

---

## Scenario B — Annonce push to all residents

Goal: prove that an admin's `annonce` post pushes to every active resident in the commune **except the author**.

### Setup
- Phone (Pierre) installed with dev build, logged in.
- Browser tab — Secretaire logged in at http://localhost:3000.
- (Optional) second phone or second dev build with Marie / Jeanne to confirm fan-out.

### Steps

1. Secretaire navigates to `/admin` → **Publier une annonce**.
2. Publish an annonce: title "Coupure d'eau lundi 06h-09h", body "Maintenance réseau".
3. Trigger the edge function manually (local dev does not have a webhook):
   ```bash
   curl -X POST http://localhost:54321/functions/v1/push-notification \
     -H "Authorization: Bearer $(npx supabase status --output json | jq -r .SERVICE_ROLE_KEY)" \
     -H "Content-Type: application/json" \
     -d '{"record": {"id": "<post-id>", "type": "annonce", "title": "Coupure d'\''eau lundi 06h-09h", "commune_id": "<commune-id>", "author_id": "<secretaire-id>"}}'
   ```
   Use Studio → Table editor → `posts` to grab the IDs.

### Expected
- Pierre's phone receives one push: title "Annonce officielle", body the post title.
- Tapping it deep-links to `/post/<postId>`.
- Secretaire's phone (if logged in on a build) does **not** receive it (`.neq("user_id", record.author_id)` in `push-notification/index.ts:40`).
- A user in another commune does not receive it (`commune_id` filter).

The same flow works for `evenement`. The other three post types (`entraide`, `discussion`, `service`) return `"Post type not notifiable"` and emit no push.

---

## Scenario C — Web unread badge only (no mobile build)

If you don't have a dev build handy, you can still validate the web side:

1. Two browsers (or two profiles): log in as Pierre and Jeanne.
2. Pierre opens an `entraide` post and starts a conversation with Jeanne.
3. Jeanne, on the **Feed** page (not the inbox), should see the **Messages** nav link gain a `1` badge within ~1s of Pierre sending the message.
4. Jeanne opens the inbox, then the conversation. Badge clears.
5. Cross-commune banner should show on both sides if Pierre and Jeanne are in different communes.

This path doesn't need any edge function — it's pure Supabase Realtime + React Query invalidation.

---

## Tearing down

```bash
# Ctrl+C the pnpm dev:all process — Supabase keeps running.
npx supabase stop                 # stop containers when done for the day
```

Push tokens persist across `npx supabase db reset` only if you reseed and the same user IDs come back. In practice each `db reset` invalidates them — re-launch the dev build to re-register.
