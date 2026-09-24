"""Configura los enlaces móviles sobre los proyectos generados por Flutter."""
from pathlib import Path
import plistlib

root = Path(__file__).resolve().parents[1] / 'flutter'
manifest = root / 'android/app/src/main/AndroidManifest.xml'
if manifest.exists():
    text = manifest.read_text(encoding='utf-8')
    if 'android.permission.INTERNET' not in text:
        text = text.replace('    <application', '    <uses-permission android:name="android.permission.INTERNET"/>\n    <application', 1)
    if 'android:scheme="guiafit"' not in text:
        callback = '''            <meta-data android:name="flutter_deeplinking_enabled" android:value="false" />
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="guiafit" android:host="auth-callback" />
            </intent-filter>
'''
        text = text.replace('        </activity>', callback + '        </activity>', 1)
    if 'android:allowBackup=' not in text:
        text = text.replace('<application', '<application android:allowBackup="false"', 1)
    text = text.replace('android:label="guia_fit"', 'android:label="Guía FIT"')
    manifest.write_text(text, encoding='utf-8')
    print('Android: permiso de internet y retorno de autenticación configurados.')
info = root / 'ios/Runner/Info.plist'
if info.exists():
    data = plistlib.loads(info.read_bytes())
    data['CFBundleDisplayName'] = 'Guía FIT'
    data['CFBundleURLTypes'] = [{'CFBundleTypeRole':'Editor','CFBundleURLName':'mx.guiafit.auth','CFBundleURLSchemes':['guiafit']}]
    data['FlutterDeepLinkingEnabled'] = False
    info.write_bytes(plistlib.dumps(data, sort_keys=False))
    print('iOS: retorno de autenticación configurado.')
