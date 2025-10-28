// Estado da aplicação
let currentPath = '';
let currentFiles = [];
let filteredFiles = [];
let selectedFileKey = '';
let savedConfigs = [];
let currentConfig = null;
let editingConfigId = null;
let sharingConfigId = null;

// Estado de ordenação
let sortState = {
    column: 'date', // 'name', 'size', 'date'
    direction: 'desc' // 'asc', 'desc'
};
// Variables to compute download speed and ETA
let _downloadLastSample = null; // { time: ms, bytes: number }
let _downloadSpeedBps = null; // smoothed bytes/sec
let _etaLastUpdateAt = 0; // last ETA label update timestamp
let _downloadCancelledFlag = false; // track if user cancelled to avoid duplicate messages

// Elementos DOM
const configScreen = document.getElementById('config-screen');
const mainScreen = document.getElementById('main-screen');
const configForm = document.getElementById('config-form');
const configStatus = document.getElementById('config-status');
const fileList = document.getElementById('file-list');
const searchInput = document.getElementById('search-input');
const breadcrumbPath = document.getElementById('breadcrumb-path');
const refreshBtn = document.getElementById('refresh-btn');
const configBtn = document.getElementById('config-btn');
const bucketSelect = document.getElementById('bucket-select');
const configList = document.getElementById('config-list');
const newConfigBtn = document.getElementById('new-config-btn');
const openSavedConfigsBtn = document.getElementById('open-saved-configs-btn');
const themeToggle = document.getElementById('theme-toggle');

// Modal de configuração
const configModal = document.getElementById('config-modal');
const configModalTitle = document.getElementById('config-modal-title');
const saveBtnText = document.getElementById('save-btn-text');
const cancelModalBtn = document.getElementById('cancel-modal-btn');

// Elementos de compartilhamento
const shareTokenInput = document.getElementById('share-token-input');
const connectSharedBtn = document.getElementById('connect-shared-btn');
const shareModal = document.getElementById('share-modal');
const shareConfigName = document.getElementById('share-config-name');
const shareResult = document.querySelector('.share-result');
const shareToken = document.getElementById('share-token');
const generateTokenBtn = document.getElementById('generate-token-btn');
const copyTokenBtn = document.getElementById('copy-token-btn');
const copyInstructionsBtn = document.getElementById('copy-instructions-btn');

// Modals
const progressModal = document.getElementById('progress-modal');
const linkModal = document.getElementById('link-modal');
const linkResult = document.querySelector('.link-result');
const generatedLink = document.getElementById('generated-link');
// Modal de salvar arquivo
const saveModal = document.getElementById('save-modal');
const saveBreadcrumb = document.getElementById('save-breadcrumb');
const saveDirList = document.getElementById('save-dir-list');
const saveFileNameInput = document.getElementById('save-file-name');
const saveConfirmBtn = document.getElementById('save-confirm-btn');
const saveCancelBtn = document.getElementById('save-cancel-btn');

// Estado do modal de salvar
let saveCurrentDir = '';
let pendingDownload = { key: null, name: null };

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Carregar tema salvo
    loadSavedTheme();

    // Carregar configurações salvas
    await loadSavedConfigs();
    setupEventListeners();

    // Se há configurações salvas, mostrar a primeira na lista de buckets
    if (savedConfigs.length > 0) {
        populateBucketSelect();
        // Auto-conectar na última configuração usada se existir
        const lastUsed = savedConfigs.find(config => config.lastUsed);
        if (lastUsed) {
            await connectToBucket(lastUsed.id);
        }
    }

    // Ouvir eventos de progresso de download enviados do main
    if (window.electronAPI && typeof window.electronAPI.onDownloadProgress === 'function') {
        window.electronAPI.onDownloadProgress((event, data) => {
            try {
                const fill = document.getElementById('progress-fill');
                const text = document.getElementById('progress-text');
                const sizeText = document.getElementById('progress-size');
                const percentLabel = document.getElementById('progress-percent');
                // Mostrar modal de progresso
                progressModal.classList.add('active');
                // If we have total bytes, compute an accurate percentage.
                if (data && (data.totalBytes || data.totalBytes === 0)) {
                    const total = Number(data.totalBytes) || 0;
                    const downloaded = Number(data.downloadedBytes) || 0;
                    const percentNum = total > 0 ? (downloaded / total) * 100 : (data.percent || 0);
                    const percent = Math.min(100, Math.max(0, Number(percentNum)));
                    const percentDisplay = Math.round(percent);
                    fill.classList.remove('indeterminate');
                    fill.style.width = `${percent}%`;
                    if (percentLabel) percentLabel.textContent = `${percentDisplay}%`;
                    text.textContent = `Baixando...`;
                    sizeText.textContent = `${formatFileSize(downloaded)} / ${formatFileSize(total)}`;

                    // ETA calculation
                    try {
                        const now = Date.now();
                        if (_downloadLastSample && _downloadLastSample.bytes <= downloaded) {
                            const dt = (now - _downloadLastSample.time) / 1000; // seconds
                            const db = downloaded - _downloadLastSample.bytes; // bytes
                            if (dt > 0 && db >= 0) {
                                const instantBps = db / dt;
                                if (_downloadSpeedBps && isFinite(_downloadSpeedBps)) {
                                    _downloadSpeedBps = (_downloadSpeedBps * 0.75) + (instantBps * 0.25);
                                } else {
                                    _downloadSpeedBps = instantBps;
                                }
                            }
                        }
                        _downloadLastSample = { time: now, bytes: downloaded };

                        if (_downloadSpeedBps && _downloadSpeedBps > 0 && total > downloaded) {
                            const remainingSec = (total - downloaded) / _downloadSpeedBps;
                            const etaEl = document.getElementById('progress-eta');
                            const now2 = Date.now();
                            if (!_etaLastUpdateAt || (now2 - _etaLastUpdateAt) >= 800) {
                                etaEl.textContent = `Tempo estimado: ${formatTimeRemaining(remainingSec)}`;
                                _etaLastUpdateAt = now2;
                            }
                        } else {
                            document.getElementById('progress-eta').textContent = `Tempo estimado: —`;
                        }
                    } catch (e) {
                        document.getElementById('progress-eta').textContent = `Tempo estimado: —`;
                    }

                    if (percent >= 100) {
                        text.textContent = 'Download concluído';
                        setTimeout(() => {
                            closeModals();
                            _downloadLastSample = null;
                            _downloadSpeedBps = null;
                            _etaLastUpdateAt = 0;
                        }, 1200);
                    }
                } else if (data && (data.percent !== null && data.percent !== undefined)) {
                    // Fallback: percent provided by main
                    const percent = Math.min(100, Math.max(0, Number(data.percent)));
                    const percentDisplay = Math.round(percent);
                    fill.classList.remove('indeterminate');
                    fill.style.width = `${percent}%`;
                    text.textContent = `Progresso: ${percentDisplay}%`;
                    sizeText.textContent = data.downloadedBytes ? `${formatFileSize(data.downloadedBytes)} / ?` : '';

                    // update sample for speed estimation when downloadedBytes provided
                    if (data.downloadedBytes) {
                        const downloaded = Number(data.downloadedBytes) || 0;
                        const now = Date.now();
                        if (_downloadLastSample && _downloadLastSample.bytes <= downloaded) {
                            const dt = (now - _downloadLastSample.time) / 1000;
                            const db = downloaded - _downloadLastSample.bytes;
                            if (dt > 0 && db >= 0) {
                                const instantBps = db / dt;
                                if (_downloadSpeedBps && isFinite(_downloadSpeedBps)) {
                                    _downloadSpeedBps = (_downloadSpeedBps * 0.75) + (instantBps * 0.25);
                                } else {
                                    _downloadSpeedBps = instantBps;
                                }
                            }
                        }
                        _downloadLastSample = { time: now, bytes: downloaded };
                        document.getElementById('progress-eta').textContent = `Tempo estimado: —`;
                    }

                    if (percent >= 100) {
                        text.textContent = 'Download concluído';
                        setTimeout(() => {
                            closeModals();
                            _downloadLastSample = null;
                            _downloadSpeedBps = null;
                            _etaLastUpdateAt = 0;
                        }, 1200);
                    }
                } else if (data && data.downloadedBytes) {
                    // Unknown total size: show downloaded bytes and indeterminate animation
                    fill.classList.add('indeterminate');
                    const downloaded = Number(data.downloadedBytes) || 0;
                    text.textContent = `Baixados: ${formatFileSize(downloaded)}`;
                    sizeText.textContent = `${formatFileSize(downloaded)} / ?`;

                    // update sample for speed estimation
                    const now = Date.now();
                    if (_downloadLastSample && _downloadLastSample.bytes <= downloaded) {
                        const dt = (now - _downloadLastSample.time) / 1000;
                        const db = downloaded - _downloadLastSample.bytes;
                        if (dt > 0 && db >= 0) {
                            const instantBps = db / dt;
                            if (_downloadSpeedBps && isFinite(_downloadSpeedBps)) {
                                _downloadSpeedBps = (_downloadSpeedBps * 0.75) + (instantBps * 0.25);
                            } else {
                                _downloadSpeedBps = instantBps;
                            }
                        }
                    }
                    _downloadLastSample = { time: now, bytes: downloaded };
                    document.getElementById('progress-eta').textContent = `Tempo estimado: —`;
                }

                if (data && data.cancelled) {
                    text.textContent = 'Download cancelado pelo usuario';
                    showNotification('Download cancelado pelo usuario', 'info');
                    _downloadCancelledFlag = true;
                    setTimeout(() => closeModals(), 1200);
                }
            } catch (err) {
                console.error('Erro ao processar evento de progresso:', err);
            }
        });
    }

    // Botão de cancelar download — abrir modal de confirmação customizado
    const cancelBtn = document.getElementById('cancel-download-btn');
    const cancelConfirmModal = document.getElementById('cancel-confirm-modal');
    const cancelYes = document.getElementById('cancel-confirm-yes');
    const cancelNo = document.getElementById('cancel-confirm-no');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (cancelConfirmModal) {
                cancelConfirmModal.classList.add('active');
            } else {
                // fallback: enviar cancel direto
                if (window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
                    window.electronAPI.cancelDownload();
                }
            }
        });
    }

    // Confirmar cancelamento
    if (cancelYes) {
        cancelYes.addEventListener('click', async () => {
            try {
                if (window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
                    await window.electronAPI.cancelDownload();
                }
            } catch (err) {
                console.error('Erro ao cancelar download:', err);
                showNotification('Erro ao cancelar download', 'error');
            } finally {
                if (cancelConfirmModal) cancelConfirmModal.classList.remove('active');
                // também fechar modal de progresso
                if (progressModal) progressModal.classList.remove('active');
            }
        });
    }

    // Cancelar a operação de fechar o modal de confirmação
    if (cancelNo) {
        cancelNo.addEventListener('click', () => {
            if (cancelConfirmModal) cancelConfirmModal.classList.remove('active');
        });
    }
});

// Carregar configurações salvas
async function loadSavedConfigs() {
    try {
        const configs = await window.electronAPI.loadS3Configs();
        savedConfigs = configs || [];
        renderConfigList();
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        savedConfigs = [];
    }
}

// Renderizar lista de configurações
function renderConfigList() {
    if (savedConfigs.length === 0) {
        configList.innerHTML = `
            <div class="empty-configs">
                <i class="fas fa-plus-circle"></i>
                <p>Adicione sua primeira configuração abaixo</p>
            </div>
        `;
        return;
    }

    const html = savedConfigs.map(config => `
        <div class="config-item" data-config-id="${config.id}">
            <div class="config-info">
                <div class="config-name">${config.name}</div>
                <div class="config-details">${config.bucket} • ${config.endpoint}</div>
            </div>
            <div class="config-actions">
                <button class="btn btn-success btn-connect" data-config-id="${config.id}" title="Conectar">
                    <i class="fas fa-plug"></i>
                </button>
                ${config.isShared ? '' : `<button class="btn btn-info btn-share" data-config-id="${config.id}" title="Compartilhar">
                    <i class="fas fa-share-alt"></i>
                </button>`}
                ${config.isShared ? '' : `<button class="btn btn-secondary btn-edit" data-config-id="${config.id}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>`}
                <button class="btn btn-danger btn-delete" data-config-id="${config.id}" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    configList.innerHTML = html;
    setupConfigItemEvents();
}

// Popular seletor de bucket
function populateBucketSelect() {
    const options = savedConfigs.map(config =>
        `<option value="${config.id}">${config.name} (${config.bucket})</option>`
    ).join('');

    let allOptions = options;

    // Adicionar configuração compartilhada se estiver ativa
    if (currentConfig && currentConfig.isShared && !savedConfigs.find(c => c.id === currentConfig.id)) {
        const sharedOption = `<option value="${currentConfig.id}">${currentConfig.name} (${currentConfig.bucket})</option>`;
        allOptions = sharedOption + (options ? '<option disabled>──────────────</option>' + options : '');
    }

    bucketSelect.innerHTML = '<option value="">Selecione um bucket...</option>' + allOptions;

    // Selecionar o bucket atual se existir
    if (currentConfig) {
        bucketSelect.value = currentConfig.id;
    }
}

// Preencher formulário de configuração
function fillConfigForm(config = null) {
    if (config) {
        document.getElementById('configName').value = config.name || '';
        document.getElementById('accessKey').value = config.accessKey || '';
        document.getElementById('secretKey').value = config.secretKey || '';
        document.getElementById('bucket').value = config.bucket || '';
        document.getElementById('prefix').value = config.prefix || '';
        document.getElementById('region').value = config.region || 'us-east-1';
        document.getElementById('endpoint').value = config.endpoint || 'https://s3.wasabisys.com';
    } else {
        // Limpar formulário
        document.getElementById('configName').value = '';
        document.getElementById('accessKey').value = '';
        document.getElementById('secretKey').value = '';
        document.getElementById('bucket').value = '';
        document.getElementById('prefix').value = '';
        document.getElementById('region').value = 'us-east-1';
        document.getElementById('endpoint').value = 'https://s3.wasabisys.com';
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Formulário de configuração
    configForm.addEventListener('submit', handleConfigSubmit);

    // Botões da interface
    // Atualizar mantendo a pasta atual
    refreshBtn.addEventListener('click', () => loadFiles(currentPath || ''));
    configBtn.addEventListener('click', showConfigScreen);
    bucketSelect.addEventListener('change', handleBucketChange);
    newConfigBtn.addEventListener('click', showNewConfigModal);
    if (openSavedConfigsBtn) {
        openSavedConfigsBtn.addEventListener('click', () => {
            const sec = document.getElementById('saved-configs');
            if (sec && typeof sec.scrollIntoView === 'function') {
                try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                catch (_) { sec.scrollIntoView(); }
            }
        });
    }
    cancelModalBtn.addEventListener('click', hideConfigModal);
    themeToggle.addEventListener('click', toggleTheme);

    // Compartilhamento
    connectSharedBtn.addEventListener('click', handleConnectShared);
    generateTokenBtn.addEventListener('click', handleGenerateToken);
    copyTokenBtn.addEventListener('click', copyShareToken);
    copyInstructionsBtn.addEventListener('click', copyShareInstructions);

    // Pesquisa
    searchInput.addEventListener('input', handleSearch);

    // Ordenação por colunas
    setupSortListeners();

    // Modals
    setupModalEvents();
}

// Configurar eventos dos modais
function setupModalEvents() {
    // Fechar modais
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') || e.target.classList.contains('modal-close')) {
            closeModals();
        }
    });

    // Botões de link
    document.getElementById('signed-link-btn').addEventListener('click', () => generateLink('signed'));
    document.getElementById('copy-link-btn').addEventListener('click', copyLink);

    // Modal de salvar arquivo
    if (saveCancelBtn) {
        saveCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModals();
        });
    }
    if (saveConfirmBtn) {
        saveConfirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!pendingDownload.key || !pendingDownload.name || !saveCurrentDir) return;
            const name = (saveFileNameInput?.value || pendingDownload.name).trim();
            if (!name) return;
            const finalPath = joinPaths(saveCurrentDir, name);
            closeModals();
            await performDownload(pendingDownload.key, pendingDownload.name, finalPath);
            pendingDownload = { key: null, name: null };
        });
    }
    if (saveBreadcrumb) {
        saveBreadcrumb.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('crumb') && target.dataset && target.dataset.path) {
                e.preventDefault();
                loadSaveDir(target.dataset.path);
            }
        });
    }
    if (saveDirList) {
        saveDirList.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (item && item.dataset && item.dataset.path) {
                e.preventDefault();
                loadSaveDir(item.dataset.path);
            }
        });
    }
}

// Manipular submissão do formulário de configuração
async function handleConfigSubmit(e) {
    e.preventDefault();

    const config = {
        id: editingConfigId || generateId(),
        name: document.getElementById('configName').value,
        accessKey: document.getElementById('accessKey').value,
        secretKey: document.getElementById('secretKey').value,
        bucket: document.getElementById('bucket').value,
        prefix: document.getElementById('prefix').value,
        region: document.getElementById('region').value,
        endpoint: document.getElementById('endpoint').value,
        createdAt: editingConfigId ? savedConfigs.find(c => c.id === editingConfigId)?.createdAt : new Date().toISOString(),
        lastUsed: null
    };

    showStatus('Testando conexão...', 'info');

    try {
        const result = await window.electronAPI.testS3Connection(config);

        if (result.success) {
            // Salvar configuração
            if (editingConfigId) {
                const index = savedConfigs.findIndex(c => c.id === editingConfigId);
                savedConfigs[index] = config;
            } else {
                savedConfigs.push(config);
            }

            await window.electronAPI.saveS3Configs(savedConfigs);
            renderConfigList();
            populateBucketSelect();

            showStatus('Configuração salva com sucesso!', 'success');

            // Conectar ao bucket
            setTimeout(async () => {
                try {
                    await connectToBucket(config.id);
                    hideConfigModal();
                    showMainScreen();
                } catch (error) {
                    console.error('Erro ao conectar:', error);
                    showStatus('Erro ao conectar: ' + error.message, 'error');
                }
            }, 1000);

            // Resetar formulário
            fillConfigForm();
        } else {
            showStatus(`Erro na conexão: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Erro na conexão: ${error.message}`, 'error');
    }
}

// Mostrar status no formulário de configuração
function showStatus(message, type) {
    configStatus.textContent = message;
    configStatus.className = `status-message ${type}`;
}

// Alternar entre telas
function showConfigScreen() {
    configScreen.classList.add('active');
    mainScreen.classList.remove('active');
}

function showMainScreen() {
    console.log('Mudando para tela principal...');
    configScreen.classList.remove('active');
    mainScreen.classList.add('active');
    console.log('Tela principal ativada');
}

// Carregar arquivos do S3
async function loadFiles(path = '') {
    console.log('Iniciando carregamento de arquivos, path:', path);

    if (!currentConfig) {
        showEmptyState('Selecione um bucket para visualizar os arquivos');
        return;
    }

    showLoading(true);
    currentPath = path;

    try {
        console.log('Chamando listS3Objects...');
        const files = await window.electronAPI.listS3Objects(path);
        console.log('Arquivos carregados:', files.length);

        // Aplicar ordenação baseada no estado atual
        const sortedFiles = sortFilesByColumn(files, sortState.column, sortState.direction);

        currentFiles = sortedFiles;
        filteredFiles = sortedFiles;

        renderFiles(filteredFiles);
        updateBreadcrumb(path);
        updateSortIndicators();
        console.log('Carregamento concluído com sucesso');
    } catch (error) {
        console.error('Erro ao carregar arquivos:', error);
        showNotification('Erro ao carregar arquivos: ' + error.message, 'error');
        showEmptyState('Erro ao carregar arquivos');
    } finally {
        showLoading(false);
    }
}

// Ordenar lista com pastas primeiro e arquivos por última modificação (desc)
function sortFilesDefault(files) {
    const folders = [];
    const regularFiles = [];

    for (const f of files) {
        if (f.type === 'folder') {
            folders.push(f);
        } else {
            regularFiles.push(f);
        }
    }

    folders.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    regularFiles.sort((a, b) => {
        const da = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const db = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return db - da; // mais recente primeiro
    });

    return [...folders, ...regularFiles];
}

// Funções de ordenação por coluna
function sortFilesByColumn(files, column, direction) {
    const folders = [];
    const regularFiles = [];

    // Separar pastas de arquivos
    for (const f of files) {
        if (f.type === 'folder') {
            folders.push(f);
        } else {
            regularFiles.push(f);
        }
    }

    // Função de comparação baseada na coluna
    const getComparator = (col, dir) => {
        const multiplier = dir === 'asc' ? 1 : -1;
        
        switch (col) {
            case 'name':
                return (a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR') * multiplier;
            
            case 'size':
                return (a, b) => {
                    const sizeA = a.size || 0;
                    const sizeB = b.size || 0;
                    return (sizeA - sizeB) * multiplier;
                };
            
            case 'date':
                return (a, b) => {
                    const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                    const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                    return (dateA - dateB) * multiplier;
                };
            
            default:
                return (a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR') * multiplier;
        }
    };

    // Ordenar pastas e arquivos separadamente
    const comparator = getComparator(column, direction);
    folders.sort(comparator);
    regularFiles.sort(comparator);

    // Retornar pastas primeiro, depois arquivos
    return [...folders, ...regularFiles];
}

// Alternar ordenação de uma coluna
function toggleSort(column) {
    if (sortState.column === column) {
        // Mesma coluna: alternar direção
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Nova coluna: começar com ascendente
        sortState.column = column;
        sortState.direction = 'asc';
    }

    // Aplicar ordenação aos arquivos atuais
    const sortedFiles = sortFilesByColumn(currentFiles, sortState.column, sortState.direction);
    
    // Aplicar filtro de busca se houver
    if (searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase();
        filteredFiles = sortedFiles.filter(file =>
            file.name.toLowerCase().includes(searchTerm)
        );
    } else {
        filteredFiles = sortedFiles;
    }

    renderFiles(filteredFiles);
    updateSortIndicators();
}

// Configurar event listeners para ordenação
function setupSortListeners() {
    const sortableHeaders = document.querySelectorAll('.column-header.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            toggleSort(column);
        });
    });
}

// Atualizar indicadores visuais de ordenação
function updateSortIndicators() {
    const sortableHeaders = document.querySelectorAll('.column-header.sortable');
    
    sortableHeaders.forEach(header => {
        const column = header.getAttribute('data-sort');
        const sortIcon = header.querySelector('.sort-icon');
        
        // Remover classes de estado ativo
        header.classList.remove('sort-active');
        
        if (column === sortState.column) {
            // Coluna ativa
            header.classList.add('sort-active');
            
            // Atualizar ícone baseado na direção
            if (sortState.direction === 'asc') {
                sortIcon.className = 'fas fa-sort-up sort-icon';
            } else {
                sortIcon.className = 'fas fa-sort-down sort-icon';
            }
        } else {
            // Coluna inativa
            sortIcon.className = 'fas fa-sort sort-icon';
        }
    });
}

// Renderizar lista de arquivos
function renderFiles(files) {
    if (files.length === 0) {
        showEmptyState('Nenhum arquivo encontrado');
        return;
    }

    const html = files.map(file => createFileItem(file)).join('');
    fileList.innerHTML = html;

    // Adicionar event listeners aos itens
    setupFileItemEvents();
}

// Criar item de arquivo HTML
function createFileItem(file) {
    const isFolder = file.type === 'folder';
    const icon = isFolder ? 'fas fa-folder' : getFileIcon(file.name);
    const size = isFolder ? '-' : formatFileSize(file.size);
    const date = file.lastModified ? formatDate(file.lastModified) : '-';

    return `
        <div class="file-item ${file.type}" data-key="${file.key}" data-type="${file.type}" data-name="${file.name}">
            <div class="file-name">
                <i class="file-icon ${file.type} ${icon}"></i>
                <span>${file.name}</span>
            </div>
            <div class="file-size">${size}</div>
            <div class="file-date">${date}</div>
            <div class="file-actions">
                ${!isFolder ? `
                    <button class="btn btn-info btn-download" title="Baixar">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-secondary btn-link" title="Copiar Link">
                        <i class="fas fa-link"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Configurar eventos dos itens de arquivo
function setupFileItemEvents() {
    document.querySelectorAll('.file-item').forEach(item => {
        const type = item.dataset.type;
        const key = item.dataset.key;
        const name = item.dataset.name;

        // Clique duplo para abrir pasta
        if (type === 'folder') {
            item.addEventListener('dblclick', () => {
                const folderPath = currentPath + name + '/';
                loadFiles(folderPath);
            });
        }

        // Botão de download
        const downloadBtn = item.querySelector('.btn-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadFile(key, name);
            });
        }

        // Botão de link
        const linkBtn = item.querySelector('.btn-link');
        if (linkBtn) {
            linkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showLinkModal(key);
            });
        }
    });
}

// Obter ícone do arquivo baseado na extensão
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        pdf: 'fas fa-file-pdf',
        doc: 'fas fa-file-word',
        docx: 'fas fa-file-word',
        xls: 'fas fa-file-excel',
        xlsx: 'fas fa-file-excel',
        ppt: 'fas fa-file-powerpoint',
        pptx: 'fas fa-file-powerpoint',
        jpg: 'fas fa-file-image',
        jpeg: 'fas fa-file-image',
        png: 'fas fa-file-image',
        gif: 'fas fa-file-image',
        mp4: 'fas fa-file-video',
        avi: 'fas fa-file-video',
        zip: 'fas fa-file-archive',
        rar: 'fas fa-file-archive',
        txt: 'fas fa-file-alt',
        css: 'fas fa-file-code',
        html: 'fas fa-file-code',
        js: 'fas fa-file-code',
        json: 'fas fa-file-code'
    };

    return iconMap[ext] || 'fas fa-file';
}

// Formatar tamanho do arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeRemaining(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '—';
    const s = Math.round(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) return `${hrs}h ${String(mins).padStart(2,'0')}m`;
    return `${mins}m ${String(secs).padStart(2,'0')}s`;
}

// Formatar data
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

// Atualizar breadcrumb
function updateBreadcrumb(path) {
    if (!path) {
        breadcrumbPath.innerHTML = '<i class="fas fa-home"></i> Início';
        return;
    }

    const parts = path.split('/').filter(p => p);
    let html = '<i class="fas fa-home"></i> <a href="#" onclick="loadFiles(\'\')">Início</a>';

    let fullPath = '';
    parts.forEach((part, index) => {
        fullPath += part + '/';
        html += ` / <a href="#" onclick="loadFiles('${fullPath}')">${part}</a>`;
    });

    breadcrumbPath.innerHTML = html;
}

// Pesquisar arquivos
function handleSearch(e) {
    const query = e.target.value.toLowerCase();

    // Aplicar ordenação atual aos arquivos
    const sortedFiles = sortFilesByColumn(currentFiles, sortState.column, sortState.direction);

    if (!query) {
        filteredFiles = sortedFiles;
    } else {
        filteredFiles = sortedFiles.filter(file =>
            file.name.toLowerCase().includes(query)
        );
    }

    renderFiles(filteredFiles);
}

// Download de arquivo
async function downloadFile(fileKey, fileName) {
    // Abrir modal customizado para escolher diretório e nome
    pendingDownload = { key: fileKey, name: fileName };
    saveFileNameInput && (saveFileNameInput.value = fileName);
    await openSaveModal();
}

async function openSaveModal() {
    try {
        const home = await window.electronAPI.getHomeDir();
        saveCurrentDir = home;
        await loadSaveDir(home);
        if (saveModal) saveModal.classList.add('active');
    } catch (e) {
        console.error('Erro abrindo modal de salvar:', e);
        showNotification('Não foi possível abrir o modal de salvar', 'error');
    }
}

async function loadSaveDir(dirPath) {
    try {
        const { base, entries } = await window.electronAPI.listDir(dirPath);
        saveCurrentDir = base;
        renderSaveBreadcrumb(base);
        renderSaveDirEntries(entries);
    } catch (e) {
        console.error('Erro listando diretório:', e);
        showNotification('Erro ao listar diretório: ' + e.message, 'error');
    }
}

function renderSaveBreadcrumb(base) {
    if (!saveBreadcrumb) return;
    const parts = base.split(/\\\\|\//).filter(Boolean);
    let crumbs = '';
    let accum = '';
    // Windows drive root handling
    if (parts.length && /^[A-Za-z]:$/.test(parts[0])) {
        accum = parts[0] + '\\';
        crumbs += `<span class="crumb" data-path="${accum}">${parts[0]}</span>`;
        parts.shift();
    }
    parts.forEach((p, idx) => {
        accum = joinPaths(accum || base.startsWith('/') ? '/' : '', p);
        if (idx > 0 || crumbs) crumbs += '<span class="sep"> / </span>';
        crumbs += `<span class="crumb" data-path="${accum}">${p}</span>`;
    });
    saveBreadcrumb.innerHTML = crumbs || `<span class="crumb" data-path="${base}">${base}</span>`;
}

function renderSaveDirEntries(entries) {
    if (!saveDirList) return;
    if (!entries || !entries.length) {
        saveDirList.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>Sem pastas aqui</h3></div>`;
        return;
    }
    const html = entries.map(e => `
        <div class="list-item" data-path="${e.path}">
            <i class="fas fa-folder icon-folder"></i>
            <span>${e.name}</span>
        </div>
    `).join('');
    saveDirList.innerHTML = html;
}

function joinPaths(a, b) {
    if (!a) return b;
    if (!b) return a;
    const sep = a.includes('\\') ? '\\' : '/';
    return a.replace(/[\\/]+$/,'') + sep + b.replace(/^[\\/]+/,'');
}

async function performDownload(fileKey, fileName, savePath) {
    _downloadCancelledFlag = false;
    _etaLastUpdateAt = 0;
    showProgressModal();
    try {
        const result = await window.electronAPI.downloadFile(fileKey, fileName, savePath);
        if (result.success) {
            showNotification(`Arquivo baixado: ${result.path}`, 'success');
        } else {
            const msg = (result.error || result.message || '').toString().toLowerCase();
            const isCancel = msg.includes('cancel') || msg.includes('cancelado') || msg.includes('canceled');
            if (isCancel) {
                // Cancelamento: mensagem já tratada no evento de progresso; evitar duplicação
                // Se o progresso não disparar, ainda fecharemos os modais abaixo
            } else {
                showNotification(`Erro no download: ${result.error || result.message}`, 'error');
            }
        }
    } catch (error) {
        console.error('Erro no download:', error);
        const emsg = (error && error.message ? error.message : '').toString().toLowerCase();
        const isCancel = emsg.includes('cancel') || emsg.includes('cancelado') || emsg.includes('canceled');
        if (!isCancel) {
            showNotification('Erro no download: ' + (error.message || 'Falha desconhecida'), 'error');
        }
    } finally {
        closeModals();
    }
}

// Mostrar modal de link
function showLinkModal(fileKey) {
    selectedFileKey = fileKey;
    linkResult.classList.remove('active');
    generatedLink.value = '';
    linkModal.classList.add('active');
}

// Gerar link do arquivo
async function generateLink(type) {
    if (!selectedFileKey) return;

    try {
        const url = await window.electronAPI.generateSignedLink(selectedFileKey, 3600);
        generatedLink.value = url;
        linkResult.classList.add('active');
    } catch (error) {
        console.error('Erro ao gerar link:', error);
        showNotification('Erro ao gerar link: ' + error.message, 'error');
    }
}

// Copiar link para clipboard
async function copyLink() {
    const link = generatedLink.value;
    if (!link) return;

    try {
        await window.electronAPI.copyToClipboard(link);
        showNotification('Link copiado para a área de transferência!', 'success');
        closeModals();
    } catch (error) {
        console.error('Erro ao copiar link:', error);
        showNotification('Erro ao copiar link', 'error');
    }
}

// Mostrar/esconder loading
function showLoading(show) {
    if (show) {
        fileList.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                Carregando arquivos...
            </div>
        `;
    }
}

// Mostrar estado vazio
function showEmptyState(message) {
    fileList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <h3>${message}</h3>
            <p>Verifique sua conexão ou tente atualizar a lista</p>
        </div>
    `;
}

// Mostrar modal de progresso
function showProgressModal() {
    progressModal.classList.add('active');
}

// Fechar modais
function closeModals() {
    progressModal.classList.remove('active');
    linkModal.classList.remove('active');
    shareModal.classList.remove('active');
    configModal.classList.remove('active');
    if (saveModal) saveModal.classList.remove('active');
    const cancelConfirmModal = document.getElementById('cancel-confirm-modal');
    if (cancelConfirmModal) cancelConfirmModal.classList.remove('active');
}

// Configurar eventos dos itens de configuração
function setupConfigItemEvents() {
    // Botões de conectar
    document.querySelectorAll('.btn-connect').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const configId = btn.dataset.configId;
            await connectToBucket(configId);
            showMainScreen();
        });
    });

    // Botões de compartilhar
    document.querySelectorAll('.btn-share').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const configId = btn.dataset.configId;
            showShareModal(configId);
        });
    });

    // Botões de editar
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const configId = btn.dataset.configId;
            editConfig(configId);
        });
    });

    // Botões de excluir
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const configId = btn.dataset.configId;
            await deleteConfig(configId);
        });
    });
}

// Conectar a um bucket
async function connectToBucket(configId) {
    // Primeiro verificar se é uma configuração compartilhada
    if (currentConfig && currentConfig.id === configId && currentConfig.isShared) {
        // Já está conectado na configuração compartilhada
        await loadFiles();
        showNotification(`Conectado ao bucket: ${currentConfig.name}`, 'success');
        return;
    }

    const config = savedConfigs.find(c => c.id === configId);
    if (!config) return;

    try {
        const result = await window.electronAPI.saveS3Config(config);
        if (result.success) {
            currentConfig = config;

            // Marcar como último usado
            savedConfigs.forEach(c => c.lastUsed = null);
            config.lastUsed = new Date().toISOString();
            await window.electronAPI.saveS3Configs(savedConfigs);

            // Atualizar seletor
            bucketSelect.value = configId;

            await loadFiles();
            showNotification(`Conectado ao bucket: ${config.name}`, 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Erro ao conectar:', error);
        showNotification('Erro ao conectar: ' + error.message, 'error');
    }
}

// Mudança no seletor de bucket
async function handleBucketChange(e) {
    const configId = e.target.value;
    if (configId) {
        await connectToBucket(configId);
    }
}

// Mostrar modal de nova configuração
function showNewConfigModal() {
    editingConfigId = null;
    fillConfigForm();

    configModalTitle.textContent = 'Nova Configuração';
    saveBtnText.textContent = 'Salvar e Conectar';

    configModal.classList.add('active');
}

// Esconder modal de configuração
function hideConfigModal() {
    configModal.classList.remove('active');
    editingConfigId = null;
    fillConfigForm();
}

// Editar configuração
function editConfig(configId) {
    const config = savedConfigs.find(c => c.id === configId);
    if (!config) return;

    editingConfigId = configId;
    fillConfigForm(config);

    configModalTitle.textContent = 'Editar Configuração';
    saveBtnText.textContent = 'Atualizar';

    configModal.classList.add('active');
}

// Excluir configuração
async function deleteConfig(configId) {
    const config = savedConfigs.find(c => c.id === configId);
    if (!config) return;

    if (confirm(`Tem certeza que deseja excluir a configuração "${config.name}"?`)) {
        savedConfigs = savedConfigs.filter(c => c.id !== configId);
        await window.electronAPI.saveS3Configs(savedConfigs);

        renderConfigList();
        populateBucketSelect();

        // Se estava conectado neste bucket, desconectar
        if (currentConfig && currentConfig.id === configId) {
            currentConfig = null;
            bucketSelect.value = '';
            showEmptyState('Selecione um bucket para visualizar os arquivos');
        }

        showNotification('Configuração excluída com sucesso!', 'success');
    }
}

// Gerar ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Gerenciamento de Tema
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('wasabi-viewer-theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    localStorage.setItem('wasabi-viewer-theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        themeToggle.title = 'Alternar para tema claro';
    } else {
        icon.className = 'fas fa-moon';
        themeToggle.title = 'Alternar para tema escuro';
    }
}

// Funções de Compartilhamento

// Conectar via token compartilhado
async function handleConnectShared() {
    const token = shareTokenInput.value.trim();
    if (!token) {
        showNotification('Digite um token para conectar', 'error');
        return;
    }

    try {
        showStatus('Decodificando token...', 'info');

        const result = await window.electronAPI.decodeShareToken(token);
        if (!result.success) {
            throw new Error(result.error);
        }

        showStatus('Testando conexão...', 'info');

        const testResult = await window.electronAPI.testSharedConnection(result.config);
        if (!testResult.success) {
            throw new Error(testResult.error);
        }

        showStatus('Conectando...', 'info');

        const connectResult = await window.electronAPI.connectSharedBucket(result.config);
        if (!connectResult.success) {
            throw new Error(connectResult.error);
        }

        // Configuração compartilhada conectada com sucesso
        currentConfig = result.config;
        shareTokenInput.value = '';

        showStatus('Conectado ao bucket compartilhado!', 'success');

        // Atualizar lista de buckets para incluir o compartilhado
        populateBucketSelect();

        setTimeout(() => {
            showMainScreen();
            loadFiles();
        }, 1000);

    } catch (error) {
        console.error('Erro ao conectar via token:', error);
        showStatus('Erro: ' + error.message, 'error');
    }
}

// Mostrar modal de compartilhamento
function showShareModal(configId) {
    const config = savedConfigs.find(c => c.id === configId);
    if (!config) return;

    sharingConfigId = configId;
    shareConfigName.textContent = config.name;
    shareResult.classList.remove('active');
    shareToken.value = '';
    shareModal.classList.add('active');
}

// Gerar token de compartilhamento
async function handleGenerateToken() {
    if (!sharingConfigId) return;

    try {
        const result = await window.electronAPI.generateShareToken(sharingConfigId, savedConfigs);
        if (!result.success) {
            throw new Error(result.error);
        }

        shareToken.value = result.token;
        shareResult.classList.add('active');

        showNotification('Token gerado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao gerar token:', error);
        showNotification('Erro ao gerar token: ' + error.message, 'error');
    }
}

// Copiar token para clipboard
async function copyShareToken() {
    const token = shareToken.value;
    if (!token) return;

    try {
        await window.electronAPI.copyToClipboard(token);
        showNotification('Token copiado!', 'success');
    } catch (error) {
        console.error('Erro ao copiar token:', error);
        showNotification('Erro ao copiar token', 'error');
    }
}

// Copiar instruções de uso
async function copyShareInstructions() {
    const token = shareToken.value;
    if (!token) return;

    const config = savedConfigs.find(c => c.id === sharingConfigId);
    const instructions = `🔗 WASABI VIEWER - ACESSO COMPARTILHADO

📋 Configuração: ${config?.name || 'N/A'}
🪣 Bucket: ${config?.bucket || 'N/A'}

🔐 Token de Acesso:
${token}

📖 Como usar:
1. Abra o Wasabi Viewer
2. Na tela de configuração, cole o token no campo "Token Compartilhado"
3. Clique em "Conectar"
4. Você terá acesso somente leitura aos arquivos

⚠️ IMPORTANTE:
• Este token contém credenciais de acesso
• Não compartilhe com pessoas não autorizadas
• O token não expira, mas pode ser revogado pelo proprietário

Desenvolvido com ❤️ usando Electron`;

    try {
        await window.electronAPI.copyToClipboard(instructions);
        showNotification('Instruções copiadas!', 'success');
    } catch (error) {
        console.error('Erro ao copiar instruções:', error);
        showNotification('Erro ao copiar instruções', 'error');
    }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    const notifications = document.getElementById('notifications');
    // Garantir apenas uma notificação visível por vez
    if (notifications) {
        notifications.innerHTML = '';
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' :
            'fa-info-circle';

    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    notifications.appendChild(notification);

    // Remover após 5 segundos
    setTimeout(() => {
        notification.remove();
    }, 5000);
}
