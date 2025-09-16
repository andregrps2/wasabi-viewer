const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Configuração S3
  testS3Connection: (config) => ipcRenderer.invoke('test-s3-connection', config),
  saveS3Config: (config) => ipcRenderer.invoke('save-s3-config', config),
  saveS3Configs: (configs) => ipcRenderer.invoke('save-s3-configs', configs),
  loadS3Configs: () => ipcRenderer.invoke('load-s3-configs'),
  
  // Operações S3
  listS3Objects: (prefix) => ipcRenderer.invoke('list-s3-objects', prefix),
  downloadFile: (fileKey, fileName) => ipcRenderer.invoke('download-file', fileKey, fileName),
  generateSignedLink: (fileKey, expiresIn) => ipcRenderer.invoke('generate-signed-link', fileKey, expiresIn),
  
  // Compartilhamento
  generateShareToken: (configId, configs) => ipcRenderer.invoke('generate-share-token', configId, configs),
  decodeShareToken: (token) => ipcRenderer.invoke('decode-share-token', token),
  testSharedConnection: (config) => ipcRenderer.invoke('test-shared-connection', config),
  connectSharedBucket: (config) => ipcRenderer.invoke('connect-shared-bucket', config),
  
  // Utilitários
  copyToClipboard: (text) => {
    navigator.clipboard.writeText(text);
  }
});
