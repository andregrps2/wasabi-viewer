# 🚀 COMO USAR F5 PARA EXECUTAR O WASABI VIEWER

## ✅ PROBLEMA RESOLVIDO!

Criei uma configuração robusta que funciona mesmo se as dependências não estiverem instaladas.

## 🎯 COMO USAR AGORA

### **OPÇÃO 1: F5 no Cursor (RECOMENDADO)**
1. **Abra o projeto no Cursor**
2. **Pressione F5**
3. **O script executará automaticamente:**
   - ✅ Verifica se Node.js está instalado
   - ✅ Instala dependências se necessário
   - ✅ Executa o Wasabi Viewer

### **OPÇÃO 2: Executar Script Manualmente**
1. **Clique duplo em `executar-wasabi.bat`**
2. **O script fará tudo automaticamente**

## 🔧 O QUE FOI CRIADO

### **Arquivos de Execução**
- `executar-wasabi.bat` - Script principal (executa tudo automaticamente)
- `start-wasabi.ps1` - Script PowerShell alternativo
- `run-dev.bat` - Script simples para desenvolvimento
- `run-start.bat` - Script simples para produção

### **Configurações do Cursor**
- `.vscode/launch.json` - Configuração F5 atualizada
- `.vscode/tasks.json` - Tasks de build
- `.vscode/settings.json` - Configurações do workspace

## 🎮 ATALHOS CONFIGURADOS

- **F5**: Executa o Wasabi Viewer (configuração principal)
- **Ctrl+F5**: Executa em modo produção
- **Shift+F5**: Para a execução atual
- **Ctrl+Shift+F5**: Reinicia a execução

## 🐛 SE AINDA NÃO FUNCIONAR

### **Teste Manual:**
1. Execute `executar-wasabi.bat` diretamente
2. Se funcionar, o F5 também funcionará

### **Verificações:**
- Node.js instalado em `C:\Program Files\nodejs\`
- Permissões de execução no Windows
- Antivírus não bloqueando scripts

## 📋 O QUE O SCRIPT FAZ

```batch
1. Verifica se Node.js está instalado
2. Instala dependências (npm install)
3. Executa o projeto (npm run dev)
4. Mostra mensagens de progresso
5. Pausa no final para ver resultados
```

## 🎉 PRONTO!

**Agora você pode:**
1. **Pressionar F5** no Cursor
2. **O Wasabi Viewer será executado automaticamente**
3. **A aplicação abrirá em uma nova janela**

### **Se preferir execução manual:**
- Clique duplo em `executar-wasabi.bat`
- O script fará tudo sozinho!

## 🔍 DEBUGGING

Se houver problemas, o script mostrará mensagens claras:
- ✅ Verde = Sucesso
- ❌ Vermelho = Erro
- ⚠️ Amarelo = Aviso

**Teste agora pressionando F5!** 🚀


