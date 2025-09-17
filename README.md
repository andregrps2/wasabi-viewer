# Wasabi Viewer

Aplicativo desktop em Electron para visualizar e baixar arquivos de buckets Wasabi S3.

## Como usar

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Execute em modo desenvolvimento:

   ```bash
   npm run dev
   ```

3. Para build/produção:

   ```bash
   npm run build
   ```

## Recursos principais

- Gerencie múltiplas conexões Wasabi S3
- Visualize, pesquise e baixe arquivos
- Geração de links temporários
- Compartilhamento seguro de acesso via token

## Configuração

- As credenciais e buckets são salvos localmente (não vão para o Git)
- Não compartilhe tokens ou credenciais publicamente
- **Importante:** Troque a chave de criptografia (`ENCRYPTION_KEY` em `main.js`) antes de usar em produção!

## Segurança

- Context isolation e preload habilitados
- Nenhuma credencial é exposta no código-fonte

## Estrutura

```
wasabi-viewer/
├── src/
│   ├── main.js        # Backend Electron
│   ├── preload.js     # Preload seguro
│   └── renderer/
│       ├── index.html
│       ├── renderer.js
│       └── styles.css
├── assets/
├── package.json
└── README.md
```

MIT License
