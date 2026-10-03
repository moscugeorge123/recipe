const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Cooking timers schedule a notification for an exact end time. Without this
 * permission Android 12+ may defer that alarm while the phone is idle.
 */
function withExactAlarm(config) {
  return withAndroidManifest(config, (mod) => {
    AndroidConfig.Permissions.ensurePermissions(mod.modResults, [
      'android.permission.SCHEDULE_EXACT_ALARM',
    ]);
    return mod;
  });
}

module.exports = withExactAlarm;
