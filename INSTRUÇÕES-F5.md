# 🚀 Como Usar F5 para Executar o Wasabi Viewer

## ✅ Problema Corrigido
O erro "Can't find Node.js binary 'npm'" foi corrigido configurando os caminhos absolutos do Node.js.

## 🎯 Configurações Criadas

### 1. **Configurações de Debug (.vscode/launch.json)**
- **F5**: "Wasabi Viewer - Debug (F5)" - Executa `npm run dev`
- **Ctrl+F5**: "Wasabi Viewer - Start (Ctrl+F5)" - Executa `npm start`
- **Alternativa**: "Wasabi Viewer - Batch Script" - Usa script batch

### 2. **Scripts Batch Criados**
- `run-dev.bat` - Para desenvolvimento
- `run-start.bat` - Para produção

## 🎮 Como Usar

### **Opção 1: F5 no Cursor (Recomendado)**
1. Abra o projeto no Cursor
2. Pressione **F5**
3. O projeto será executado automaticamente

### **Opção 2: Scripts Batch**
1. Execute `run-dev.bat` para desenvolvimento
2. Execute `run-start.bat` para produção

### **Opção 3: Terminal Manual**
```bash
# Instalar dependências
"C:\Program Files\nodejs\npm.cmd" install

# Executar em desenvolvimento
"C:\Program Files\nodejs\npm.cmd" run dev

# Executar em produção
"C:\Program Files\nodejs\npm.cmd" start
```

## 🔧 Configurações Técnicas

### **Caminhos Configurados**
- Node.js: `C:\Program Files\nodejs\node.exe`
- NPM: `C:\Program Files\nodejs\npm.cmd`

### **Atalhos Disponíveis**
- **F5**: Debug/Desenvolvimento
- **Ctrl+F5**: Produção
- **Shift+F5**: Parar execução
- **Ctrl+Shift+F5**: Reiniciar

## 🐛 Solução de Problemas

### **Se ainda der erro:**
1. Verifique se o Node.js está instalado em `C:\Program Files\nodejs\`
2. Execute os scripts batch manualmente
3. Use o terminal integrado do Cursor

### **Para verificar instalação:**
```powershell
Test-Path "C:\Program Files\nodejs\node.exe"
Test-Path "C:\Program Files\nodejs\npm.cmd"
```

## 📁 Arquivos Criados
- `.vscode/launch.json` - Configurações de debug
- `.vscode/tasks.json` - Tasks de build
- `.vscode/settings.json` - Configurações do workspace
- `.vscode/keybindings.json` - Atalhos personalizados
- `run-dev.bat` - Script para desenvolvimento
- `run-start.bat` - Script para produção

## 🎉 Pronto!
Agora você pode usar **F5** para executar o Wasabi Viewer diretamente no Cursor!


