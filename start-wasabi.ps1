# Script PowerShell para executar o Wasabi Viewer
Write-Host "🚀 Iniciando Wasabi Viewer..." -ForegroundColor Green

# Verificar se Node.js está instalado
$nodePath = "C:\Program Files\nodejs\node.exe"
$npmPath = "C:\Program Files\nodejs\npm.cmd"

if (-not (Test-Path $nodePath)) {
    Write-Host "❌ Node.js não encontrado em $nodePath" -ForegroundColor Red
    Write-Host "Por favor, instale o Node.js primeiro." -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "✅ Node.js encontrado" -ForegroundColor Green

# Verificar se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
    & $npmPath install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    Write-Host "✅ Dependências instaladas" -ForegroundColor Green
} else {
    Write-Host "✅ Dependências já instaladas" -ForegroundColor Green
}

# Executar o projeto
Write-Host "🎯 Executando Wasabi Viewer..." -ForegroundColor Cyan
& $npmPath run dev

Write-Host "👋 Wasabi Viewer finalizado" -ForegroundColor Yellow
Read-Host "Pressione Enter para sair"


