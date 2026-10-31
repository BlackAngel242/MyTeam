@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est absent.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Installer Node.js 22 ou plus depuis https://nodejs.org/ puis relancer ce fichier.
    pause
    exit /b 1
  )
  echo Installation de Node.js LTS via winget.
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo Installation de Node.js non confirmee.
    pause
    exit /b 1
  )
  echo Ouvrir une nouvelle fenetre pour mettre le PATH a jour, puis relancer.
  pause
  exit /b 0
)
echo Installation locale de Fixit et TableRonde pour Codex.
node "%~dp0installer.mjs" --tool codex --scope user
set "RESULTAT=%ERRORLEVEL%"
pause
exit /b %RESULTAT%
