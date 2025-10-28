@echo off
echo ========================================
echo    WASABI VIEWER - EXECUTOR CORRIGIDO
echo ========================================
echo.

echo [1/3] Verificando Node.js...
set "NODE_PATH=C:\Program Files\nodejs"
if not exist "%NODE_PATH%\node.exe" (
    echo ERRO: Node.js nao encontrado em %NODE_PATH%!
    echo Instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js encontrado

echo.
echo [2/3] Adicionando Node.js ao PATH...
set "PATH=%PATH%;%NODE_PATH%"

echo.
echo [3/3] Executando Wasabi Viewer...
echo.
"%NODE_PATH%\npm.cmd" run start

echo.
echo Wasabi Viewer finalizado.
pause

