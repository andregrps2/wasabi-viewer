@echo off
setlocal enabledelayedexpansion

:: Verificar Node.js
"C:\Program Files\nodejs\node.exe" --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado!
    echo Instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js encontrado

:: Instalar dependências
"C:\Program Files\nodejs\npm.cmd" install --no-audit
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo ✓ Dependencias instaladas

:: Executar Wasabi Viewer
echo.
echo Iniciando Wasabi Viewer...
"C:\Program Files\nodejs\npm.cmd" run dev --scripts-prepend-node-path
if errorlevel 1 (
    echo ERRO: Falha ao iniciar o Wasabi Viewer!
    pause
    exit /b 1
)

echo.
echo Wasabi Viewer finalizado.
pause


