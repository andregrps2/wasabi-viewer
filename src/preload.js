const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Configuração S3
  testS3Connection: (config) => ipcRenderer.invoke('test-s3-connection', config),
  saveS3Config: (config) => ipcRenderer.invoke('save-s3-config', config),
  saveS3Configs: (configs) => ipcRenderer.invoke('save-s3-configs', configs),
  loadS3Configs: () => ipcRenderer.invoke('load-s3-configs'),

  // Operações S3
  listS3Objects: (prefix) => ipcRenderer.invoke('list-s3-objects', prefix),
  downloadFile: (fileKey, fileName, savePath) => ipcRenderer.invoke('download-file', fileKey, fileName, savePath),
  generateSignedLink: (fileKey, expiresIn) => ipcRenderer.invoke('generate-signed-link', fileKey, expiresIn),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),

  // Compartilhamento
  generateShareToken: (configId, configs) => ipcRenderer.invoke('generate-share-token', configId, configs),
  decodeShareToken: (token) => ipcRenderer.invoke('decode-share-token', token),
  testSharedConnection: (config) => ipcRenderer.invoke('test-shared-connection', config),
  connectSharedBucket: (config) => ipcRenderer.invoke('connect-shared-bucket', config),

  // Utilitários
  copyToClipboard: (text) => {
    navigator.clipboard.writeText(text);
  }
  ,
  // Eventos relacionados a download
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(event, data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },
  // FS helpers para modal customizado
  getHomeDir: () => ipcRenderer.invoke('fs-home-dir'),
  listDir: (dirPath) => ipcRenderer.invoke('fs-list-dir', dirPath)
});
