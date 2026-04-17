# Mobile First + Build APK

## 1. Set your online backend URL

Edit [scripts/mobile-config.js](scripts/mobile-config.js) and set:

window.ZAP_MOBILE_API_URL = 'https://your-backend-domain';

Use your deployed backend domain (Render/Railway/etc), no trailing slash.

## 2. Prepare and sync mobile assets

From project root:

npm run mobile:sync

This copies web files into the Android project and updates Capacitor.

## 3. Open Android project

npm run mobile:android

This opens Android Studio with the generated [android](android) project.

## 4. Build debug APK

Option A (Android Studio):
- Build > Build Bundle(s) / APK(s) > Build APK(s)

Option B (terminal, Windows):

npm run mobile:apk:debug

APK output path:
- [android/app/build/outputs/apk/debug/app-debug.apk](android/app/build/outputs/apk/debug/app-debug.apk)

## 5. Install on phone

- Enable Developer Options + USB debugging on Android device.
- Connect via USB.
- Use Android Studio Run, or:

adb install -r android/app/build/outputs/apk/debug/app-debug.apk

## 6. After any frontend code change

Run again:

npm run mobile:sync

Then rebuild APK.

## Notes

- Backend must be online and reachable from your phone network.
- For Socket.IO in production, set backend `SOCKET_IO_CORS` to your app/web origin(s).
- If login works but realtime fails, verify backend URL in [scripts/mobile-config.js](scripts/mobile-config.js) and redeploy/rebuild.
