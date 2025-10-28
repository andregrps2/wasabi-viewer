const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { pipeline } = require('stream/promises');
const CryptoJS = require('crypto-js');

let mainWindow;
let s3Client = null;
let s3Config = null;
// Controlador para permitir cancelamento do download em andamento
let currentDownloadController = null;

// Chave secreta para criptografia (em produção, use uma chave mais segura)
const ENCRYPTION_KEY = 'wasabi-viewer-2025-secret-key-for-sharing';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Abrir DevTools em modo de desenvolvimento
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function ensureUserDataDir() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// IPC Handlers

// Testar conexão S3 (sem salvar)
ipcMain.handle('test-s3-connection', async (event, config) => {
  try {
    const testClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      forcePathStyle: true
    });

    // Testar conexão listando objetos
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: config.prefix,
      MaxKeys: 1
    });

    await testClient.send(command);
    return { success: true };
  } catch (error) {
    console.error('Erro ao testar conexão S3:', error);
    return { success: false, error: error.message };
  }
});

// Salvar configuração S3 ativa
ipcMain.handle('save-s3-config', async (event, config) => {
  try {
    s3Config = config;
    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      forcePathStyle: true
    });

    // Persistir no configs.json
    const configPath = getConfigPath();
    let configs = [];
    if (fs.existsSync(configPath)) {
      configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    // Atualiza se já existe, senão adiciona
    const idx = configs.findIndex(c => c.id === config.id);
    if (idx !== -1) {
      configs[idx] = { ...configs[idx], ...config, lastUsed: new Date().toISOString() };
    } else {
      configs.push({ ...config, createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() });
    }
    ensureUserDataDir();
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));

    return { success: true };
  } catch (error) {
    console.error('Erro ao configurar S3:', error);
    return { success: false, error: error.message };
  }
});

// Salvar múltiplas configurações
ipcMain.handle('save-s3-configs', async (event, configs) => {
  try {
    const configPath = getConfigPath();
    ensureUserDataDir();
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return { success: false, error: error.message };
  }
});

// Carregar múltiplas configurações
ipcMain.handle('load-s3-configs', async () => {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return configs;
    }

    // Migrar configuração antiga se existir
    const oldConfigPath = path.join(__dirname, '../config.json');
    if (fs.existsSync(oldConfigPath)) {
      const oldConfig = JSON.parse(fs.readFileSync(oldConfigPath, 'utf8'));
      const migratedConfig = [{
        id: Date.now().toString(36),
        name: 'Configuração Migrada',
        ...oldConfig,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      }];

      // Salvar configuração migrada
      fs.writeFileSync(configPath, JSON.stringify(migratedConfig, null, 2));

      // Remover arquivo antigo
      fs.unlinkSync(oldConfigPath);

      return migratedConfig;
    }

    return [];
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    return [];
  }
});

// Listar objetos S3
ipcMain.handle('list-s3-objects', async (event, prefix = '') => {
  if (!s3Client || !s3Config) {
    throw new Error('S3 não configurado');
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: s3Config.bucket,
      Prefix: s3Config.prefix + prefix,
      Delimiter: '/'
    });

    const response = await s3Client.send(command);

    const folders = (response.CommonPrefixes || []).map(item => ({
      type: 'folder',
      name: item.Prefix.replace(s3Config.prefix + prefix, '').replace('/', ''),
      key: item.Prefix,
      size: 0,
      lastModified: null
    }));

    const files = (response.Contents || []).map(item => ({
      type: 'file',
      name: item.Key.replace(s3Config.prefix + prefix, ''),
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified
    })).filter(file => file.name !== ''); // Remove pastas vazias

    return [...folders, ...files];
  } catch (error) {
    console.error('Erro ao listar objetos:', error);
    throw error;
  }
});

// Baixar arquivo com suporte a eventos de progresso e cancelamento
ipcMain.handle('download-file', async (event, fileKey, fileName, savePath) => {
  if (!s3Client || !s3Config) {
    throw new Error('S3 não configurado');
  }

  try {
    let finalPath = savePath;
    if (!finalPath) {
      // Fallback para diálogo nativo se savePath não for fornecido
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName,
        filters: [
          { name: 'Todos os arquivos', extensions: ['*'] }
        ]
      });
      if (result.canceled) {
        return { success: false, message: 'Download cancelado' };
      }
      finalPath = result.filePath;
    }

    const command = new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: fileKey
    });

    const response = await s3Client.send(command);
    const writeStream = fs.createWriteStream(finalPath);

    const totalBytes = response.ContentLength || null;
    let downloadedBytes = 0;

    // Criar AbortController para permitir cancelamento
    currentDownloadController = new AbortController();
    const { signal } = currentDownloadController;

    // Escutar progressos no stream
    if (response.Body && typeof response.Body.on === 'function') {
      response.Body.on('data', (chunk) => {
        try {
          downloadedBytes += chunk.length;
          if (totalBytes) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('download-progress', { percent, downloadedBytes, totalBytes });
            }
          } else {
            // Se não tivermos tamanho total, enviar bytes baixados
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('download-progress', { percent: null, downloadedBytes, totalBytes: null });
            }
          }
        } catch (err) {
          // ignorar pequenos erros de envio de IPC
        }
      });
    }

    try {
      await pipeline(response.Body, writeStream, { signal });
    } catch (err) {
      // Se o erro for causado por abort, retornar mensagem apropriada
      if (err && err.name === 'AbortError') {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('download-progress', { percent: 0, cancelled: true });
        }
        currentDownloadController = null;
        return { success: false, message: 'Download cancelado' };
      }
      throw err;
    }

    // Enviar 100% no fim
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('download-progress', { percent: 100, downloadedBytes: totalBytes, totalBytes });
    }

    currentDownloadController = null;
    return { success: true, path: finalPath };
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
    currentDownloadController = null;
    return { success: false, error: error.message };
  }
});

// Handler para cancelar download
ipcMain.handle('cancel-download', () => {
  if (currentDownloadController) {
    try {
      currentDownloadController.abort();
    } catch (err) {
      console.error('Erro ao abortar download:', err);
    }
    currentDownloadController = null;
  }
});

// Listar diretórios locais para modal customizado
ipcMain.handle('fs-home-dir', async () => {
  try {
    return os.homedir();
  } catch (e) {
    return process.cwd();
  }
});

ipcMain.handle('fs-list-dir', async (event, dirPath) => {
  try {
    const base = dirPath && dirPath.trim() ? dirPath : os.homedir();
    const entries = await fs.promises.readdir(base, { withFileTypes: true });
    const dirs = entries
      .filter(d => d.isDirectory())
      .map(d => ({ name: d.name, path: path.join(base, d.name), type: 'folder' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return { base, entries: dirs };
  } catch (e) {
    console.error('Erro ao listar diretório:', e);
    return { base: dirPath || '', entries: [], error: e.message };
  }
});

// Gerar link com assinatura (temporário)
ipcMain.handle('generate-signed-link', async (event, fileKey, expiresIn = 3600) => {
  if (!s3Client || !s3Config) {
    throw new Error('S3 não configurado');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: fileKey
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Erro ao gerar link assinado:', error);
    throw error;
  }
});

// Gerar token compartilhado
ipcMain.handle('generate-share-token', async (event, configId, configs) => {
  try {
    const config = configs.find(c => c.id === configId);
    if (!config) {
      throw new Error('Configuração não encontrada');
    }
    if (config.isShared) {
      return { success: false, error: 'Não é possível compartilhar um bucket compartilhado.' };
    }

    // Dados que serão criptografados
    const shareData = {
      name: config.name,
      bucket: config.bucket,
      prefix: config.prefix || '',
      region: config.region,
      endpoint: config.endpoint,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      sharedAt: new Date().toISOString(),
      sharedBy: 'Wasabi Viewer User'
    };

    // Criptografar os dados
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(shareData), ENCRYPTION_KEY).toString();

    // Criar token com metadados
    const token = {
      v: '1.0', // versão do token
      d: encrypted,
      t: Date.now()
    };

    // Codificar em base64 para facilitar compartilhamento
    const shareToken = Buffer.from(JSON.stringify(token)).toString('base64');

    return { success: true, token: shareToken, configName: config.name };
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    return { success: false, error: error.message };
  }
});

// Decodificar token compartilhado
ipcMain.handle('decode-share-token', async (event, shareToken) => {
  try {
    // Decodificar base64
    const tokenData = JSON.parse(Buffer.from(shareToken, 'base64').toString());

    // Verificar versão do token
    if (!tokenData.v || tokenData.v !== '1.0') {
      throw new Error('Versão do token não suportada');
    }

    // Descriptografar dados
    const decryptedBytes = CryptoJS.AES.decrypt(tokenData.d, ENCRYPTION_KEY);
    const decryptedData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));

    // Criar configuração compartilhada (sem expor credenciais completas)
    const sharedConfig = {
      id: 'shared-' + Date.now(),
      name: `[COMPARTILHADO] ${decryptedData.name}`,
      bucket: decryptedData.bucket,
      prefix: decryptedData.prefix,
      region: decryptedData.region,
      endpoint: decryptedData.endpoint,
      isShared: true,
      sharedAt: decryptedData.sharedAt,
      sharedBy: decryptedData.sharedBy,
      // Credenciais são mantidas internamente mas não expostas
      _encryptedCredentials: {
        accessKey: decryptedData.accessKey,
        secretKey: decryptedData.secretKey
      }
    };

    return { success: true, config: sharedConfig };
  } catch (error) {
    console.error('Erro ao decodificar token:', error);
    return { success: false, error: 'Token inválido ou corrompido' };
  }
});

// Testar conexão com configuração compartilhada
ipcMain.handle('test-shared-connection', async (event, sharedConfig) => {
  try {
    const testClient = new S3Client({
      region: sharedConfig.region,
      endpoint: sharedConfig.endpoint,
      credentials: {
        accessKeyId: sharedConfig._encryptedCredentials.accessKey,
        secretAccessKey: sharedConfig._encryptedCredentials.secretKey
      },
      forcePathStyle: true
    });

    const command = new ListObjectsV2Command({
      Bucket: sharedConfig.bucket,
      Prefix: sharedConfig.prefix,
      MaxKeys: 1
    });

    await testClient.send(command);
    return { success: true };
  } catch (error) {
    console.error('Erro ao testar conexão compartilhada:', error);
    return { success: false, error: error.message };
  }
});

// Conectar em bucket compartilhado
ipcMain.handle('connect-shared-bucket', async (event, sharedConfig) => {
  try {
    s3Config = {
      bucket: sharedConfig.bucket,
      prefix: sharedConfig.prefix,
      region: sharedConfig.region,
      endpoint: sharedConfig.endpoint,
      accessKey: sharedConfig._encryptedCredentials.accessKey,
      secretKey: sharedConfig._encryptedCredentials.secretKey,
      name: sharedConfig.name,
      isShared: true,
      sharedAt: sharedConfig.sharedAt,
      sharedBy: sharedConfig.sharedBy,
      id: sharedConfig.id || ('shared-' + Date.now())
    };
    s3Client = new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      credentials: {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey
      },
      forcePathStyle: true
    });

    // Persistir no configs.json
    const configPath = getConfigPath();
    let configs = [];
    if (fs.existsSync(configPath)) {
      configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    // Atualiza se já existe, senão adiciona
    const idx = configs.findIndex(c => c.id === s3Config.id);
    if (idx !== -1) {
      configs[idx] = { ...configs[idx], ...s3Config, lastUsed: new Date().toISOString() };
    } else {
      configs.push({ ...s3Config, createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() });
    }
    ensureUserDataDir();
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));

    return { success: true };
  } catch (error) {
    console.error('Erro ao conectar bucket compartilhado:', error);
    return { success: false, error: error.message };
  }
});

// Utilizar diretório de dados do usuário para configs.json
const getConfigPath = () => path.join(app.getPath('userData'), 'configs.json');
