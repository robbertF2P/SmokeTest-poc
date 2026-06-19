@echo off
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%~dp0.env.smoke.local") do (
    if not "%%A"=="" set "%%A=%%B"
)
powershell -ExecutionPolicy Bypass -File "%~dp0run-smoke-podman.ps1"
