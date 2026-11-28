@echo off
title Ershak
cd /d "%~dp0"

where java >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Java is not installed. Install Java 21 from https://adoptium.net and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo  Starting Ershak... your browser will open in a few seconds.
echo  Keep this window open. Close it to stop the server.
echo.
java --enable-native-access=ALL-UNNAMED -jar release\ershak.jar --open
pause
