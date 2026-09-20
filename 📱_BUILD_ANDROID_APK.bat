@echo off
chcp 65001 >nul
title 📱 Build Android APK - នាគហ្សង បកប្រែ
cls
echo =====================================================================
echo   🐉 📱 BUILD ANDROID APK: «នាគហ្សង បកប្រែ» (NEAK ZONG TRANSLATE)
echo =====================================================================
echo.

echo របៀបដំឡើង និងដំណើរការលើទូរស័ព្ទដៃ៖
echo --------------------------------------------------
echo [វិធីទី១ - លឿន និងងាយបំផុត (PWA Install)]៖
echo   ១. បើក Link Render.com (ឧ. https://your-neakzong.onrender.com) លើ Chrome ទូរស័ព្ទ
echo   ២. ចុច Menu ចុច 'Add to Home screen' (ឬ 'Install App')
echo   ៣. កម្មវិធី «នាគហ្សង បកប្រែ» នឹងលោតឡើងជា App ពេញលេញលើ Home Screen ទូរស័ព្ទ!
echo.
echo [វិធីទី២ - Build ជា File Android APK ផ្ទាល់]៖
echo   - ប្រើប្រាស់ Capacitor / Cordova ដើម្បី Wrap Folder នេះ
echo   - npx @capacitor/cli create
echo   - npx cap add android
echo   - npx cap open android (ហើយ build .apk តាម Android Studio)
echo --------------------------------------------------
echo.
pause
