@echo off
rem Removes the Matrix Rain mod (animation, splitters, theme file) and restores T3's original files.
rem Full path to Windows find: a Unix "find" earlier in PATH (Git) would make this check fail open.
tasklist /FI "IMAGENAME eq T3 Code (Beta).exe" /NH 2>nul | "%SystemRoot%\System32\find.exe" /I "T3 Code" >nul
if not errorlevel 1 (
  echo T3 Code is running. Quit it completely, then run this again.
  pause
  exit /b 1
)
node "%~dp0install.mjs" --remove-mod matrix
pause
