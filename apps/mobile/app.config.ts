import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends `app.json` with the native auth plugins. They need build-time values
 * (the Facebook app id and client token), which is why this is a dynamic
 * config. Both values are public identifiers that end up in the APK.
 *
 * Facebook is optional: without both values the plugin is skipped with a
 * warning and `extra.facebookEnabled` is false, which hides the Facebook
 * buttons. Email/password and Google sign-in work either way.
 */

export default ({ config }: ConfigContext): ExpoConfig => {
  const appID = process.env.FACEBOOK_APP_ID;
  const clientToken = process.env.FACEBOOK_CLIENT_TOKEN;
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    ...(config.plugins ?? []),
    // Android needs no options without google-services.json. The OAuth client
    // comes from the SHA-1 registered on the Firebase Android app.
    '@react-native-google-signin/google-signin',
  ];

  const facebookEnabled = !!(appID && clientToken);
  if (facebookEnabled) {
    plugins.push([
      'react-native-fbsdk-next',
      {
        appID,
        clientToken,
        displayName: 'Tortie',
        scheme: `fb${appID}`,
        isAutoInitEnabled: true,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
      },
    ]);
  } else {
    console.warn(
      '[app.config] FACEBOOK_APP_ID and FACEBOOK_CLIENT_TOKEN are not set (see apps/mobile/.env.example); Facebook sign-in is disabled in this build.',
    );
  }

  return {
    ...config,
    name: config.name ?? 'Tortie',
    slug: config.slug ?? 'recipe',
    plugins,
    extra: { ...config.extra, facebookEnabled },
  };
};
