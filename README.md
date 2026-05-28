# talk 2 strangers kek

# Auth & User Identity Architecture

Plan for Better Auth + anonymous users + cross-service identity in the chatarooni monorepo (apps/auth, apps/api, apps/web).

## Goals

1. Anonymous-by-default — visitors can chat without signing up; "no sign-up required" tagline holds true.
2. Signed-up users get persistence — chats saved, friends list, blocked users, reputation, etc.
3. Stable cross-service user identity — apps/api references survive any user-table churn (including anon → real account upgrades).
4. No event broker / message queue / cross-service DB joins. Plain HTTP + JWT.
5. Each service owns its own domain: apps/auth = identity, apps/api = chat/social.

## Decisions made

1. **Use Better Auth's `anonymous` plugin** (not stateless guests). Anon users are real Better Auth user records with `isAnonymous: true`. Lets apps/api stay on a single JWT verification path; gives returning anon visitors continuity.
2. **`publicId` is the canonical user identifier** seen by apps/api — not Better Auth's internal `id`. It's stable across the anon→real upgrade.
3. **`displayName` is the only user-facing name.** Real names from Google OAuth (`profile` scope kept) are stored in `user.name` for audit but never displayed.
4. **Email/password sign-up is disabled** (`disableSignUp: true`). All new accounts come from OAuth. Email/password is used only for login + password reset (which doubles as the "set initial password" flow for OAuth-only users once Resend is wired).
5. **Path B (anon logs in with existing credentials) discards anon data.** Intended behavior — rare, and merging cross-account anon state is more trouble than the UX is worth.

## User table — fields

Beyond Better Auth defaults:

| Field | Source | Type | Notes |
|---|---|---|---|
| `publicId` | `user.additionalFields` (shared via `@chatarooni/auth/fields`) | string, unique, required | Stable handle used by apps/api everywhere. **Generated in `databaseHooks.user.create.before` via `uuidv7()`** (not `defaultValue` — the same hook sets `displayName` to the same value, so both share one UUID). Preserved across Path A upgrade via `onLinkAccount`. v7 for B-tree index performance. |
| `displayName` | `user.additionalFields` (shared via `@chatarooni/auth/fields`) | string, required | **Currently a copy of `publicId`** (the same UUID). The random-name generator ("BraveOwl42") is DEFERRED — when it lands, only the `databaseHooks.before` initialization changes; consumers (JWT claim, AccountMenu) stay the same. Copied forward in `onLinkAccount` Path A. |
| `isAnonymous` | added by `anonymous()` plugin | boolean | Distinguishes guest sessions from real accounts. Travels as JWT claim. |

Defaults Better Auth provides that we keep using:

| Field | Notes |
|---|---|
| `id` | Better Auth internal. **Changes** on anon → real link. apps/api never sees this. |
| `name` | Real name from Google OAuth (since `profile` scope kept). **Stored, never displayed.** Used only for audit / abuse evidence. |
| `image` | **DEFERRED** — plan is to override with a custom random avatar URL (e.g., Dicebear seeded by `publicId`), NOT Google's `picture`. **Not yet implemented** — currently whatever Better Auth/Google sets. When built, populate it in the same `databaseHooks.user.create.before` that fills `displayName`. Not in the JWT yet either (see JWT claims). |
| `email` | Nullable (anon plugin allows). Populated on signup/OAuth. |
| `emailVerified`, `createdAt`, `updatedAt` | Standard. |

### Avatar generation pattern (DEFERRED — not yet built)

Custom random avatars instead of OAuth profile pictures, for the same anonymity-by-default reason `displayName` overrides the real name. Two viable approaches:

- **External avatar service (recommended)**: `https://api.dicebear.com/9.x/{style}/svg?seed={publicId}` — free, no infra, well-cached at edge. Style options: `bottts`, `personas`, `shapes`, etc. (Pick one for chatarooni's vibe and stick with it.)
- **Self-generated SVG**: server-side function returning a procedural avatar (geometric gradients, identicon-style). More control, more code.

For Phase 1: external avatar service. Set `user.image = dicebear_url(publicId)` in the `databaseHooks.user.create.before`. Re-roll later by regenerating with a new seed if you add a "change avatar" feature.

## The two upgrade paths

When an anon user (signed in via `signIn.anonymous()`) initiates `signUp.email`, `signIn.email`, or `signIn.social`, Better Auth's `anonymous` plugin fires `onLinkAccount({ anonymousUser, newUser, ctx })`. Two distinct cases:

### Path A — Anon signs up with brand-new credentials

```
Anon (id=A, publicId=P1, displayName="BraveOwl42")
    ↓ signUp via OAuth (Google, brand-new email)
    ↓ Better Auth creates newUser (id=B, publicId=P2-auto-generated)
    ↓ onLinkAccount fires
    ↓ Detection: newUser.createdAt within last 60s → fresh signup
    ↓ updateUser: copy publicId (P1) and displayName from anon to newUser
    ↓ newUser becomes (id=B, publicId=P1, displayName="BraveOwl42")
    ↓ Better Auth deletes anon (id=A)
Result: apps/api data keyed by P1 is intact. User keeps their chats, friends, etc.
```

### Path B — Anon signs in to existing account (different device, returning user)

Path B further splits by **user intent**, signalled from the client via `additionalData.intent` on the `signIn.social` call (read server-side via `getOAuthState()`):

```
Anon on new device, clicks an OAuth button for an ALREADY-EXISTING account
    ↓ onLinkAccount fires; newUser = the existing user (createdAt is old)
    ↓
    ├─ intent === 'signin'  (default — user just wants their old account back)
    │     ↓ Do nothing — leave the existing user's publicId/displayName alone
    │     ↓ Better Auth deletes the anon, signs them into the existing account
    │   Result: full history restored. Anon's brief activity orphaned by design.
    │
    └─ intent === 'claim'  (user clicked "Save my account", but it's taken)
          ↓ throw ctx.redirect('…/login?error=account_already_exists')
          ↓ existing user untouched; anon untouched
        Result: friendly error on /login; nothing merged or overwritten.
```

The frontend sets `intent`: the plain login flow uses `'signin'`; the "Save your account" CTA navigates to `/login?intent=claim`, which passes `'claim'`.

### Detection logic (as implemented in `apps/auth/src/auth.ts`)

Fresh-signup detection compares the new user's `createdAt` to its **session's** `createdAt` — a brand-new user is created in the same request as its first session (≈ same instant), an existing user predates the session by days. This is more deterministic than the original `Date.now()` draft (no wall-clock skew, no generous window).

```ts
onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
  const userMs = new Date(newUser.user.createdAt).getTime();
  const sessionMs = new Date(newUser.session.createdAt).getTime();
  const isFreshUser = Math.abs(sessionMs - userMs) < 1000; // 1s window

  if (!isFreshUser) {
    // Path B
    const state = (await getOAuthState()) as { intent?: string } | null;
    if (state?.intent === 'claim') {
      throw ctx.redirect(`${trustedOrigins[0]}/login?error=account_already_exists`);
    }
    return; // 'signin' → silent merge into existing account
  }

  // Path A — two-step swap (publicId is UNIQUE): free the anon's slot with a
  // placeholder first, THEN claim it on newUser. Anon row is deleted right
  // after this hook returns, so the placeholder never lingers.
  await ctx.context.internalAdapter.updateUser(anonymousUser.user.id, {
    publicId: `_linked_${anonymousUser.user.id}`,
  });
  await ctx.context.internalAdapter.updateUser(newUser.user.id, {
    publicId: anonymousUser.user.publicId,
    displayName: anonymousUser.user.displayName,
  });
}
```

## Risks — RESOLVED during Phase 1 implementation

The four correctness issues flagged in the original draft were all resolved while building + verifying Phase 1 (anon→Google link tested end-to-end in the browser via Playwright, both Path A and Path B). Kept here as a record of why the code looks the way it does.

### Bug 1 — Unique constraint violation on publicId copy (critical) → ✅ RESOLVED

At the moment `onLinkAccount` fires, the anon still holds `publicId = P1` and newUser holds an auto-generated `P2`. Setting `newUser.publicId = P1` while the anon still has it violates the `unique` constraint. **Confirmed in testing** — the link failed with `unable_to_create_user`.

**Fix shipped: mitigation (a) — two-step placeholder swap.** Rename the anon's publicId to `_linked_<id>` first (freeing the slot), then claim P1 on newUser. The anon row is deleted right after the hook returns, so the placeholder is fleeting. Uses `ctx.context.internalAdapter.updateUser(userId, …)` (targets a specific user by id — see Verification 4).

### Bug 2 — 60-second threshold is dangerously generous (high) → ✅ RESOLVED

The original `Date.now() - createdAt < 60_000` draft would false-positive for multi-device users. **Fix shipped:** detection now compares the new user's `createdAt` to its **session's** `createdAt` with a **1-second** window. A fresh user is created in the same request as its first session; an existing user predates it by days. No wall-clock dependency, no generous window.

### Bug 3 — Timestamp heuristic isn't deterministic (medium) → ✅ MOSTLY RESOLVED

Comparing two DB-issued timestamps from the same request (`session.createdAt` vs `user.createdAt`) is far more robust than the original wall-clock `Date.now()` proxy — both come from the DB, in the same transaction, so skew is a non-issue. It's still technically a timestamp comparison rather than an explicit "isNewUser" flag, but in practice it's deterministic for the cases that matter. Good enough; revisit only if Better Auth later exposes a first-class new-user signal.

### Bug 4 — Direct signups leave displayName NULL (medium) → ✅ RESOLVED

`databaseHooks.user.create.before` runs on EVERY user create (anon, OAuth, email) and sets both `publicId` and `displayName` (currently the same UUID). So direct OAuth signups that never hit `onLinkAccount` still get a non-NULL displayName. `anonymous().generateName` is not used — the database hook is the single source of truth.

## Verification items — CONFIRMED via testing

All confirmed by building Phase 1 and running the flows against a real local Postgres + browser:

1. **Callback ordering**: Better Auth deletes the anonymous user AFTER `onLinkAccount` returns — confirmed (the two-step swap relies on this, and it works).
2. **Error handling in `onLinkAccount`**: a plain `throw new Error()` surfaces as a server error and does NOT honor `errorCallbackURL`; `throw ctx.redirect(url)` IS the mechanism that overrides Better Auth's default OAuth-completion and redirects the browser. (A plain `APIError` also didn't trigger the redirect — Better Auth fell through to silent sign-in.)
3. **`ctx` content**: no first-class "isNewUser" flag was needed — the session/user `createdAt` comparison covers it. `getOAuthState()` exposes the client-supplied `additionalData` (used for `intent`).
4. **`internalAdapter.updateUser` targeting**: takes an explicit user id, so we can modify either the anon or newUser by id from within the callback. (Used over `auth.api.updateUser`, which targets the session user.)

## Architecture decision — COMMITTED: (A) anonymous plugin

Decision resolved in favour of **(A) Better Auth's `anonymous` plugin + publicId stability** (not stateless guests). The four bugs above turned out to be tractable — concentrated in `apps/auth`, one-time cost, verified. apps/api keeps a single JWT-verify path. The stateless alternative was rejected: it would distribute complexity across apps/api (two auth paths) and give anon users zero persistence.

## JWT claims

Better Auth's `jwt()` plugin's `definePayload` — **as currently implemented**:

```ts
definePayload: ({ user }) => ({
  role: user.role,                       // permission level (separate from account type)
  publicId: user.publicId,               // stable identity for apps/api
  displayName: user.displayName,         // perf: avoid per-request lookup
  isAnonymous: user.isAnonymous ?? false, // boolean — endpoint authorization branching
}),
```

`libs/core/auth`'s guard validates `sub`, `role`, `publicId`, `displayName` are present (and verifies `iss`/`aud` via JWKS).

**One delta from the original plan:** `image` is NOT in the JWT yet — the custom-avatar system is deferred (see User table). Add `image` to the payload when avatars land.

Note: `audience` is left at the Better Auth default (`aud` = `iss` = the auth service URL). The "domain-wide `aud: 'chatarooni'`" idea was discussed but not shipped; apps/api validates `aud` against the default today.

apps/api reads `publicId` from claims and uses it as the user identifier in all queries. Never queries apps/auth's DB. Verifies JWT via JWKS (existing `libs/core/auth`).

### Why each claim is here (and why others aren't)

- **`publicId`** — apps/api's identity key. Required.
- **`isAnonymous`** — kept SEPARATE from `role`. They're orthogonal: `role` = "what permissions does this user have?" (`user`/`admin`/future `moderator`/`banned`); `isAnonymous` = "what kind of account is this?" (anon session vs real account). These vary independently — an anon user can be banned (role=banned, isAnonymous=true); a real user can be a moderator (role=moderator, isAnonymous=false). Collapsing them into one field forces a Cartesian product of values. Also, Better Auth's admin plugin sets `role='user'` by default on every user create (anon included), so encoding "anon" as `role=null` would mean fighting the plugin with custom hooks. Boolean stays explicit and self-documenting.
- **`displayName`** — included for performance: every chat message Alice sends to Bob needs Alice's displayName in the payload. Looking it up per-request would mean either a DB hit per message (hot path) or a custom connection-time handshake (more protocol). JWT claim is the cleanest pattern. **Caveat**: displayName in JWT is slightly stale on rename — Alice's active JWT carries the old name until refresh. Acceptable for chat (eventual consistency, small UX lag). Force JWT refresh on rename if instant propagation is ever required.
- **`image`** — **custom random avatar URL** (NOT Google's profile picture). Generated server-side at user creation, seeded by publicId for stability across devices. Same reasoning as displayName: included in JWT to avoid a per-request lookup when rendering avatars in chat / friend lists / message bubbles. Same staleness caveat applies — JWT carries the URL at time of issue; if the user re-rolls or uploads a custom avatar, the new URL propagates on next JWT refresh.
- **`role`** — existing in current config (set by admin plugin). Used for permission checks.

### Claims and the JWT

- **`email`** — ✅ **REMOVED from the payload.** apps/api never needs email for business logic (chat, friends, blocks, reports all key off publicId). Keeping it out: (1) shrinks the token, (2) avoids PII in logs/traces where JWTs commonly appear, (3) shrinks the blast radius if a JWT leaks. If apps/api ever needs email for moderation, call apps/auth's `getUser` with the publicId.
- **`name`** (real name from OAuth) — correctly NOT in the JWT. Never displayed; only used for audit/abuse evidence. apps/api doesn't need it.

## apps/api implications

### Tables (Phase 2)

All references use `publicId` (TEXT), not Better Auth's internal `id`:

- `chat_session(id, user_a_public_id, user_b_public_id, started_at, ended_at)`
- `chat_message(id, session_id, sender_public_id, text, created_at)` *(if persisted)*
- `friends(user_a, user_b, created_at)` — canonical ordering, `user_a < user_b`
- `friend_requests(requester_id, recipient_id, status, created_at)`
- `blocks(blocker_id, blocked_id, created_at)`
- `reports(id, reporter_id, reported_id, reason, content_snippet, created_at, status)`

### Authorization

Single JWT verify path. Most endpoints are open to BOTH anon and real users — `isAnonymous` only gates a small set of identity/account-management actions that don't make sense without an email.

**Open to both anon and real users:**
- `/chat/start`, `/chat/skip`, `/chat/report`
- `/friends/*` (add, remove, list) — anons can friend each other or real users
- `/blocks/*` (block, unblock, list)
- `/reports/*`
- `/me/rename` (change displayName), `/me/avatar` (re-roll avatar)

**Anon-only (would error for real users)**: none. Real users can do everything anons can.

**Real-only (gated by `isAnonymous` check)**: identity / email-bound actions.

```ts
@Post('/chat/start')
startChat(@Req() req) {
  // Anon AND real — both can chat.
  return this.chatService.startSession(req.user.publicId);
}

@Get('/friends')
listFriends(@Req() req) {
  // Anon AND real — both can have friends. Friends are publicId pairs;
  // upgrades preserve the relationship via Path A.
  return this.friendsService.list(req.user.publicId);
}

@Post('/account/change-email')
changeEmail(@Req() req) {
  // Real ONLY — anon has no email to change.
  if (req.user.isAnonymous) {
    throw new ForbiddenException('Sign up to manage your email');
  }
  return this.accountService.changeEmail(req.user.publicId);
}

@Post('/account/export-data')
exportData(@Req() req) {
  // Real ONLY — GDPR-style data export tied to a recoverable identity.
  if (req.user.isAnonymous) {
    throw new ForbiddenException('Sign up to export your data');
  }
  return this.accountService.export(req.user.publicId);
}
```

`isAnonymous` is more useful for:
- **Rate limiting** (e.g., anon: 20 chats/hour, real: 200/hour)
- **Retention policy** (e.g., anon chat history kept 30 days, real kept indefinitely)
- **UI affordances** (AccountMenu shows "Save your account" CTA, chat UI shows "Sign up to keep this conversation" nudges)

These are usually middleware / service-level concerns, not endpoint-level branching.

### Orphan cleanup

After Path B (or after anon idle-cleanup cron deletes a stale anon user), apps/api has rows keyed by publicIds that no longer exist in apps/auth.

**Lazy cleanup**: ignore. The user who owns those rows can never authenticate as that publicId again (JWT won't carry it). Orphans sit harmlessly.

**Optional proactive cleanup** (Phase 3): cron that queries apps/auth for live publicIds and deletes apps/api rows not in the set. Only needed if storage becomes an issue.

**Cross-user reference cleanup** (Phase 2 concern): when User A's friend B becomes an orphan, A's friends list returns broken entries. Mitigation: on query, JOIN against apps/auth's user table (HTTP API call or shared DB) to filter out unresolvable publicIds. Or run periodic cleanup to delete dead friend rows.

## apps/web implications

### Anonymous session bootstrap

- Lazy: only call `signIn.anonymous()` when user attempts to chat (not on home page load). Marketing visitors don't get DB rows.
- Auto: when triggered, no confirmation modal. UI says "Starting your chat..." not "Creating an account...".

### Login form

- Drop sign-up mode toggle (signup is OAuth-only via `disableSignUp: true`).
- Keep "Sign in" + "Continue with Google".
- Add "Forgot password?" link → `/forgot-password` page that calls `requestPasswordReset`. Blocked until backend Resend wired.

### AccountMenu adapts to user type

- **Anon**: show displayName, primary CTA "Save your account" → /login (with OAuth options).
- **Real**: show displayName, "Sign out" item, future settings entries.

### Rename UI

- Lives in `/chat` settings (not in AccountMenu, per UX choice).
- Calls `authClient.updateUser({ displayName: newName })`.
- Real users only. Anon users rename by clearing cookies (effectively).

## Cleanup cron

```sql
-- apps/auth, run nightly
DELETE FROM "user"
WHERE "isAnonymous" = true
  AND "updatedAt" < NOW() - INTERVAL '30 days';
```

30-day window matches typical "returning user" intent. Adjustable.

## Implementation phases

### Phase 1A — apps/auth foundation

1. ~~Add `publicId` additionalField (UUID, unique, default generator).~~ ✅ done — generated in `databaseHooks.user.create.before` via `uuidv7()` (not `defaultValue`); field shared via `@chatarooni/auth/fields`.
2. ~~Add `displayName` additionalField.~~ ✅ done — currently mirrors `publicId`.
3. **Random name generator** (~200 adjectives × ~200 nouns + 2-digit number). DEFERRED — displayName is the raw publicId UUID until this lands.
4. ~~Add `anonymous` plugin with `generateName` + `onLinkAccount`.~~ ✅ done — `onLinkAccount` shipped (Path A swap + Path B intent routing). `generateName` NOT used — the database hook is the single source of truth for displayName.
5. ~~Update `jwt` plugin's `definePayload` to include `publicId`, `isAnonymous`, `displayName`.~~ ✅ done — payload is `role, publicId, displayName, isAnonymous`; `sub` set to publicId via `getSubject`; `email` deliberately excluded.
6. ~~DB migration: add columns, indexes (`publicId` unique).~~ ✅ done — migrated local + the remote Railway `auth` DB.
7. **Cleanup cron** (or scheduled function) for stale anon users. PENDING — see Backend TODO.

### Phase 1B — apps/web wiring

8. ~~Add `anonymousClient` plugin to authClient.~~ ✅ done — plus `inferAdditionalFields` on both web clients (sourced from `@chatarooni/auth/fields`).
9. **Lazy `signIn.anonymous()` on first chat-engagement click.** PARTIAL — wired to the login button; still needs to fire lazily on first chat engagement (blocked on `/chat`).
10. ~~Remove Name field + sign-up mode from login form.~~ ✅ done.
11. **AccountMenu: display `displayName`, adapt CTAs by `isAnonymous`.** PARTIAL — displays `displayName` (icon-only on phones since it's a UUID); CTA adaptation ("Save your account") still TODO.

### Phase 1C — Verify

12. ~~Path A smoke test: anon signs up via Google → publicId preserved → no data loss.~~ ✅ verified end-to-end via Playwright.
13. ~~Path B smoke test: anon logs in with existing account → existing user untouched → no errors.~~ ✅ verified — both `intent=signin` (silent merge) and `intent=claim` (friendly error) paths; existing user's publicId untouched.

### Phase 2 — apps/api chat domain

14. Tables: chat_session, friends, blocks, reports — all keyed by publicId.
15. ~~Auth middleware reads `publicId`, `isAnonymous`, `displayName` from JWT.~~ ✅ done ahead of Phase 2 — `libs/core/auth`'s `JwtAuthGuard` verifies via JWKS and attaches `req.user` with these claims; `RolesGuard` handles `role`. Just needs chat endpoints to consume it.
16. Endpoint authorization branches on `isAnonymous`.
17. WebSocket text chat (server-relayed for moderation).
18. WebRTC signaling (for future video).
19. Cross-user reference cleanup for orphaned publicIds in friends/blocks.

### Phase 3 — Polish & operations

20. Proactive orphan cleanup cron in apps/api (optional).
21. Bot mitigation: Cloudflare Turnstile on `signIn.anonymous()` if abuse detected.
22. Monitoring: anon-to-signup conversion, abuse signals, table growth.

## Open questions

1. **`signIn.anonymous()` trigger** — eager (on page load) vs lazy (on first chat click)?
   - **Picked: lazy.** Don't create DB rows for marketing visitors.

2. **Anon → chat: button or auto-call?**
   - **Picked: auto-call.** Frictionless. UI hides the auth detail.

3. **Cleanup window** — 7 / 30 / 90 days?
   - **Picked: 30 days.** Industry standard.

4. **Chat content persistence for anon** — truly ephemeral or 24h moderation hold?
   - *Open.* Lean toward 24h hold for abuse-handling capability.

5. **Real user chat history default** — opt-in (save chats you want) or opt-out (saved by default, delete in settings)?
   - *Open.* Lean toward opt-out — standard for messengers, simpler UX.

## Why not other approaches

### Why not stateless guests (no DB row for anons)?
- Would force apps/api to have **two auth paths** (Better Auth JWTs for real users + apps/api-issued JWTs for guests). Adds significant code surface.
- Anon users would have zero persistence — no friends, no per-session chat history. Less engaging "try before you commit" experience.
- Anon plugin is canonical Better Auth pattern — less custom code to maintain.

### Why not put profile data in a separate user-service DB?
- Premature microservicization. Profile = `displayName` and maybe later `image`, `preferences`. Not a service's worth of domain logic.
- apps/auth IS the user identity service. `additionalFields` exists for exactly this case.
- Reversible later: extract profile to its own service if it grows.

### Why not use Better Auth's `id` directly in apps/api?
- `id` changes on Path A upgrade (Better Auth deletes anon, creates new). All FKs would break.
- `publicId` is the indirection layer that decouples internal identity churn from external references.

### Why discard anon data on Path B instead of merging?
- Merge logic requires cascade migration across all tables in apps/api — perpetual maintenance burden as schema grows.
- Path B is uncommon (most upgrades are Path A).
- The lost data (a few minutes of anon chat on a new device) is low-value.
- Lost data = expected behavior when "logging into an existing account" — user knows they had an account, intends to resume that identity.

## Related docs

- The **TODO** section at the bottom of this README tracks the actionable slice of this plan.
- Better Auth anonymous plugin: <https://better-auth.com/docs/plugins/anonymous>
- Better Auth additional fields: <https://better-auth.com/docs/concepts/database#extending-core-schema>
- Better Auth JWT plugin (`definePayload`, `getSubject`, `audience`): <https://better-auth.com/docs/plugins/jwt>

# TODO

## Frontend

- ~~**Login form: remove sign-up toggle** — `disableSignUp: true` is live in apps/auth, but the form still has a Sign-up mode that returns `signup_disabled` on submit. Drop the mode toggle and the Name field; keep only "Sign in" + "Continue with Google".~~ ✅ done — login form is sign-in only (Google / email / anonymous), no sign-up mode.
- ~~**Login form: "Forgot password?" link** — add to the form, points to a `/forgot-password` page that calls `requestPasswordReset`.~~ ✅ done — forgot/reset is an in-place flow in the login form (no separate page), calls `requestPasswordReset` with `redirectTo: …/reset-password`. Still blocked on Resend for the email to actually send.
- **`/reset-password` page** — landing page for the emailed reset link; reads the token and calls `authClient.resetPassword({ newPassword, token })`. Blocked on backend email service (Resend).
- **Home page: real body sections** — replace TEMP lorem placeholder in `app/page.tsx` with how-it-works → safety → footer-CTA sections. Needed for soft launch.
- **`/chat` route + route-group restructure** — build the actual product. As the first commit, restructure: move existing pages into `app/(marketing)/*` (keeps header + footer), put chat under `app/(app)/chat/*` (own layout, no marketing chrome). Strip `SiteHeader`/`SiteFooter` from root layout.
- **Anon flow on frontend** — `signIn.anonymous()` is wired to the login button; still TODO: fire it lazily on first chat engagement (not just from /login); `AccountMenu` adapts for anon users (show "Save your account" CTA → `/login?intent=claim` instead of just Sign out); show "Chatting as … [sign up to save]" affordance in chat. Blocked on `/chat` existing. (The claim-vs-signin intent routing itself is already wired in the form + backend `onLinkAccount`.)
- **Rename UI in chat** — `/chat` settings should let users change displayName via `authClient.updateUser({ displayName })`. Blocked on `/chat` existing AND on the random-name generator (displayName is currently the raw publicId UUID).
- **Browser-side JWT for chat** — chat WebSocket auth needs the JWT fetched client-side via `authClient.token()` (or the `set-auth-jwt` header), held in JS memory, refreshed before the 15-min expiry. Blocked on `/chat`.
- **PWA support** — add `viewport-fit=cover` + `safe-area-inset` padding so Add-to-Home-Screen looks clean on iPhone (Dynamic Island / home indicator).
- ~~**Auth: errorCallbackURL** — add to Google sign-in so OAuth errors route to the frontend instead of an auth 404.~~ ✅ done — `errorCallbackURL: …/login` on both social sign-ins; the login form reads `?error=` and shows a message.
- **Cloudflare: cache static frontend** — Cache Rule on apex; defer until frontend stable (cached HTML goes stale during dev).

## Backend

- **Email service (Resend)** — wire `sendResetPassword` in `apps/auth/src/auth.ts`; without it, `requestPasswordReset` silently no-ops and users can't recover passwords. Blocks the forgot-password UX from working.
- **Orphan anon user cleanup** — anon rows linger after Path B (silent merge) or claim-error flows because Better Auth's anonymous plugin only deletes the anon on a successful link transfer. Add a periodic job (cron / scheduled Postgres function / Nest schedule) to delete anon users with no active session older than N hours. Once `/chat` exists, also decide what happens to their pre-link records keyed by `publicId` (delete cascade, or preserve as historical).
- **OAuth: Apple Sign-In** — needs Apple Developer Account ($99/yr); pre-generate the `clientSecret` JWT (ES256 signed with `.p8` key, rotate every 6 months); add `https://appleid.apple.com` to `trustedOrigins` when enabled; HTTPS-only (no localhost dev). Required if/when iOS app ships.
- **OAuth: Facebook** — Facebook Developer App + `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` env vars; add `mapProfileToUser` fallback for the case where Facebook omits `email` (phone-only accounts, revoked consent).
- **Cloudflare: CSAM scanning** — enable + NCMEC reporting once image uploads exist.
