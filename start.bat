@echo off
chcp 65001 >nul
title Ran-Pak 开发服务启动器

:: ============================================
:: Ran-Pak 一键启动脚本
:: 按顺序启动：云端服务 → 前端服务 → Electron
:: ============================================

echo ============================================
echo       Ran-Pak 开发环境启动中...
echo ============================================
echo.

:: 记录项目根目录
set "ROOT_DIR=%~dp0"

:: ------- 第一步：启动云端同步服务 (Go) -------
echo [1/3] 启动云端同步服务 (Go:8080)...
start "Ran-Pak Cloud" cmd /k "cd /d "%ROOT_DIR%cloud" && go run ."

:: ------- 第二步：启动前端开发服务（Vite）-------
echo [2/3] 启动前端服务 (Vite:5174)...
start "Ran-Pak Web" cmd /k "cd /d "%ROOT_DIR%web" && npm run dev"

:: 等待 Vite 启动完成
echo       等待前端服务就绪...
timeout /t 5 /nobreak >nul

:: ------- 第三步：启动 Electron 桌面应用 -------
echo [3/3] 启动 Electron 桌面应用（内置 Node API:8000）...
start "Ran-Pak App" cmd /k "cd /d "%ROOT_DIR%app" && npx electron ."

echo.
echo ============================================
echo       所有服务已启动！
echo.
echo       云端服务:  http://127.0.0.1:8080
echo       App 内置 API: http://127.0.0.1:8000
echo       前端服务:  http://localhost:5174
echo ============================================
echo.
echo 提示：关闭此窗口不会终止已启动的服务。
echo       如需停止，请逐个关闭对应的命令行窗口。
echo.
pause
