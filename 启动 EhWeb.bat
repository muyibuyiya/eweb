@echo off
chcp 65001 >nul
title EhWeb iOS PWA Server
cd /d "%~dp0"

echo ========================================
echo       EhWeb — iOS 现代化阅读器启动器
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 20+。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] 首次运行，正在安装依赖...
  call npm.cmd install
  if errorlevel 1 (
    echo [错误] 依赖安装失败。
    pause
    exit /b 1
  )
)

if not exist "dist-server\server\index.js" (
  echo [2/3] 首次运行，正在构建项目...
  call npm.cmd run build
  if errorlevel 1 (
    echo [错误] 构建失败。
    pause
    exit /b 1
  )
)

netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [提示] EhWeb 服务已经在端口 3000 运行中！
  echo [提示] 正在为你打开浏览器...
  start "" "http://localhost:3000"
  timeout /t 3 >nul
  exit /b 0
)

echo [启动] 正在启动 EhWeb 服务（自动加载 .env 代理配置）...
echo [提示] 保持此窗口开启，关闭窗口或按 Ctrl+C 即可停止服务。
echo.

start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"
node dist-server\server\index.js

echo.
echo [已停止] EhWeb 服务已退出。
pause
