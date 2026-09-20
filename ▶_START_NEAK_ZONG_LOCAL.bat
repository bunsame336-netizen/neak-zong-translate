@echo off
chcp 65001 >nul
title 🐉 នាគហ្សង បកប្រែ — Neak Zong Translate AI Studio
cls
echo =====================================================================
echo   🐉 «នាគហ្សង បកប្រែ» (NEAK ZONG TRANSLATE AI)
echo   Mobile-First AI Video Translator ^& Khmer Voice Studio
echo =====================================================================
echo.

cd /d "%~dp0"

echo [*] កំពុងពិនិត្យ Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] មិនមាន Python ទេ! សូមដំឡើង Python 3.10+ ជាមុនសិន។
    pause
    exit /b 1
)

echo [*] កំពុងបើក Server លើ Port 5060...
start "" http://127.0.0.1:5060/
python app.py

pause
