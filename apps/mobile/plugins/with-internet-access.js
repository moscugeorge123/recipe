const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Keeps network access in both debug and release.
 * Android blocks non-HTTPS traffic unless the manifest allows it, and Expo
 * only sets that flag on debug builds. The API is served over HTTP in local
 * development, so release builds need the same allowance.
 */
function withInternetAccess(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    AndroidConfig.Permissions.ensurePermissions(manifest, [
      'android.permission.INTERNET',
    ]);
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
}

module.exports = withInternetAccess;
