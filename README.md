# Wasabi Viewer

Um aplicativo desktop para Windows desenvolvido em Electron que permite à equipe de suporte visualizar, baixar e copiar links de arquivos armazenados no Wasabi S3.

## Funcionalidades

### 🔧 Configuração Inicial

- Campos para Access Key, Secret Key, Bucket, Prefix, Região e Endpoint
- Validação de conexão ao salvar configurações
- Configurações são salvas localmente para próximas sessões

### 📁 Navegação de Arquivos

- Visualização hierárquica de arquivos e pastas em TreeView
- Colunas: Nome, Tamanho, Última Modificação
- Navegação por pastas com breadcrumb
- Ícones específicos por tipo de arquivo

### 🔍 Pesquisa

- Campo de busca que filtra arquivos pelo nome em tempo real
- Pesquisa funciona na pasta atual

### ⬇️ Download de Arquivos

- Seleção de pasta local para download
- Barra de progresso durante o download
- Notificações de sucesso/erro

### 🔗 Geração de Links

- **Link Público**: URL direta do arquivo (endpoint + bucket + key)
- **Link Temporário**: URL assinada com validade de 1 hora
- Cópia automática para área de transferência

## Instalação e Execução

### Pré-requisitos

- Node.js 16+
- npm ou yarn

### Passos

1. **Instalar dependências:**

   ```bash
   npm install
   ```

2. **Executar em modo desenvolvimento:**

   ```bash
   npm run dev
   ```

3. **Executar versão de produção:**

   ```bash
   npm start
   ```

4. **Gerar executável:**
   ```bash
   npm run build
   ```

## Configuração do Wasabi

### Informações Necessárias

- **Access Key**: Chave de acesso da conta Wasabi
- **Secret Key**: Chave secreta da conta Wasabi
- **Bucket**: Nome do bucket S3
- **Prefix**: Prefixo opcional para filtrar arquivos (ex: "uploads/")
- **Região**: Região do Wasabi (ex: us-east-1)
- **Endpoint**: URL do endpoint Wasabi (ex: https://s3.wasabisys.com)

### Exemplo de Configuração

```json
{
  "accessKey": "AKIAIOSFODNN7EXAMPLE",
  "secretKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "bucket": "meu-bucket",
  "prefix": "suporte/",
  "region": "us-east-1",
  "endpoint": "https://s3.wasabisys.com"
}
```

## Estrutura do Projeto

```
wasabi-viewer/
├── src/
│   ├── main.js              # Processo principal do Electron
│   ├── preload.js           # Script de preload para segurança
│   └── renderer/
│       ├── index.html       # Interface principal
│       ├── styles.css       # Estilos CSS
│       └── renderer.js      # Lógica da interface
├── assets/
│   └── icon.png            # Ícone do aplicativo
├── package.json            # Configurações e dependências
└── README.md              # Este arquivo
```

## Tecnologias Utilizadas

- **Electron**: Framework para aplicações desktop
- **AWS SDK v3**: Para interação com S3/Wasabi
- **Font Awesome**: Ícones da interface
- **CSS Grid/Flexbox**: Layout responsivo

## Funcionalidades de Segurança

- Context Isolation habilitado
- Node Integration desabilitado
- Comunicação segura via IPC (Inter-Process Communication)
- Preload script para exposição controlada de APIs

## Personalização

### Adicionando Novos Tipos de Arquivo

Edite a função `getFileIcon()` em `renderer.js` para adicionar novos tipos:

```javascript
const iconMap = {
  // Adicione novos tipos aqui
  mov: "fas fa-file-video",
  wav: "fas fa-file-audio",
};
```

### Modificando Regiões Disponíveis

Edite o select de região em `index.html`:

```html
<select id="region" required>
  <option value="us-east-1">us-east-1</option>
  <option value="nova-regiao">Nova Região</option>
</select>
```

## Resolução de Problemas

### Erro de Conexão

- Verifique as credenciais (Access Key e Secret Key)
- Confirme o nome do bucket
- Teste o endpoint no navegador
- Verifique se a região está correta

### Erro de Permissão

- Certifique-se de que a conta tem permissões de leitura no bucket
- Verifique as políticas IAM (se aplicável)

### Arquivos Não Aparecem

- Verifique o prefixo configurado
- Confirme se existem arquivos no bucket
- Use o botão "Atualizar" para recarregar

## Suporte

Para reportar bugs ou solicitar funcionalidades, entre em contato com a equipe de desenvolvimento.

## Licença

Este projeto está sob licença MIT.
