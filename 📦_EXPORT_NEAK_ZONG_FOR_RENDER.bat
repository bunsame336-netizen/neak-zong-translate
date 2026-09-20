@echo off
chcp 65001 >nul
title 📦 Export Neak Zong Translate AI for Render.com
cls
echo =====================================================================
echo   🐉 📦 EXPORT «នាគហ្សង បកប្រែ» FOR RENDER.COM
echo =====================================================================
echo.

cd /d "%~dp0\.."

echo [*] កំពុងវេចខ្ចប់ Folder neak_zong_translate ទៅជា ZIP...
powershell -NoProfile -Command "Compress-Archive -Path 'neak_zong_translate\*' -DestinationPath 'NeakZong_Render_Deploy.zip' -Force"

if exist "NeakZong_Render_Deploy.zip" (
    echo.
    echo [✓] ជោគជ័យ! បង្កើតបានកញ្ចប់ ZIP: NeakZong_Render_Deploy.zip
    echo [*] អ្នកអាចយក File ZIP នេះ ឬ Upload ឡើង GitHub
    echo     ដើម្បី Deploy លើ Render.com បានភ្លាមៗ ២៤/៧!
) else (
    echo [X] បរាជ័យក្នុងការបង្កើត ZIP!
)

echo.
pause
