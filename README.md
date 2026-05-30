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
3. **`displayName` is the only user-facing name.** Real names from Google OAuth (`profile` scope kept) are stored in `user.name` for audit but never displayed. The provider's `email`/`image` ARE adopted onto the user (see #7), but the public handle stays `displayName`.
4. **Email/password sign-up is disabled** (`disableSignUp: true`). All new accounts come from OAuth. Email/password is used only for login + password reset (which doubles as the "set initial password" flow for OAuth-only users once Resend is wired).
5. **Path B (anon logs in with existing credentials) discards anon data.** Intended behavior — rare, and merging cross-account anon state is more trouble than the UX is worth.
6. **Claim (anon → real "save my account") uses `linkSocial`, not `signIn.social`.** It upgrades the guest *in place* (same `id`/`publicId`) and errors *without* signing in when the provider account is already taken — which `signIn.social` structurally cannot do. See the upgrade-paths section.
7. **The provider profile (`name`, `image`, `email`/`emailVerified`) is adopted** on claim (and on a normal OAuth signup). This reverses the earlier "custom Dicebear avatar, not Google's photo" idea — we use the provider's photo as the avatar. `email` is adopted only if free (it's `unique`).

## User table — fields

Beyond Better Auth defaults:

| Field | Source | Type | Notes |
|---|---|---|---|
| `publicId` | `user.additionalFields` (shared via `@chatarooni/auth/fields`) | string, unique, required | Stable handle used by apps/api everywhere. **Generated in `databaseHooks.user.create.before` via `uuidv7()`** (not `defaultValue` — the same hook sets `displayName` to the same value, so both share one UUID). Preserved across Path A upgrade via `onLinkAccount`. v7 for B-tree index performance. |
| `displayName` | `user.additionalFields` (shared via `@chatarooni/auth/fields`) | string, required | **Currently a copy of `publicId`** (the same UUID). The random-name generator ("BraveOwl42") is DEFERRED — when it lands, only the `databaseHooks.before` initialization changes; consumers (JWT claim, AccountMenu) stay the same. Copied forward in `onLinkAccount` Path A; left unchanged (NOT replaced by the real name) on claim. |
| `isAnonymous` | added by `anonymous()` plugin | boolean | Distinguishes guest sessions from real accounts. Travels as JWT claim. |

Defaults Better Auth provides that we keep using:

| Field | Notes |
|---|---|
| `id` | Better Auth internal. **Changes** on anon → real link. apps/api never sees this. |
| `name` | Real name from Google OAuth (since `profile` scope kept). **Stored, never displayed.** Used only for audit / abuse evidence. |
| `image` | The provider's photo (Google `picture`). Set by Better Auth on OAuth signup; explicitly **adopted on claim** via `databaseHooks.account.create.after` (decoded from the ID token). The earlier custom-avatar idea (Dicebear seeded by `publicId`) was **dropped**. Populated on the user, but **not in the JWT yet** (see JWT claims). |
| `email` | Nullable (anon plugin allows). Populated on signup/OAuth. |
| `emailVerified`, `createdAt`, `updatedAt` | Standard. |

### Avatars (decision changed — provider photo, not custom)

We adopt the **provider's photo** (`user.image` ← Google `picture`) rather than generating a custom avatar. The earlier "Dicebear seeded by `publicId`" plan was **dropped** — adopting the OAuth profile is simpler and matches what users expect after signing in with Google. (`displayName` still overrides the real *name* for anonymity; only the photo is taken.)

Anonymous users have **no `image`** (`signIn.anonymous()` sets none), so the UI must fall back to an initial/placeholder for guests. If a deterministic guest avatar is ever wanted, Dicebear seeded by `publicId` (`https://api.dicebear.com/9.x/{style}/svg?seed={publicId}`) remains an option — set it in `databaseHooks.user.create.before`.

## Account upgrade — claim vs. plain sign-in

An anonymous guest becomes (or signs into) a real account through **two client-chosen primitives**. The choice is made on the frontend by `intent` — it is **NOT** a server-read flag:

- **Claim** — the "Claim account" CTA → `/login?intent=claim` → `authClient.linkSocial({ provider })`.
- **Plain sign-in** — `/login` → `authClient.signIn.social({ provider })`.

(`intent=claim` only takes effect for an *active anonymous session* — `claiming = isClaimMode && isAnonymous`. For a logged-out/real visitor the login page redirects `/login?intent=claim → /login`, so it falls back to plain sign-in.)

### Claim — `linkSocial`, in-place upgrade (the primary "save my guest account")

```
Anon (id=A, publicId=P1, displayName=P1, isAnonymous=true, temp@… email)
   ↓ linkSocial({ provider: 'google' })          [uses the anon's active session]
   │
   ├─ Google NOT linked elsewhere → account row created for user A
   │     ↓ databaseHooks.account.create.after sees A is still anonymous →
   │       • isAnonymous = false
   │       • adopt the OAuth profile from the ID token: name, image, and
   │         email+emailVerified IF that email isn't already taken
   │       • displayName is left ALONE (stays P1 — anonymity)
   │   Result: id=A and publicId=P1 UNCHANGED — no swap, no row delete. The
   │           guest's apps/api data (keyed by P1) is intact; they ARE now real.
   │
   └─ Google ALREADY belongs to another user → the callback returns
       `account_already_linked_to_different_user` and creates NO session →
       the guest stays signed in as the anon. Friendly error shown on /login.
```

**Why `linkSocial`, not `signIn.social`, for claim?** `signIn.social` means "log me in via Google", so a pre-existing Google identity logs you straight **into that account**. That can't be prevented from `onLinkAccount`: the OAuth callback writes the session cookie *before* the after-hook runs, and a thrown `ctx.redirect` *preserves* the already-accumulated `Set-Cookie` — so you'd end up signed into the other account **and** shown an error. `linkSocial` errors *before any session is created*, so the guest is never signed into someone else's account. (This replaced an earlier `signIn.social` + `additionalData.intent` + `ctx.redirect` design that had exactly that incoherent "signed-in-but-errored" bug.)

Requires `account.accountLinking.allowDifferentEmails: true` — an anon's email is a generated `temp@…` that never matches the provider's real email. Only loosens *explicit* linking (not sign-in auto-linking), and only Google (a trusted provider) is enabled.

### Path A — anon plain-signs-in with a brand-new provider (`signIn.social` → `onLinkAccount`)

Fires when an anon uses plain `/login` (not claim) with a Google account that doesn't exist yet:

```
Anon (id=A, publicId=P1, displayName=P1)
   ↓ signIn.social (Google, brand-new) → Better Auth creates newUser (id=B, publicId=P2-auto)
   ↓ onLinkAccount fires; newUser.createdAt ≈ its session.createdAt (<1s) → fresh
   ↓ two-step swap (publicId is UNIQUE): rename anon's P1 → placeholder, then set newUser.publicId/displayName = P1
   ↓ Better Auth deletes anon (id=A)
Result: newUser (id=B, publicId=P1). apps/api data keyed by P1 intact.
```

The new session cookie is written by the callback with the **pre-swap** `P2`, so the cached snapshot is briefly stale — see **Cookie-cache staleness** below.

### Path B — anon plain-signs-in with an existing provider (`signIn.social` → `onLinkAccount`)

```
Anon, plain /login, Google that ALREADY has an account
   ↓ onLinkAccount fires; newUser = the existing user (createdAt is old) → !isFreshUser
   ↓ return — leave the existing user's publicId/displayName alone
   ↓ Better Auth signs into the existing account, deletes the anon
Result: existing account restored; the guest's brief activity orphaned by design.
```

There is **no intent branch** here anymore — claim never reaches `onLinkAccount` (it uses `linkSocial`). `onLinkAccount` only handles the two plain-sign-in paths.

### `onLinkAccount` — as implemented in `apps/auth/src/auth.ts`

Fresh-vs-existing is detected by comparing the new user's `createdAt` to its **session's** `createdAt` — a fresh user is created in the same request as its first session (≈ same instant); an existing user predates it by days. More deterministic than the original `Date.now()` draft (no wall-clock skew).

```ts
onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
  const userMs = new Date(newUser.user.createdAt).getTime();
  const sessionMs = new Date(newUser.session.createdAt).getTime();
  const isFreshUser = Math.abs(sessionMs - userMs) < 1000; // 1s window

  if (!isFreshUser) return; // Path B — silent sign-in, leave existing publicId

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

### Cookie-cache staleness on anon→real transition

`getSession()` (apps/web) reads a signed `session_data` cookie cache as a fast path (configured in `auth.ts` `session.cookieCache`, 5-min TTL). Both **claim** and **Path A** finalize the user's identity *after* the OAuth callback already wrote that cookie — `linkSocial` never re-issues it, and the Path A `publicId` swap happens in the after-hook. So right after the transition the cached snapshot is **stale** (pre-swap `publicId`/`displayName`, or `isAnonymous=true`) until the TTL lapses. This isn't merely cosmetic — a JWT minted from a stale session would carry a **phantom `publicId`** that doesn't exist in the DB.

Fix: any OAuth flow started from an anon session lands on `/chat?upgraded=1`; the `SessionRefresh` client component calls `getSession({ disableCookieCache: true })`, which bypasses the cache, reads the DB, and re-issues a correct cookie, then re-renders. The flag also suppresses the anon banner on that first paint. (Path B doesn't actually go stale — its cookie is set to the existing user directly — but it carries the flag too, where the refresh is a harmless no-op. A logged-out sign-up also gets a correct cookie from the callback → no flag.)

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
2. **An after-hook can't *prevent* a sign-in** (this drove the move to `linkSocial`): we first tried rejecting a taken account from `onLinkAccount`. `throw new Error()`/`APIError` fell through to a silent sign-in; even `throw ctx.redirect(url)` showed the error **while still signing the user into the existing account** — the OAuth callback writes the session cookie *before* the after-hook runs, and the thrown redirect *preserves* the accumulated `Set-Cookie`. So claim moved to `linkSocial` (errors before any session exists); `onLinkAccount` no longer throws.
3. **`createdAt` comparison covers Path A vs B**: no first-class "isNewUser" flag was needed. `getOAuthState()` / `additionalData.intent` are **no longer read server-side** — `intent` is now a purely client-side switch (`linkSocial` for claim vs `signIn.social` for sign-in).
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

**One delta from the original plan:** `image` is NOT in the JWT yet. It IS now populated on the user (the provider photo — see User table), so adding it to `definePayload` is just pending the chat UI that renders avatars (see TODO).

Note: `audience` is left at the Better Auth default (`aud` = `iss` = the auth service URL). The "domain-wide `aud: 'chatarooni'`" idea was discussed but not shipped; apps/api validates `aud` against the default today.

apps/api reads `publicId` from claims and uses it as the user identifier in all queries. Never queries apps/auth's DB. Verifies JWT via JWKS (existing `libs/core/auth`).

### Why each claim is here (and why others aren't)

- **`publicId`** — apps/api's identity key. Required.
- **`isAnonymous`** — kept SEPARATE from `role`. They're orthogonal: `role` = "what permissions does this user have?" (`user`/`admin`/future `moderator`/`banned`); `isAnonymous` = "what kind of account is this?" (anon session vs real account). These vary independently — an anon user can be banned (role=banned, isAnonymous=true); a real user can be a moderator (role=moderator, isAnonymous=false). Collapsing them into one field forces a Cartesian product of values. Also, Better Auth's admin plugin sets `role='user'` by default on every user create (anon included), so encoding "anon" as `role=null` would mean fighting the plugin with custom hooks. Boolean stays explicit and self-documenting.
- **`displayName`** — included for performance: every chat message Alice sends to Bob needs Alice's displayName in the payload. Looking it up per-request would mean either a DB hit per message (hot path) or a custom connection-time handshake (more protocol). JWT claim is the cleanest pattern. **Caveat**: displayName in JWT is slightly stale on rename — Alice's active JWT carries the old name until refresh. Acceptable for chat (eventual consistency, small UX lag). Force JWT refresh on rename if instant propagation is ever required.
- **`image`** — **populated on the user (the provider photo) but NOT in the JWT yet.** Same reasoning as `displayName` applies: include it to avoid a per-request lookup when rendering avatars in chat / friend lists / message bubbles. Add it to `definePayload` when the chat UI needs avatars (see TODO). Guests have no `image`, so consumers need a placeholder fallback.
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

### Anonymous session bootstrap (shipped)

- Lazy: `signIn.anonymous()` fires only when the user clicks "Start chatting" (the home hero CTA — `StartChattingButton`), not on page load. Marketing visitors don't get DB rows. Already-signed-in users (anon or real) pass straight to `/chat`.
- Auto + frictionless: no modal; the button shows "Starting your chat…". On failure (rate limit/network) it falls back to `/login`.
- **Gap (see TODO):** direct navigation to `/chat` (deep link / bookmark / refresh) does NOT bootstrap — a logged-out visitor lands session-less. Handle when chat is real: bootstrap an anon on logged-out `/chat`, or gate it on the match action + Turnstile.

### Login form (shipped)

- Sign-in only (no sign-up mode) — Google, email (existing users only), and anonymous. All success paths land on `/chat`.
- **Claim vs sign-in**: `claiming = (intent === 'claim') && isAnonymous`. Claiming → `linkSocial`; otherwise → `signIn.social`. Any anon-initiated OAuth flow sets `callbackURL=/chat?upgraded=1` (triggers the cookie refresh); a logged-out sign-up uses plain `/chat`.
- Already-anon "Continue anonymously" routes straight to `/chat` (no second `signIn.anonymous`, which would error with "cannot sign in again anonymously").
- The page redirects `/login?intent=claim → /login` for logged-out/real visitors (the param only means something for an active anon session).
- Forgot/reset password is an **in-place** flow within the form (not a separate `/forgot-password` page); calls `requestPasswordReset` with `redirectTo: …/reset-password`. The `/reset-password` landing page + actual email send are still blocked on Resend.
- `errorCallbackURL` set on social flows; the form reads `?error=` and shows a message (e.g. `account_already_linked_to_different_user` from a claim against a taken account).

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
9. ~~Lazy `signIn.anonymous()` on first chat-engagement click.~~ ✅ done — the home "Start chatting" CTA (`StartChattingButton`) bootstraps an anon on click; the login "Continue anonymously" button also creates one. **Remaining gap:** direct `/chat` navigation while logged out doesn't bootstrap (see TODO).
10. ~~Remove Name field + sign-up mode from login form.~~ ✅ done.
11. **Anon CTA: display `displayName`, adapt by `isAnonymous`.** PARTIAL — the `/chat` `AnonymousBanner` ships the "Claim account" → `/login?intent=claim` CTA for guests; the header `UserMenu` still just shows `displayName` + Sign out (no anon-specific CTA there yet).

### Phase 1C — Verify

12. ~~Path A smoke test: anon signs up via Google → publicId preserved → no data loss.~~ ✅ verified end-to-end — re-verified this session including the cookie-cache staleness fix (header/JWT see the swapped publicId after `SessionRefresh`).
13. ~~Verify all upgrade + sign-in flows end-to-end.~~ ✅ verified via browser + DB + curl: **claim (`linkSocial`)** — new Google = in-place upgrade, profile adopted, publicId preserved; taken Google = `account_already_linked_to_different_user`, stays anon (NOT signed in). **Path B** — silent merge, existing user untouched, anon deleted. **Backend** — JWT mint → JWKS fetch → `apps/api` verify (200 valid / 401 missing+garbage / 403 wrong role).

### Phase 2 — apps/api chat domain

14. Tables: chat_session, friends, blocks, reports — all keyed by publicId.
15. ~~Auth middleware reads `publicId`, `isAnonymous`, `displayName` from JWT.~~ ✅ done ahead of Phase 2 — `libs/core/auth`'s `JwtAuthGuard` verifies via JWKS and attaches `req.user` with these claims; `RolesGuard` handles `role`. **Verified end-to-end** (200 valid / 401 missing+invalid / 403 wrong role). Just needs chat endpoints to consume it.
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
- ~~**`/chat` route + route-group restructure**~~ ✅ done (with a deviation) — `/chat` is a **plain route** (like `/login`), NOT an `app/(app)/chat/*` route group: it owns its full-screen layout and renders directly under the chrome-free root layout; marketing pages already live in `app/(marketing)/*` with `SiteHeader`/`SiteFooter`. The `/chat` page itself is still a **placeholder** — building the real chat product is Phase 2.
- **Anon flow on frontend** — DONE: lazy bootstrap (`StartChattingButton`), claim via `linkSocial`, the `/chat` `AnonymousBanner` "Claim account" CTA, the `?upgraded=1` cookie refresh, and `/login?intent=claim` param-stripping. STILL TODO: bootstrap an anon on **direct logged-out `/chat`** navigation (deep links/refresh land session-less — likely engagement-gated + Turnstile); header `UserMenu` anon-specific CTA; "Chatting as … [sign up to save]" affordance inside the real chat UI; **guard any identity (displayName/avatar) shown on the `/chat` upgrade-landing with the `justUpgraded` flag** (skeleton until the cookie refresh lands, to avoid a stale-value flash).
- **Rename UI in chat** — `/chat` settings should let users change displayName via `authClient.updateUser({ displayName })`. Blocked on `/chat` (real product) AND on the random-name generator (displayName is currently the raw publicId UUID).
- **Browser-side JWT for chat** — chat WebSocket auth needs the JWT fetched client-side via `authClient.token()` (or the `set-auth-jwt` header), held in JS memory, refreshed before the 15-min expiry. Fetch it **after** the session is confirmed fresh (post-`SessionRefresh`) so it can't carry a stale/phantom `publicId`. Also add `image` to `definePayload` so avatars render without a per-request lookup. Blocked on `/chat`.
- **PWA support** — DONE: `viewport-fit=cover` (root layout) + `env(safe-area-inset-*)` padding on every edge-pinned surface (`SiteHeader`/`AnonymousBanner` top notch; `SiteFooter`, `BeforeYouStart` gate, and `ChatSidebar` profile bar for the bottom home-indicator; `/chat` shell top inset). STILL TODO: (1) pad the future **chat message input bar** with `env(safe-area-inset-bottom)` when it's built — otherwise it sits under the home indicator; (2) **landscape** `left`/`right` insets aren't handled anywhere (low priority — portrait-first PWA); (3) **iOS splash screen** — no `apple-touch-startup-image` tags, so the installed app boots to a blank/white flash instead of a branded launch screen; add per-device startup images via a generator (low priority — cosmetic).
- ~~**Auth: errorCallbackURL** — add to Google sign-in so OAuth errors route to the frontend instead of an auth 404.~~ ✅ done — `errorCallbackURL: …/login` on both social sign-ins; the login form reads `?error=` and shows a message.
- **Cloudflare: cache static frontend** — Cache Rule on apex; defer until frontend stable (cached HTML goes stale during dev).

## Backend

- **Email service (Resend)** — wire `sendResetPassword` in `apps/auth/src/auth.ts`; without it, `requestPasswordReset` silently no-ops and users can't recover passwords. Blocks the forgot-password UX from working.
- **Orphan anon user cleanup** — anon rows linger from **sign-out** (session deleted, user row kept), **abandoned guests** who never link, and **claim against an already-taken account** (the anon correctly stays signed in). (Path A and Path B both delete the anon; only the no-successful-transfer cases linger.) Confirmed live during testing — several dead anon rows piled up. Add a periodic job (cron / scheduled Postgres function / Nest schedule) to delete anon users with no active session older than N hours. Once `/chat` exists, also decide what happens to their pre-link records keyed by `publicId` (delete cascade, or preserve as historical).
- **OAuth: Apple Sign-In** — needs Apple Developer Account ($99/yr); pre-generate the `clientSecret` JWT (ES256 signed with `.p8` key, rotate every 6 months); add `https://appleid.apple.com` to `trustedOrigins` when enabled; HTTPS-only (no localhost dev). Required if/when iOS app ships.
- **OAuth: Facebook** — Facebook Developer App + `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` env vars; add `mapProfileToUser` fallback for the case where Facebook omits `email` (phone-only accounts, revoked consent).
- **Cloudflare: CSAM scanning** — enable + NCMEC reporting once image uploads exist.
