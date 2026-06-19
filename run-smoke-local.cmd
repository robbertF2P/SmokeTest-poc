@echo off
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%~dp0.env.smoke.local") do (
    if not "%%A"=="" set "%%A=%%B"
)
cd /d "%~dp0"
npm run test:smoke:edge
