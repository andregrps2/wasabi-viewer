@echo off
echo Instalando dependencias...
"C:\Program Files\nodejs\npm.cmd" install
echo.
echo Iniciando Wasabi Viewer em modo desenvolvimento...
"C:\Program Files\nodejs\npm.cmd" run dev
pause


