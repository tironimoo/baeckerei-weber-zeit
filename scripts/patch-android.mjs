// Passt das von Capacitor erzeugte Android-Projekt an: NFC erlauben, keine Sicherungskopien in die Cloud, nur HTTPS.
import { readFile, writeFile } from 'node:fs/promises';
const f = 'android/app/src/main/AndroidManifest.xml';
let x = await readFile(f, 'utf8');
if (!x.includes('android.permission.NFC')) {
  x = x.replace('<application', '<uses-permission android:name="android.permission.NFC" />\n    <uses-feature android:name="android.hardware.nfc" android:required="false" />\n    <application');
}
x = x.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="false"');
if (!x.includes('usesCleartextTraffic')) x = x.replace('<application', '<application android:usesCleartextTraffic="false"');
await writeFile(f, x);
console.log(x);
