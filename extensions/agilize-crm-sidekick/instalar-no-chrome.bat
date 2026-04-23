@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM Agilize CRM Sidekick — abre o Chrome com a extensão carregada a partir de .\dist
REM Duplo clique neste ficheiro (ou execute a partir da pasta agilize-crm-sidekick).

set "SCRIPT_DIR=%~dp0"
set "EXT_DIR=%SCRIPT_DIR%dist"

if not exist "%EXT_DIR%\manifest.json" (
    echo.
    echo [ERRO] Não foi encontrado manifest.json em:
    echo        %EXT_DIR%
    echo.
    echo Gere a pasta dist na raiz do repositório:
    echo   npm run build:extension
    echo.
    echo Ou faça git pull se o dist já vier versionado no repositório.
    pause
    exit /b 1
)

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

if not defined CHROME (
    echo [ERRO] Google Chrome não encontrado nos caminhos habituais.
    pause
    exit /b 1
)

echo Abrindo Chrome com a extensão em:
echo %EXT_DIR%
echo.
echo Nota: --load-extension carrega a extensão nesta sessão. Para fixar no perfil,
echo abra chrome://extensions, ative o Modo do programador e use Carregar sem compactação nesta pasta dist.
echo.

start "" "%CHROME%" --load-extension="%EXT_DIR%"

endlocal
exit /b 0
