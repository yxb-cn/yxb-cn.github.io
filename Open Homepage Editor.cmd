@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"
set "PNPM_VERSION=11.9.0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found.
  echo Install Node.js 22.13 or newer, then run this file again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

set "PNPM_MODE="
set "PNPM_EXE="
for /f "delims=" %%I in ('where pnpm.cmd 2^>nul') do if not defined PNPM_EXE set "PNPM_EXE=%%I"
if defined PNPM_EXE set "PNPM_MODE=direct"

if not defined PNPM_EXE (
  for /f "delims=" %%I in ('where corepack.cmd 2^>nul') do if not defined PNPM_EXE set "PNPM_EXE=%%I"
  if defined PNPM_EXE set "PNPM_MODE=corepack"
)

if not defined PNPM_EXE (
  for /f "delims=" %%I in ('where npx.cmd 2^>nul') do if not defined PNPM_EXE set "PNPM_EXE=%%I"
  if defined PNPM_EXE set "PNPM_MODE=npx"
)

if not defined PNPM_EXE (
  echo.
  echo npm and pnpm were not found.
  echo Reinstall Node.js 22.13 or newer, then run this file again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vinext.cmd" (
  echo.
  echo First-time setup: installing the editor dependencies...
  echo This normally takes a few minutes and only needs to run once.
  echo.
  call :run_pnpm install --frozen-lockfile
  if errorlevel 1 (
    echo.
    echo Setup could not finish. Check your internet connection and try again.
    echo If the problem continues, run "npm install -g pnpm@%PNPM_VERSION%" and retry.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Starting the homepage editor.
echo ScholarCanvas will identify this folder and choose an available local port.
echo Keep this window open. Close it or press Ctrl+C to stop the local site.
echo.

call :run_pnpm editor

echo.
echo The local site has stopped.
pause
exit /b

:run_pnpm
if "%PNPM_MODE%"=="direct" (
  call "%PNPM_EXE%" %*
  exit /b %ERRORLEVEL%
)

if "%PNPM_MODE%"=="corepack" (
  call "%PNPM_EXE%" pnpm %*
  exit /b %ERRORLEVEL%
)

if "%PNPM_MODE%"=="npx" (
  call "%PNPM_EXE%" --yes pnpm@%PNPM_VERSION% %*
  exit /b %ERRORLEVEL%
)

exit /b 1
