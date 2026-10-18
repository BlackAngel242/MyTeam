@echo off
setlocal
rem MyTeam : double-cliquez ce fichier / double-click this file.
rem Node.js 22+ present : installeur anime. Sinon : installeur texte (propose Node.js).
rem Options transmises : --lang fr|en, --dry-run, --demo, --simple (seulement avec Node.js).
cd /d "%~dp0"
title MyTeam - Installation
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 goto sansnode
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto sansnode
node "%~dp0scripts\installateur-anime.mjs" %*
goto fin

:sansnode
set "OPTPS="
set "DEMO="
:parse
if "%~1"=="" goto finparse
if /i "%~1"=="--demo" set "DEMO=1"
if /i "%~1"=="--dry-run" set "OPTPS=%OPTPS% -DryRun"
if /i "%~1"=="--lang" goto lang
shift
goto parse
:lang
if /i "%~2"=="fr" set "OPTPS=%OPTPS% -Lang fr"
if /i "%~2"=="en" set "OPTPS=%OPTPS% -Lang en"
shift
shift
goto parse
:finparse
echo.
if defined DEMO (
  echo La demonstration animee demande Node.js 22 ou plus : elle ne peut pas se lancer ici. Rien n'a ete fait.
  echo The animated demo needs Node.js 22 or later: it cannot run here. Nothing was done.
  goto fin
)
echo Node.js 22 ou plus est absent ou trop ancien. L'installeur texte va vous le proposer.
echo Node.js 22 or later is missing or too old. The text installer will offer it.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer.ps1"%OPTPS%
echo.
echo Installation en mode texte terminee. L'installeur anime demande Node.js 22 ou plus (relancez ce fichier une fois Node.js installe).
echo Text-mode installation finished. The animated installer needs Node.js 22 or later (run this file again once Node.js is installed).

:fin
echo.
pause
endlocal
