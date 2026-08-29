@echo off
chcp 65001 >nul
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:3344/api/shutdown' -UseBasicParsing -TimeoutSec 3 | Out-Null; Write-Host '已停止 工作生活APP' } catch { Write-Host '服务未在运行' }"
pause
