# Recipe mobile

Production-ready Expo + TypeScript boilerplate for a React Native mobile app. It is a starting foundation, not a product: no authentication, backend, or business features.

This app lives in an Nx workspace. From the **repository root**:

```bash
npx nx start mobile
npx nx test mobile
npx nx lint mobile
npx nx typecheck mobile
```

Install dependencies from the repository root (`npm install`), not from this folder.

## Requirements

- **Node.js** 22.13 or later (SDK 57 minimum). Node 24+ is also fine.
- **npm** 10 or later (this repo was created with npm 11).
- **Expo CLI** is invoked via `npx`; you do not need a global install.
- **Expo Go** (optional) for a quick device preview of JS-only work.
- **Android**: Android Studio, an emulator or device, and the Android SDK if you want native builds.
- **iOS**: macOS, Xcode, and a simulator or device if you want iOS native builds.
- **EAS**: an Expo account for cloud builds (`npm install -g eas-cli`, then `eas login`).
- **Maestro**: install the [Maestro CLI](https://docs.maestro.dev/getting-started/installing-maestro) to run E2E flows.

## Installation

From the **repository root**:

```bash
cp apps/mobile/.env.example apps/mobile/.env
npm install
```

`.env` is gitignored. `EXPO_PUBLIC_API_URL` is already set in `.env.example` to the Recipe API, including the `/api/v1` prefix:

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Android emulator: `http://10.0.2.2:3000/api/v1`.

## Development

From the repository root:

```bash
npx nx start mobile
```

Or from this directory:

```bash
npx expo start
```

Then press `a` for Android, `i` for iOS (macOS), or `w` for web. You can also run:

```bash
npm run android
npm run ios
npm run web
```

## Testing

```bash
npm test
npm run test:watch
npm run test:ci
```

## Linting and formatting

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck
```

## E2E (Maestro)

The flow in `.maestro/flows/home-to-settings.yaml`:

1. Launches the app (`com.recipe.app`)
2. Skips onboarding if it appears
3. Asserts Home (`TONIGHT`) is visible
4. Navigates to Kitchen
5. Opens capture from the center + control
6. Asserts the capture copy “Send me anything.”

Maestro needs a **development or preview build** installed on a simulator/emulator or device. Expo Go is not a reliable target for this flow.

```bash
# after installing Maestro and a native build of this app
npm run e2e
# or
maestro test .maestro/flows
```

## EAS Build

Create an Expo project, then build:

```bash
npm install -g eas-cli
eas login
eas init
npx expo install expo-dev-client   # needed for the development profile
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android
```

Replace `android` with `ios` on macOS. Profiles live in `eas.json`:

- **development** — internal dev client with native debugging
- **preview** — internal distribution, production-like JS
- **production** — store-ready binary

You still need an Expo account, store credentials, and (for iOS) an Apple Developer membership. `eas init` will write the EAS project ID into `app.json`.

## Environment variables

`EXPO_PUBLIC_*` values are **inlined into the client bundle** at build time. Anyone who installs the app can read them.

Safe in `EXPO_PUBLIC_*`:

- Public API base URLs
- Non-secret feature flags
- Publishable third-party keys that are designed to be public

Never put in `EXPO_PUBLIC_*` (or anywhere else in this client):

- API secrets, private keys, signing credentials
- Database passwords
- Admin tokens
- Anything that grants privileged access if leaked

Secrets belong on a server, not in this app.

## Project architecture

| Path                 | Responsibility                                                       |
| -------------------- | -------------------------------------------------------------------- |
| `src/app/`           | Expo Router screens and layouts only                                 |
| `src/features/`      | Feature modules (API, schemas, hooks, UI for that feature)           |
| `src/components/ui/` | Small reusable primitives (Button, Text, Input, Card, Screen, Image) |
| `src/lib/`           | App-wide infrastructure (Query client/provider, secure storage)      |
| `src/services/`      | Shared HTTP client                                                   |
| `src/stores/`        | Zustand client state                                                 |
| `src/constants/`     | Environment and other constants                                      |
| `src/test/`          | Test helpers                                                         |
| `.maestro/`          | E2E flows                                                            |

Rules of thumb:

- Server/API data lives in **TanStack Query**.
- Client/session UI state lives in **Zustand**.
- Forms use **React Hook Form + Zod**.
- Components do not call `fetch` or know about URLs.
- Do not store general app state in SecureStore.

```text
Screen
  → feature hook (useQuery) → features/*/api.ts → services/api-client.ts
  → Zustand store
  → React Hook Form + Zod
```

## npm scripts

| Script                            | What it does              |
| --------------------------------- | ------------------------- |
| `npm start`                       | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Open a platform           |
| `npm run typecheck`               | `tsc --noEmit`            |
| `npm run lint` / `lint:fix`       | ESLint                    |
| `npm run format` / `format:check` | Prettier                  |
| `npm test`                        | Jest once                 |
| `npm run test:watch`              | Jest in watch mode        |
| `npm run test:ci`                 | Jest with coverage        |
| `npm run e2e`                     | Maestro flows             |

## Stack

Expo SDK 57, React Native 0.86, TypeScript, Expo Router, TanStack Query, Zustand, React Hook Form, Zod, NativeWind 4, Reanimated 4, expo-image, expo-secure-store, Jest, React Native Testing Library, Maestro, ESLint, Prettier.
