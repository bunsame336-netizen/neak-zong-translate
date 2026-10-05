@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=C:\Users\examp\AppData\Local\Android\Sdk"
echo JAVA_HOME is %JAVA_HOME%
java -version
cd /d "%~dp0android"
call gradlew.bat --version
