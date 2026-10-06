@echo off
title Skillversity IT Support & Complaint Portal
color 0A
echo =======================================================
echo 🎓 Skillversity IT Support & Complaint Web App
echo 🌐 Starting Local Server on http://localhost:3000 ...
echo =======================================================
echo.

:: Open default browser to http://localhost:3000 after 2 seconds
start "" "http://localhost:3000"

:: Run Node Server
node server.js
pause
