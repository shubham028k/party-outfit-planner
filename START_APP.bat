@echo off
setlocal
cd /d "%~dp0"

set "PYTHON=%~dp0.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo Creating the Python environment...
    py -3 -m venv "%~dp0.venv"
    if errorlevel 1 goto python_error
)

"%PYTHON%" -c "import flask, openai, PIL, dotenv, dateutil" >nul 2>nul
if errorlevel 1 (
    echo Installing the app requirements...
    "%PYTHON%" -m pip install -r "%~dp0backend\requirements.txt"
    if errorlevel 1 goto install_error
)

echo Starting Party Outfit Planner...
start "Party Outfit Planner Server" /D "%~dp0backend" "%PYTHON%" -m flask --app app run --host 127.0.0.1 --port 5000

for /L %%i in (1,1,20) do (
    curl.exe --silent --fail --output nul "http://127.0.0.1:5000/login"
    if not errorlevel 1 goto app_ready
    timeout /t 1 /nobreak >nul
)
goto app_start_error

:app_ready
start "" "http://127.0.0.1:5000"
goto end

:python_error
echo Could not create the Python environment. Install Python 3 and try again.
pause
exit /b 1

:app_start_error
echo The app did not start on port 5000. Check whether another app is using that port.
pause
exit /b 1

:install_error
echo Could not install the app requirements. Check your internet connection.
pause
exit /b 1

:end
endlocal