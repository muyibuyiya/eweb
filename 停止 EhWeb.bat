@echo off
chcp 65001 >nul
title 停止 EhWeb
echo 正在停止 EhWeb 服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo 已停止端口 3000 上的 EhWeb 服务。
timeout /t 2 >nul
