@echo off
chcp 65001 >nul
cd /d "%~dp0app"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node.js
  pause
  exit /b 1
)
echo 正在启动 工作生活APP ...
start "LifeApp-Server" /min cmd /c "node server.js"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:3344"
exit /b 0
