@echo off
chcp 65001 >nul
echo =======================================================================
echo   🚀 BUILDING NEAK ZONG STUDIO MOBILE APK V2 (NeakZong_v2.apk)
echo =======================================================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=C:\Users\examp\AppData\Local\Android\Sdk"

echo [1/3] Checking Java and Android SDK...
echo   JAVA_HOME: %JAVA_HOME%
echo   ANDROID_HOME: %ANDROID_HOME%

echo [2/4] Syncing public web assets to android assets...
xcopy /s /e /y "%~dp0public\*" "%~dp0android\app\src\main\assets\public\" >nul

cd /d "%~dp0android"

echo [3/4] Building APK with Gradle (assembleDebug)...
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gradle build failed with error code %ERRORLEVEL%!
    exit /b %ERRORLEVEL%
)

echo [4/4] Locating built APK and copying to outputs...
set "BUILT_APK=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%BUILT_APK%" (
    echo [ERROR] Built APK not found at %BUILT_APK%!
    exit /b 1
)

mkdir "%~dp0static" 2>nul
mkdir "%~dp0exports" 2>nul
copy /y "%BUILT_APK%" "%~dp0static\NeakZong_v6.apk"
copy /y "%BUILT_APK%" "%~dp0exports\NeakZong_v6.apk"
copy /y "%BUILT_APK%" "C:\Users\examp\OneDrive\Desktop\NeakZong_v6.apk"
copy /y "%BUILT_APK%" "%~dp0static\NeakZong_v5.apk"
copy /y "%BUILT_APK%" "%~dp0exports\NeakZong_v5.apk"
copy /y "%BUILT_APK%" "C:\Users\examp\OneDrive\Desktop\NeakZong_v5.apk"
copy /y "%BUILT_APK%" "%~dp0static\NeakZong_v4.apk"
copy /y "%BUILT_APK%" "%~dp0exports\NeakZong_v4.apk"
copy /y "%BUILT_APK%" "C:\Users\examp\OneDrive\Desktop\NeakZong_v4.apk"

echo.
echo =======================================================================
echo   ✅ BUILD SUCCESSFUL!
echo   Output APK: NeakZong_v6.apk
echo   - neak_zong_translate/static/NeakZong_v6.apk
echo   - neak_zong_translate/exports/NeakZong_v6.apk
echo   - Desktop/NeakZong_v6.apk
echo =======================================================================
