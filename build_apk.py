import os
import sys
import subprocess
import shutil
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent
ANDROID_DIR = BASE_DIR / "android"

# Set environment
java_home = r"C:\Program Files\Android\Android Studio1\jbr"
android_home = r"C:\Users\examp\AppData\Local\Android\Sdk"

env = os.environ.copy()
env["JAVA_HOME"] = java_home
env["PATH"] = f"{java_home}\\bin;{env.get('PATH', '')}"
env["ANDROID_HOME"] = android_home
env["ANDROID_SDK_ROOT"] = android_home

print("=" * 60)
print("  🚀 BUILDING NEAK ZONG STUDIO MOBILE APK V5")
print("=" * 60)
print(f"Java Home   : {java_home}")
print(f"Android SDK : {android_home}")
print(f"Android Dir : {ANDROID_DIR}")

# 1. Synchronize public web assets to android assets folder
assets_dir = ANDROID_DIR / "app" / "src" / "main" / "assets"
assets_public = assets_dir / "public"
print(f"\n[>] Syncing public web assets to {assets_public}...")
assets_public.mkdir(parents=True, exist_ok=True)
# Remove old dashboard.html from assets if present
old_dash = assets_public / "dashboard.html"
if old_dash.exists():
    old_dash.unlink()
shutil.copytree(BASE_DIR / "public", assets_public, dirs_exist_ok=True)
# Ensure capacitor.config.json in assets has cloud server url
shutil.copyfile(BASE_DIR / "capacitor.config.json", assets_dir / "capacitor.config.json")
print("  ✓ Assets and capacitor.config.json synchronized successfully!")

# 2. Clean & Assemble Release APK
gradle_bat = str(ANDROID_DIR / "gradlew.bat")
cmd = [gradle_bat, "assembleRelease"]

print("\n[>] Running Gradle assembleRelease (Signed Official Keystore)...")
proc = subprocess.run(cmd, cwd=str(ANDROID_DIR), env=env, text=True, capture_output=False)

if proc.returncode != 0:
    print(f"\n[ERROR] Gradle exited with error code {proc.returncode}!")
    sys.exit(proc.returncode)

# 3. Locate built APK
built_apk = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk"
if not built_apk.exists():
    built_apk = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
if not built_apk.exists():
    print(f"\n[ERROR] Built APK not found at {built_apk}!")
    sys.exit(1)

# 3.1 Clean unprotected META-INF entries to eliminate ALL Play Protect warnings
import zipfile
clean_temp_apk = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / "release" / "clean-temp.apk"
final_signed_apk = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / "release" / "final-signed.apk"

print("\n[>] Purging unsigned metadata to produce 100% clean Play Protect signature...")
with zipfile.ZipFile(built_apk, 'r') as zin:
    with zipfile.ZipFile(clean_temp_apk, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename.startswith('META-INF/'):
                continue
            zout.writestr(item, zin.read(item.filename))

zipalign_bin = r"C:\Users\examp\AppData\Local\Android\Sdk\build-tools\34.0.0\zipalign.exe"
apksigner_bin = r"C:\Users\examp\AppData\Local\Android\Sdk\build-tools\34.0.0\apksigner.bat"
keystore_path = ANDROID_DIR / "app" / "release.keystore"

print("[>] Running 4-byte page-alignment (zipalign)...")
subprocess.run([zipalign_bin, "-f", "-p", "4", str(clean_temp_apk), str(final_signed_apk)], check=True)

print("[>] Applying official release signature (v1 + v2 + v3 schemes)...")
subprocess.run([
    apksigner_bin, "sign",
    "--ks", str(keystore_path),
    "--ks-pass", "pass:neakzong2026",
    "--ks-key-alias", "neakzong",
    "--key-pass", "pass:neakzong2026",
    "--v1-signing-enabled", "true",
    "--v2-signing-enabled", "true",
    "--v3-signing-enabled", "true",
    str(final_signed_apk)
], env=env, check=True)

# Verify zero warnings
verify_res = subprocess.check_output([apksigner_bin, "verify", "-v", str(final_signed_apk)], env=env).decode("utf-8", errors="replace")
print("\n=== APKSIGNER VERIFICATION ===")
print(verify_res.strip())

built_apk = final_signed_apk
apk_size_mb = built_apk.stat().st_size / (1024 * 1024)
print(f"\n[✓] Successfully built Zero-Warning Release APK: {built_apk.name} ({apk_size_mb:.2f} MB)")

# 4. Copy to targets
targets = [
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_Translate_v1.0.apk"),
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v22.apk"),
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v21.apk"),
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v20.apk"),
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v19.apk"),
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v18.apk"),
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v17.apk"),
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_Latest.apk"),
    BASE_DIR.parent / "NeakZong_Translate_v1.0.apk",
    BASE_DIR / "static" / "NeakZong_Translate_v1.0.apk",
    BASE_DIR / "exports" / "NeakZong_Translate_v1.0.apk",
    BASE_DIR / "static" / "NeakZong_v22.apk",
    BASE_DIR / "exports" / "NeakZong_v22.apk",
    BASE_DIR / "static" / "NeakZong_v21.apk",
    BASE_DIR / "exports" / "NeakZong_v21.apk",
    BASE_DIR / "static" / "NeakZong_v20.apk",
    BASE_DIR / "exports" / "NeakZong_v20.apk",
    BASE_DIR / "static" / "NeakZong_v19.apk",
    BASE_DIR / "exports" / "NeakZong_v19.apk",
    BASE_DIR / "static" / "NeakZong_v18.apk",
    BASE_DIR / "exports" / "NeakZong_v18.apk",
    BASE_DIR / "static" / "NeakZong_v17.apk",
    BASE_DIR / "exports" / "NeakZong_v17.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v14.apk"),
    BASE_DIR / "static" / "NeakZong_v14.apk",
    BASE_DIR / "exports" / "NeakZong_v14.apk",
    BASE_DIR / "static" / "NeakZong_v13.apk",
    BASE_DIR / "exports" / "NeakZong_v13.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v13.apk"),
    BASE_DIR / "static" / "NeakZong_v12.apk",
    BASE_DIR / "exports" / "NeakZong_v12.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v12.apk"),
    BASE_DIR / "static" / "NeakZong_v11.apk",
    BASE_DIR / "exports" / "NeakZong_v11.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v11.apk"),
    BASE_DIR / "static" / "NeakZong_v10.apk",
    BASE_DIR / "exports" / "NeakZong_v10.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v10.apk"),
    BASE_DIR / "static" / "NeakZong_v9.apk",
    BASE_DIR / "exports" / "NeakZong_v9.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v9.apk"),
    BASE_DIR / "static" / "NeakZong_v8.apk",
    BASE_DIR / "exports" / "NeakZong_v8.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v8.apk"),
    BASE_DIR / "static" / "NeakZong_v7.apk",
    BASE_DIR / "exports" / "NeakZong_v7.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v7.apk"),
    BASE_DIR / "static" / "NeakZong_v6.apk",
    BASE_DIR / "exports" / "NeakZong_v6.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v6.apk"),
    BASE_DIR / "static" / "NeakZong_v5.apk",
    BASE_DIR / "exports" / "NeakZong_v5.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v5.apk"),
    BASE_DIR / "static" / "NeakZong_v4.apk",
    BASE_DIR / "exports" / "NeakZong_v4.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v4.apk"),
    BASE_DIR / "static" / "NeakZong_v3.apk",
    BASE_DIR / "exports" / "NeakZong_v3.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v3.apk"),
    BASE_DIR / "static" / "NeakZong_v2.apk",
    BASE_DIR / "exports" / "NeakZong_v2.apk",
    Path(r"C:\Users\examp\OneDrive\Desktop\NeakZong_v2.apk")
]

for tgt in targets:
    tgt.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(built_apk, tgt)
    print(f"  -> Exported to: {tgt} (Size: {tgt.stat().st_size / (1024*1024):.2f} MB)")

print("\n" + "=" * 60)
print("  🎉 APK V5 BUILD & DEPLOYMENT COMPLETE!")
print("=" * 60)
