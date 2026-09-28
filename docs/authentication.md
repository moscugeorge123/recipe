# Authentication

Firebase Authentication is the identity provider. The API is the application user database. Recipe ownership stays on the existing user id, and that user is resolved from the Firebase UID in a verified ID token.

```
Mobile app
  → Firebase Authentication (Google, Facebook, email/password, phone, optional anonymous)
  → Firebase ID token (+ App Check token when configured)
  → API  requireAuth / profile resolver
  → Firebase Admin SDK verifies the token
  → Postgres user (firebaseUid is unique)
  → recipes, collections, shopping, cooking, preferences
```

The client never sends a UID the server trusts. `request.auth.uid` comes from the verified token. Existing controllers keep using `request.profile.userId`, which is the application user’s UUID for that Firebase UID.

## Projects and environments

Use separate Firebase projects. Do not point a development build at production.

| Environment | Firebase project |
| --- | --- |
| Development | `recipe-app-dev` |
| Staging (optional) | `recipe-app-staging` |
| Production | `recipe-app-prod` |

Authorized domains, in Firebase Authentication → Settings:

- Development: `localhost` and the Expo web origin you actually use
- Production: the official production domains only

Remove unused domains before go-live.

## Client configuration

Public values only, in `apps/mobile/.env` (see `.env.example`):

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_FIREBASE_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_FIREBASE_FACEBOOK_APP_ID`
- `EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN` (dev only)
- `EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY` (web)

When those values are missing, the app stays a guest. Sign-in returns a configuration error instead of a fake session.

Session persistence uses Firebase Auth with AsyncStorage. The ID token is not stored in the app store.

## Server configuration

Secrets stay in the platform secret manager. Never commit a service account JSON file or put `FIREBASE_PRIVATE_KEY` in the mobile app.

```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

`FIREBASE_PRIVATE_KEY` may contain escaped newlines (`\n`). The Admin SDK is initialized only on the API.

Other flags (see `apps/api/.env.example`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `AUTH_REQUIRED` | `false` | When `true`, versioned routes without a bearer token return 401. `/health` stays public. |
| `APP_CHECK_ENFORCE` | `false` | When `false`, a bad App Check token is logged and allowed. When `true`, protected requests need a valid `X-Firebase-AppCheck` token. |
| `FIREBASE_AUTH_EMULATOR_HOST` | unset | Auth emulator. Do not set this in production. |
| `AUTH_HMAC_SECRET` | unset | Dev/test tokens only. Production startup fails if this is set without Firebase credentials. |
| `AUTH_RESERVED_USERNAMES` | empty | Extra reserved usernames. The built-in list always applies. |
| `AUTH_RECENT_LOGIN_SECONDS` | `300` | Window for password, email, phone, unlink, and delete. |
| `AUTH_PHONE_RESEND_SECONDS` | `60` | Server cooldown before another phone challenge. |
| `AUTH_PHONE_MAX_ATTEMPTS` | `5` | Phone challenges per 10 minutes per user. |

Token verification order:

1. Firebase Admin when project id, client email, and private key are set, or when the Auth emulator host is set.
2. HMAC tokens only outside production, and only in tests or when `AUTH_HMAC_SECRET` is set.
3. Otherwise every bearer token is rejected.

A present `Authorization` header is always verified. A missing header uses the implicit profile only while `AUTH_REQUIRED=false`, so current clients keep working until they send tokens. Turn `AUTH_REQUIRED` on in production after the mobile app always sends a token.

## Console setup

Authentication → Sign-in method:

- Email/Password
- Google (Web client id, iOS client id, Android package name and SHA-1/SHA-256)
- Facebook (app id, redirect URLs). Handle missing email: the Firebase UID is still the identity.
- Phone (SMS region, including Romania `+40` as the product default)
- Anonymous, if you want capture-before-signup. The app implements linking but does not start an anonymous session on launch.

OAuth client secrets and API secrets are not committed.

App Check:

- Android: Play Integrity
- iOS: App Attest / DeviceCheck
- Web: reCAPTCHA v3
- Debug tokens only in development

Register the API as a custom App Check resource. Ship with enforcement off, watch legitimate traffic, then set `APP_CHECK_ENFORCE=true`.

Firestore and Storage rules in `firebase/` deny all client access. Application data is in Postgres. Uploads go through the API storage provider.

## API

All paths are under `/api/v1`. Protected routes require `Authorization: Bearer <Firebase ID token>`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/bootstrap` | yes | Idempotent create-or-update of the application user from the token |
| `GET` | `/auth/me` | yes | Current application user |
| `PATCH` | `/auth/profile` | yes | Display name, photo, onboarding, preferences |
| `POST` | `/auth/username/check` | yes | Availability |
| `POST` | `/auth/username/claim` | yes | Atomic unique claim |
| `POST` | `/auth/account/delete` | yes, recent login | Deletes the Firebase user, then the application row and cascaded kitchen data |
| `POST` | `/auth/events` | yes | Audit events. Sensitive events require a recent login. |
| `POST` | `/auth/phone/challenge` | yes | Rate limit only. Does not send SMS and does not store codes. |
| `POST` | `/auth/password-reset` | no | Always accepts. Does not reveal whether the email exists. |

Username rules: 3–30 characters, `a-z`, `0-9`, `_`, `.`, stored lowercase, unique on `usernameNormalized`. Reserved names include `admin`, `support`, `root`, `system`, and `official`.

Passwords are never stored. Firebase handles password reset and email verification. The API copies `emailVerified` from the token.

Roles are `USER` and `ADMIN` on the application user, not Firebase custom claims. `/ops/summary` requires an admin when `AUTH_REQUIRED=true`. A non-admin token is forbidden even when auth is optional.

Recipe visibility (`PRIVATE`, `UNLISTED`, `PUBLIC`) is separate from ownership. Reads still require the recipe’s `userId` to match the authenticated profile.

## Account linking

One Firebase user can link Google, Facebook, email/password, and phone. The application user is keyed by that UID, so recipes stay on the same account.

If a provider credential is already used by another Firebase user, the client keeps the pending credential in memory only and asks the person to sign in with the existing method, then links. It does not create a second application user. The same email on two Firebase UIDs is rejected with `AUTH_CREDENTIAL_ALREADY_IN_USE`.

The last usable provider cannot be removed. Anonymous does not count as a usable method.

Sensitive changes (password, email, phone, unlink, delete) need a Firebase `auth_time` inside the recent-login window. The client reauthenticates and retries with a fresh token.

## Client module

Firebase calls stay in `apps/mobile/src/auth/firebase/`. Screens use `AuthService`. The existing Tortie sign-in overlay (panels, motion, Google and Facebook connecting state, email form, done screen) is the UI. Registration adds username and confirm password. Forgot password is another step in the same overlay. Profile → Login & security covers email verification, password, phone (Romania `+40` first), provider connect/disconnect, and account deletion.

Auth phase is one store: `INITIALIZING`, `UNAUTHENTICATED`, `AUTHENTICATED`, `AUTHENTICATED_ONBOARDING_REQUIRED`, `AUTHENTICATED_EMAIL_VERIFICATION_REQUIRED`, `AUTHENTICATED_PHONE_VERIFICATION_REQUIRED`, `AUTHENTICATED_READY`, `AUTHENTICATION_ERROR`. An unverified email is visible and can be resent; it does not block the kitchen. Phone verification does not block the app unless that sheet is open.

Navigation helpers (`useRequireAuth`, `useRequireGuest`, `useRequireOnboarding`, `useRequireEmailVerification`, `useRequirePhoneVerification`, `useRequireAdmin`) are not a substitute for API checks.

## Audit and analytics

Audit rows record event name, Firebase UID, and a short reason or provider id. They do not store passwords, ID tokens, OAuth secrets, or raw SMS codes.

Client analytics events (`auth_screen_viewed`, `login_started`, `login_completed`, `signup_started`, `signup_completed`, provider and phone events, `account_deleted`) carry a provider or failure category only.

## Tests

```
npx vitest run src/modules/auth --config apps/api/vitest.config.ts
npx jest src/auth --watchAll=false --config apps/mobile/jest.config.js
```

Covered without a live Firebase project: username and password rules, auth phases, error mapping, HMAC token rejection (expired, tampered), username claim races, duplicate-email refusal, recent-login delete, phone abuse limits, missing and invalid bearer tokens, App Check enforcement, and the provider-link matrix (including unlink of the last method and anonymous linking).

Production OAuth, Play Integrity, and App Attest still need a pass on real devices after the Firebase projects and SHA/bundle ids are configured.
