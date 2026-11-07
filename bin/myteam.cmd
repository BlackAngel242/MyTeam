@echo off
rem Commande myteam : bureau des agents + Herdr (session MyTeam). Voir scripts\myteam.mjs.
chcp 65001 >nul
node "%~dp0myteam" %*
if errorlevel 1 if not defined MYTEAM_SANS_PAUSE pause
