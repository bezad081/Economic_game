@echo off
cd /d "%~dp0"
python main.py
if errorlevel 1 (
  echo.
  echo MACROSTATE exited with an error.
  echo Install dependencies with: python -m pip install -r requirements.txt
  pause
)
