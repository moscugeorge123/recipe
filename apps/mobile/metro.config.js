const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// FallbackWatcher tests blockList against absolute paths. Expo's default
// `^android/app/build$` only matches a project-relative path, so Gradle and
// CMake output is still watched and exhausts the Linux inotify limit.
const nativeBuildOutput =
  /(?:^|[/\\])(?:android[/\\](?:app[/\\])?build|android[/\\]\.gradle|\.cxx|ios[/\\](?:Pods|build))(?:[/\\]|$)/;

const blockList = config.resolver.blockList;
config.resolver.blockList = Array.isArray(blockList)
  ? [...blockList, nativeBuildOutput]
  : [blockList, nativeBuildOutput].filter(Boolean);

module.exports = withNativeWind(config, { input: './src/global.css' });
