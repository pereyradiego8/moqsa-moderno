#!/usr/bin/env bash
set -euo pipefail
if ! command -v gradle >/dev/null; then
  echo 'Falta Gradle 8.9. Abrí el proyecto en Android Studio o usá GitHub Actions.' >&2
  exit 2
fi
if [[ -z "${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}" ]]; then
  echo 'Falta ANDROID_SDK_ROOT/ANDROID_HOME y SDK Android 35.' >&2
  exit 2
fi
gradle --no-daemon :app:assembleDebug
printf 'APK: %s\n' "$(pwd)/app/build/outputs/apk/debug/app-debug.apk"
