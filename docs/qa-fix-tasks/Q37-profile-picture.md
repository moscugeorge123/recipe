# Q37. Choose a profile picture

🟠 Medium · mobile (+ storage) · Finding **F94**

## Problem

Profile has a camera badge on the avatar ("Change photo") but it only shows a toast: `toast('Choose a new profile photo')` in `tortie/screens/profile.tsx` (two places, ~l.250 and ~l.540). Nobody can set a picture. Accounts created with email have initials only.

## Evidence

Code review. `auth-store.ts` already carries `photoURL` from Firebase (Google/Facebook sign-ins bring one), and `expo-image-picker` is installed (used for scanning).

## Fix

1. **Pick:** the camera badge opens an action sheet: *Take photo*, *Choose from library*, *Remove photo* (when one is set). Use `expo-image-picker` with `allowsEditing` and a square aspect; ask permission lazily and explain a denial.
2. **Process:** crop to square and downscale to ~512 px, JPEG ~0.8 (`expo-image-manipulator`, add if missing). Target a file under 200 KB.
3. **Store (owner decision):**
   * **Firebase Storage** `users/{uid}/avatar.jpg`, then `updateProfile(user, { photoURL })`. Needs Storage enabled in the project, security rules (owner-only write, public or signed read) and `firebase.json` configuration; none exists in the repo yet.
   * **Or the API** (`PUT /me/avatar`, store in the existing media asset storage, return a URL). Keeps one backend and lets other users' views use it later.
   Note `photoURL` set by a provider (Google) would be overwritten on the next sign-in; store the custom one separately and prefer it.
4. **Show it** everywhere the avatar appears: Profile header and collapsed bar, and the Today avatar button (and the profile button on every tab, [Q38](Q38-profile-button-on-all-tabs.md)). Fall back to initials while loading or on error. Use `expo-image` caching.
5. Offline or upload failure: keep the old picture, show an error toast with Retry.
6. Delete the stored file when the account or photo is removed.

## Acceptance criteria

- Pick from library and take a photo: the avatar updates on Profile and the tab headers without a restart, and persists after sign-out/sign-in and on a second device.
- Remove photo returns to initials.
- Denied permission shows a clear message and a link to settings.
- A provider photo is used until the user sets their own.

## Tests

- Jest: avatar source selection (custom → provider → initials); upload failure keeps the previous value.
- Manual: Android and iOS permissions, a large HEIC photo, airplane mode.
