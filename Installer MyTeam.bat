@echo off
setlocal
rem MyTeam : double-cliquez ce fichier / double-click this file.
rem Node.js 22+ present : installeur anime. Sinon : installeur texte (propose Node.js).
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
echo.
echo Node.js 22 ou plus est absent ou trop ancien. L'installeur texte va vous le proposer.
echo Node.js 22 or later is missing or too old. The text installer will offer it.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer.ps1"
echo.
echo Si Node.js vient d'etre installe, relancez ce fichier pour l'installation animee.
echo If Node.js was just installed, run this file again for the animated installer.

:fin
echo.
pause
endlocal
