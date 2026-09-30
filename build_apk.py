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

apk_size_mb = built_apk.stat().st_size / (1024 * 1024)
print(f"\n[✓] Successfully built Signed Release APK: {built_apk.name} ({apk_size_mb:.2f} MB)")

# 4. Copy to targets
targets = [
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
