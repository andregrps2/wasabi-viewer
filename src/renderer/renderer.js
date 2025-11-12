// Estado da aplicação
let currentPath = '';
// Histórico de navegação
let navHistory = [''];
let navIndex = 0;
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
let _downloadMinimized = false; // quando true, manter apenas mini janela ativa
let _downloadActive = false; // indica se há um download em andamento
let _downloadQueue = []; // fila de próximos downloads { fileKey, fileName, savePath }

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
// Navegação
const navBackBtn = document.getElementById('nav-back');
const navForwardBtn = document.getElementById('nav-forward');
// Botão e modal de Configurações
const settingsBtn = document.getElementById('settings-btn');
const settingsBtnConfig = document.getElementById('settings-btn-config');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsTabs = document.querySelectorAll('.settings-tab');
// Preferências
const prefUseDefaultDownload = document.getElementById('pref-use-default-download');
const prefDefaultDownloadPath = document.getElementById('pref-default-download-path');
const prefChooseDownloadDir = document.getElementById('pref-choose-download-dir');
// Tema
const themeSwitch = document.getElementById('theme-switch');

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
const linkCustom = document.getElementById('link-custom');
const customExpiryValue = document.getElementById('custom-expiry-value');
const customExpiryUnit = document.getElementById('custom-expiry-unit');
const customExpiryInc = document.getElementById('custom-expiry-inc');
const customExpiryDec = document.getElementById('custom-expiry-dec');
// Mini janela de download
const downloadMini = document.getElementById('download-mini');
const miniProgressFill = document.getElementById('mini-progress-fill');
const miniProgressPercent = document.getElementById('mini-progress-percent');
const miniProgressSize = document.getElementById('mini-progress-size');
const miniProgressEta = document.getElementById('mini-progress-eta');
const miniQueueCount = document.getElementById('mini-queue-count');
const modalQueueCount = document.getElementById('modal-queue-count');
const progressFileName = document.getElementById('progress-file-name');
const queuePopover = document.getElementById('queue-popover');
const queuePopoverToggle = document.getElementById('queue-popover-toggle');
const modalQueueWrap = document.querySelector('.modal-queue-wrap');
const queueRemoveModal = document.getElementById('queue-remove-modal');
const queueRemoveYes = document.getElementById('queue-remove-yes');
const queueRemoveNo = document.getElementById('queue-remove-no');
let _queueRemoveIndex = null;
let _dragIndex = null;
// Notificações: controle de simultâneas e fila
let _notifActiveCount = 0;
let _notifPending = [];

function updateMiniQueueInfo(options = {}) {
    const q = Array.isArray(_downloadQueue) ? _downloadQueue.length : 0;
    const show = q > 0;
    const labelMini = q > 0 ? `Fila: ${q}` : '';
    const labelModal = show ? `Fila: ${q}` : '';
    if (miniQueueCount) miniQueueCount.textContent = labelMini;
    if (modalQueueCount) modalQueueCount.textContent = labelModal;
    if (modalQueueWrap) {
        modalQueueWrap.style.display = show ? 'flex' : 'none';
        if (!show) {
            modalQueueWrap.classList.remove('active');
            if (queuePopoverToggle) {
                queuePopoverToggle.setAttribute('aria-expanded', 'false');
                const icon = queuePopoverToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            }
        }
    }
    // Renderizar o popover de forma assíncrona para evitar travamentos perceptíveis
    const skipRender = options && options.skipRender === true;
    if (!skipRender) {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => renderQueuePopover());
        } else {
            setTimeout(() => renderQueuePopover(), 0);
        }
    }
}

function resetProgressUI() {
    try {
        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');
        const sizeText = document.getElementById('progress-size');
        const percentLabel = document.getElementById('progress-percent');
        const etaEl = document.getElementById('progress-eta');

        // Reset sem animação de regressão
        if (fill) {
            fill.classList.remove('indeterminate');
            const prevTransition = fill.style.transition;
            fill.style.transition = 'none';
            fill.style.width = '0%';
            void fill.offsetHeight; // força reflow
            fill.style.transition = prevTransition || '';
        }
        if (percentLabel) percentLabel.textContent = '0%';
        if (text) text.textContent = 'Preparando download...';
        if (sizeText) sizeText.textContent = '0 B / 0 B';
        if (etaEl) etaEl.textContent = '—';
        if (progressFileName) progressFileName.textContent = '';

        if (miniProgressFill) {
            miniProgressFill.classList.remove('indeterminate');
            const prevMiniTransition = miniProgressFill.style.transition;
            miniProgressFill.style.transition = 'none';
            miniProgressFill.style.width = '0%';
            void miniProgressFill.offsetHeight; // reflow
            miniProgressFill.style.transition = prevMiniTransition || '';
        }
        if (miniProgressPercent) miniProgressPercent.textContent = '0%';
        if (miniProgressSize) miniProgressSize.textContent = '0 B / 0 B';
        if (miniProgressEta) miniProgressEta.textContent = '—';
    } catch {}
}

function escapeHtml(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderQueuePopover() {
    if (!queuePopover) return;
    try {
        const q = Array.isArray(_downloadQueue) ? _downloadQueue : [];
        if (!q.length) {
            queuePopover.innerHTML = `<div class="queue-title">Fila de downloads</div><div class="empty">Nenhum arquivo na fila</div>`;
            return;
        }
        const items = q.map((item, idx) => {
            const name = escapeHtml(item && item.fileName ? item.fileName : '(sem nome)');
            const showUp = idx > 0;
            const showDown = idx < q.length - 1;
            const upBtn = showUp ? `
                        <button class="btn btn-secondary" data-action="up" data-index="${idx}" title="Mover para cima">
                            <i class="fas fa-arrow-up"></i>
                        </button>` : '';
            const downBtn = showDown ? `
                        <button class="btn btn-secondary" data-action="down" data-index="${idx}" title="Mover para baixo">
                            <i class="fas fa-arrow-down"></i>
                        </button>` : '';
            return `
                <div class="queue-item" data-index="${idx}" data-key="${escapeHtml(item && item.fileKey ? item.fileKey : String(idx))}">
                    <i class="fas fa-file"></i>
                    <span class="name">${name}</span>
                    <div class="actions">
                        ${upBtn}
                        ${downBtn}
                        <button class="btn btn-danger" data-action="remove" data-index="${idx}" title="Remover da fila">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');
        queuePopover.innerHTML = `<div class="queue-title">Fila de downloads</div>${items}`;
    } catch (e) {
        queuePopover.innerHTML = `<div class="queue-title">Fila de downloads</div><div class="empty">—</div>`;
    }
}

// Utilitário: posições dos itens da fila (para FLIP)
function getQueueItemPositions() {
    const map = {};
    if (!queuePopover) return map;
    const items = queuePopover.querySelectorAll('.queue-item');
    items.forEach(el => {
        const key = el.getAttribute('data-key');
        if (key) {
            const rect = el.getBoundingClientRect();
            map[key] = rect.top;
        }
    });
    return map;
}
// Modal de salvar arquivo
const saveModal = document.getElementById('save-modal');
const saveBreadcrumb = document.getElementById('save-breadcrumb');
const saveDirList = document.getElementById('save-dir-list');
const saveFileNameInput = document.getElementById('save-file-name');
const saveConfirmBtn = document.getElementById('save-confirm-btn');
const saveCancelBtn = document.getElementById('save-cancel-btn');
const saveNavBackBtn = document.getElementById('save-nav-back');
const saveNavForwardBtn = document.getElementById('save-nav-forward');
const pathErrorModal = document.getElementById('path-error-modal');
const pathErrorOkBtn = document.getElementById('path-error-ok');

// Estado do modal de salvar
let saveCurrentDir = '';
let pendingDownload = { key: null, name: null };
let saveModalMode = 'download'; // 'download' | 'chooseDir'
let saveNavHistory = [];
let saveNavIndex = -1;
// Estado de preferências
let appPreferences = { useDefaultDownloadDir: false, defaultDownloadDir: null, theme: 'light' };

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar preferências e UI de configurações
    await initSettings();

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
                // Se recebemos evento explícito de cancelamento, mostrar notificação mínima e sair cedo.
                if (data && data.cancelled) {
                    if (text) text.textContent = 'Download cancelado pelo usuario';
                    showNotification('Download cancelado pelo usuario', 'info');
                    _downloadCancelledFlag = true;
                    return; // evitar atualizações pesadas de UI após cancelamento
                }

                // Evitar atualizações de UI se não há download ativo ou já foi cancelado
                if (!_downloadActive || _downloadCancelledFlag) {
                    return;
                }
                // Não forçar visibilidade: respeitar estado atual e o modo minimizado
                if (_downloadMinimized) {
                    if (downloadMini) downloadMini.classList.add('active');
                    if (progressModal) progressModal.classList.remove('active');
                }
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

                    // Atualizar mini janela
                    if (miniProgressFill) {
                        miniProgressFill.classList.remove('indeterminate');
                        miniProgressFill.style.width = `${percent}%`;
                    }
                    if (miniProgressPercent) miniProgressPercent.textContent = `${percentDisplay}%`;
                    if (miniProgressSize) miniProgressSize.textContent = `${formatFileSize(downloaded)} / ${formatFileSize(total)}`;

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
                                const etaText = `Tempo estimado: ${formatTimeRemaining(remainingSec)}`;
                                etaEl.textContent = etaText;
                                if (miniProgressEta) miniProgressEta.textContent = etaText;
                                _etaLastUpdateAt = now2;
                            }
                        } else {
                            const dash = `Tempo estimado: —`;
                            document.getElementById('progress-eta').textContent = dash;
                            if (miniProgressEta) miniProgressEta.textContent = dash;
                        }
                    } catch (e) {
                        const dash = `Tempo estimado: —`;
                        document.getElementById('progress-eta').textContent = dash;
                        if (miniProgressEta) miniProgressEta.textContent = dash;
                    }

                    if (percent >= 100) {
                        text.textContent = 'Download concluído';
                        // Não fechar aqui: deixar o fluxo de performDownload/processNextFromQueue
                        // conduzir encerramento da UI e início do próximo item.
                        _downloadLastSample = null;
                        _downloadSpeedBps = null;
                        _etaLastUpdateAt = 0;
                    }
                } else if (data && (data.percent !== null && data.percent !== undefined)) {
                    // Fallback: percent provided by main
                    const percent = Math.min(100, Math.max(0, Number(data.percent)));
                    const percentDisplay = Math.round(percent);
                    fill.classList.remove('indeterminate');
                    fill.style.width = `${percent}%`;
                    text.textContent = `Progresso: ${percentDisplay}%`;
                    sizeText.textContent = data.downloadedBytes ? `${formatFileSize(data.downloadedBytes)} / ?` : '';

                    // Atualizar mini janela
                    if (miniProgressFill) {
                        miniProgressFill.classList.remove('indeterminate');
                        miniProgressFill.style.width = `${percent}%`;
                    }
                    if (miniProgressPercent) miniProgressPercent.textContent = `${percentDisplay}%`;
                    if (miniProgressSize) miniProgressSize.textContent = data.downloadedBytes ? `${formatFileSize(data.downloadedBytes)} / ?` : '';

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
                        const dash = `Tempo estimado: —`;
                        document.getElementById('progress-eta').textContent = dash;
                        if (miniProgressEta) miniProgressEta.textContent = dash;
                    }

                    if (percent >= 100) {
                        text.textContent = 'Download concluído';
                        _downloadLastSample = null;
                        _downloadSpeedBps = null;
                        _etaLastUpdateAt = 0;
                    }
                } else if (data && data.downloadedBytes) {
                    // Unknown total size: show downloaded bytes and indeterminate animation
                    fill.classList.add('indeterminate');
                    const downloaded = Number(data.downloadedBytes) || 0;
                    text.textContent = `Baixados: ${formatFileSize(downloaded)}`;
                    sizeText.textContent = `${formatFileSize(downloaded)} / ?`;

                    // Atualizar mini janela
                    if (miniProgressFill) miniProgressFill.classList.add('indeterminate');
                    if (miniProgressPercent) miniProgressPercent.textContent = '';
                    if (miniProgressSize) miniProgressSize.textContent = `${formatFileSize(downloaded)} / ?`;

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
                    const dash = `Tempo estimado: —`;
                    document.getElementById('progress-eta').textContent = dash;
                    if (miniProgressEta) miniProgressEta.textContent = dash;
                }

                // Eventos normais continuam; encerramento e UI são tratados em performDownload
            } catch (err) {
                console.error('Erro ao processar evento de progresso:', err);
            }
        });
    }

    // Botão de cancelar download — abrir modal de confirmação customizado
    const cancelBtn = document.getElementById('cancel-download-btn');
    const cancelConfirmModal = document.getElementById('cancel-confirm-modal');
    const cancelYes = document.getElementById('cancel-confirm-yes');
    const cancelAll = document.getElementById('cancel-confirm-all');
    const cancelNo = document.getElementById('cancel-confirm-no');
    // Botões da mini janela
    const minimizeDownloadBtn = document.getElementById('minimize-download-btn');
    const miniRestoreBtn = document.getElementById('mini-restore-btn');
    const miniCancelBtn = document.getElementById('mini-cancel-btn');

    // Preparar modal de confirmação de cancelamento conforme estado da fila
    function prepareCancelConfirmModal() {
        if (!cancelConfirmModal) return;
        const hasQueue = Array.isArray(_downloadQueue) && _downloadQueue.length > 0;
        if (cancelAll) {
            cancelAll.style.display = hasQueue ? '' : 'none';
        }
        if (cancelYes) {
            cancelYes.textContent = hasQueue ? 'Cancelar somente atual' : 'Sim, cancelar download';
        }
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (cancelConfirmModal) {
                prepareCancelConfirmModal();
                cancelConfirmModal.classList.add('active');
            } else {
                // fallback: enviar cancel direto
                if (window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
                    window.electronAPI.cancelDownload();
                }
            }
        });
    }

    // Minimizar modal de progresso para mini janela
    if (minimizeDownloadBtn) {
        minimizeDownloadBtn.addEventListener('click', () => {
            _downloadMinimized = true;
            if (progressModal) progressModal.classList.remove('active');
            if (downloadMini) downloadMini.classList.add('active');
            // Fechar a aba da fila ao minimizar
            if (modalQueueWrap) {
                modalQueueWrap.classList.remove('active');
                if (queuePopoverToggle) {
                    queuePopoverToggle.setAttribute('aria-expanded', 'false');
                    const icon = queuePopoverToggle.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-chevron-up');
                        icon.classList.add('fa-chevron-down');
                    }
                }
            }
        });
    }

    // Restaurar a partir da mini janela
    if (miniRestoreBtn) {
        miniRestoreBtn.addEventListener('click', () => {
            _downloadMinimized = false;
            if (downloadMini) downloadMini.classList.remove('active');
            if (progressModal) progressModal.classList.add('active');
            // Restaurar com a aba da fila fechada por padrão
            if (modalQueueWrap) {
                modalQueueWrap.classList.remove('active');
                if (queuePopoverToggle) {
                    queuePopoverToggle.setAttribute('aria-expanded', 'false');
                    const icon = queuePopoverToggle.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-chevron-up');
                        icon.classList.add('fa-chevron-down');
                    }
                }
            }
        });
    }

    // Cancelar a partir da mini janela
    if (miniCancelBtn) {
        miniCancelBtn.addEventListener('click', () => {
            if (cancelConfirmModal) {
                prepareCancelConfirmModal();
                cancelConfirmModal.classList.add('active');
            } else if (window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
                window.electronAPI.cancelDownload();
            }
        });
    }

    // Confirmar cancelamento
    if (cancelYes) {
        cancelYes.addEventListener('click', () => {
            try {
                if (window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
                    // Disparar cancelamento sem aguardar para evitar travamento visual
                    window.electronAPI.cancelDownload();
                }
            } catch (err) {
                console.error('Erro ao cancelar download:', err);
                showNotification('Erro ao cancelar download', 'error');
            }
            // Fechar imediatamente para manter a UI fluida
            if (cancelConfirmModal) cancelConfirmModal.classList.remove('active');
            if (progressModal) progressModal.classList.remove('active');
        });
    }

    // Cancelar toda a fila
    if (cancelAll) {
        cancelAll.addEventListener('click', () => {
            try {
                // cancelar o atual (assíncrono, sem aguardar)
                if (window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
                    window.electronAPI.cancelDownload();
                }
            } catch (err) {
                console.error('Erro ao cancelar downloads:', err);
                showNotification('Erro ao cancelar downloads', 'error');
            }
            // limpar a fila e atualizar indicadores imediatamente
            const removed = _downloadQueue.length;
            _downloadQueue = [];
            updateMiniQueueInfo();
            if (removed > 0) {
                showNotification(`Fila cancelada: ${removed} itens removidos`, 'info');
            }
            if (cancelConfirmModal) cancelConfirmModal.classList.remove('active');
            if (progressModal) progressModal.classList.remove('active');
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
        if (!window.electronAPI || typeof window.electronAPI.loadS3Configs !== 'function') {
            savedConfigs = [];
            renderConfigList();
            return;
        }
        const configs = await window.electronAPI.loadS3Configs();
        savedConfigs = configs || [];
        renderConfigList();
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        savedConfigs = [];
        renderConfigList();
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
    cancelModalBtn.addEventListener('click', hideConfigModal);

    // Configurações
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (settingsModal) settingsModal.classList.add('active');
        });
    }
    if (settingsBtnConfig) {
        settingsBtnConfig.addEventListener('click', () => {
            if (settingsModal) settingsModal.classList.add('active');
        });
    }
    if (settingsClose) {
        settingsClose.addEventListener('click', () => {
            if (settingsModal) settingsModal.classList.remove('active');
        });
    }
    if (settingsTabs && settingsTabs.forEach) {
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // alternar aba ativa
                settingsTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.getAttribute('data-tab');
                document.querySelectorAll('.settings-section').forEach(sec => {
                    sec.classList.remove('active');
                });
                const section = document.getElementById(`settings-section-${target}`);
                if (section) section.classList.add('active');
            });
        });
    }
    if (themeSwitch) {
        themeSwitch.addEventListener('change', () => {
            const newTheme = themeSwitch.checked ? 'dark' : 'light';
            setTheme(newTheme);
        });
    }
    if (prefUseDefaultDownload) {
        prefUseDefaultDownload.addEventListener('change', async () => {
            appPreferences.useDefaultDownloadDir = !!prefUseDefaultDownload.checked;
            // Se marcado e sem diretório definido, solicitar escolha
            if (appPreferences.useDefaultDownloadDir && !appPreferences.defaultDownloadDir) {
                await openChooseDefaultDirModal();
            }
            // persistir
            try { await window.electronAPI.savePreferences(appPreferences); } catch (e) { console.error(e); }
        });
    }
    if (prefChooseDownloadDir) {
        prefChooseDownloadDir.addEventListener('click', async () => {
            await openChooseDefaultDirModal();
        });
    }

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

    // Navegação por setas (voltar/avançar)
    if (navBackBtn) {
        navBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goBack();
        });
    }
    if (navForwardBtn) {
        navForwardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goForward();
        });
    }
    updateNavButtons();

    // Botões laterais do mouse (Windows): 3 = Back, 4 = Forward
    window.addEventListener('mouseup', (e) => {
        if (e.button === 3) {
            e.preventDefault();
            if (saveModal && saveModal.classList.contains('active')) { saveGoBack(); return; }
            goBack();
        }
        if (e.button === 4) {
            e.preventDefault();
            if (saveModal && saveModal.classList.contains('active')) { saveGoForward(); return; }
            goForward();
        }
    });

    // Toggle da fila (fold) no canto inferior esquerdo
    if (queuePopoverToggle && modalQueueWrap) {
        queuePopoverToggle.addEventListener('click', () => {
            const nowActive = modalQueueWrap.classList.toggle('active');
            queuePopoverToggle.setAttribute('aria-expanded', String(nowActive));
            const icon = queuePopoverToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-chevron-down', 'fa-chevron-up');
                icon.classList.add(nowActive ? 'fa-chevron-up' : 'fa-chevron-down');
            }
        });
    }

    // Ações do popover da fila (remover e mover para cima/baixo)
    if (queuePopover) {
        queuePopover.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'), 10);
            if (Number.isNaN(index) || index < 0 || index >= _downloadQueue.length) return;

            if (action === 'remove') {
                _queueRemoveIndex = index;
                if (queueRemoveModal) queueRemoveModal.classList.add('active');
                return;
            }

            if (action === 'up' && index > 0) {
                const before = getQueueItemPositions();
                const tmp = _downloadQueue[index - 1];
                _downloadQueue[index - 1] = _downloadQueue[index];
                _downloadQueue[index] = tmp;
                renderQueuePopover();
                updateMiniQueueInfo({ skipRender: true });
                // Aplicar FLIP na próxima frame (após render agendado)
                if (typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(() => {
                        const items = queuePopover.querySelectorAll('.queue-item');
                        items.forEach(el => {
                            const key = el.getAttribute('data-key');
                            if (!key || !(key in before)) return;
                            const afterTop = el.getBoundingClientRect().top;
                            const deltaY = before[key] - afterTop;
                            if (deltaY !== 0) {
                                // Passo 1: aplicar deslocamento sem transição e forçar reflow
                                el.style.transition = 'none';
                                el.style.transform = `translateY(${deltaY}px)`;
                                void el.offsetHeight;
                                // Passo 2: animar para posição final
                                el.style.transition = 'transform 200ms ease';
                                el.style.transform = 'translateY(0)';
                                el.addEventListener('transitionend', () => {
                                    el.style.transform = '';
                                    el.style.transition = '';
                                }, { once: true });
                            }
                        });
                    });
                }
                return;
            }

            if (action === 'down' && index < _downloadQueue.length - 1) {
                const before = getQueueItemPositions();
                const tmp = _downloadQueue[index + 1];
                _downloadQueue[index + 1] = _downloadQueue[index];
                _downloadQueue[index] = tmp;
                renderQueuePopover();
                updateMiniQueueInfo({ skipRender: true });
                // Aplicar FLIP na próxima frame (após render agendado)
                if (typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(() => {
                        const items = queuePopover.querySelectorAll('.queue-item');
                        items.forEach(el => {
                            const key = el.getAttribute('data-key');
                            if (!key || !(key in before)) return;
                            const afterTop = el.getBoundingClientRect().top;
                            const deltaY = before[key] - afterTop;
                            if (deltaY !== 0) {
                                el.style.transition = 'none';
                                el.style.transform = `translateY(${deltaY}px)`;
                                void el.offsetHeight;
                                el.style.transition = 'transform 200ms ease';
                                el.style.transform = 'translateY(0)';
                                el.addEventListener('transitionend', () => {
                                    el.style.transform = '';
                                    el.style.transition = '';
                                }, { once: true });
                            }
                        });
                    });
                }
                return;
            }
        });
    }

    // Modal de remover item da fila
    if (queueRemoveYes) {
        queueRemoveYes.addEventListener('click', () => {
            if (_queueRemoveIndex != null && _queueRemoveIndex >= 0 && _queueRemoveIndex < _downloadQueue.length) {
                _downloadQueue.splice(_queueRemoveIndex, 1);
                _queueRemoveIndex = null;
                renderQueuePopover();
                updateMiniQueueInfo({ skipRender: true });
                // Notificação padrão no canto inferior esquerdo
                showNotification('Arquivo removido da fila', 'info');
            }
            if (queueRemoveModal) queueRemoveModal.classList.remove('active');
        });
    }
    if (queueRemoveNo) {
        queueRemoveNo.addEventListener('click', () => {
            _queueRemoveIndex = null;
            if (queueRemoveModal) queueRemoveModal.classList.remove('active');
        });
    }

    // Acessibilidade básica do popover
    if (queuePopoverToggle && queuePopover) {
        const wrap = queuePopoverToggle.parentElement;
        if (wrap) {
            wrap.addEventListener('mouseenter', () => { queuePopover.setAttribute('aria-hidden', 'false'); });
            wrap.addEventListener('mouseleave', () => { queuePopover.setAttribute('aria-hidden', 'true'); });
        }
    }
}

// Configurar eventos dos modais
function setupModalEvents() {
    // Fechar modais
    document.addEventListener('click', (e) => {
        const isCloseBtn = e.target.classList.contains('modal-close');
        const isOverlay = e.target.classList.contains('modal');
        if (isCloseBtn) {
            closeModals();
            return;
        }
        if (isOverlay) {
            const modalId = e.target.id;
            // Não fechar ao clicar fora nas janelas de Download, Link e seleção de diretório
            if (
                modalId === 'progress-modal' ||
                modalId === 'link-modal' ||
                (modalId === 'save-modal' && saveModalMode === 'chooseDir')
            ) {
                return;
            }
            closeModals();
        }
    });

    // Botões de link
    const btn15m = document.getElementById('link-15m-btn');
    const btn1h = document.getElementById('link-1h-btn');
    const btn24h = document.getElementById('link-24h-btn');
    const btnCustom = document.getElementById('link-custom-btn');
    const btnCustomGen = document.getElementById('link-custom-generate-btn');

    if (btn15m) btn15m.addEventListener('click', () => generateLink(15 * 60));
    if (btn1h) btn1h.addEventListener('click', () => generateLink(60 * 60));
    if (btn24h) btn24h.addEventListener('click', () => generateLink(24 * 60 * 60));
    if (btnCustom && linkCustom) {
        btnCustom.addEventListener('click', () => {
            const isActive = linkCustom.classList.contains('active');
            if (!isActive) {
                linkCustom.classList.add('active');
                linkCustom.setAttribute('aria-hidden', 'false');
            } else {
                linkCustom.classList.remove('active');
                linkCustom.setAttribute('aria-hidden', 'true');
            }
        });
    }
    if (btnCustomGen) {
        btnCustomGen.addEventListener('click', () => {
            const rawVal = Number(customExpiryValue?.value || 0);
            const unit = customExpiryUnit?.value || 'hours';
            if (!rawVal || rawVal <= 0) {
                showNotification('Informe um valor válido para a validade.', 'warning');
                return;
            }
            // Máximo 30 dias
            let seconds = 0;
            if (unit === 'minutes') seconds = rawVal * 60;
            else if (unit === 'hours') seconds = rawVal * 60 * 60;
            else seconds = rawVal * 24 * 60 * 60; // days

            const maxSeconds = 30 * 24 * 60 * 60;
            if (seconds > maxSeconds) {
                showNotification('Validade máxima permitida é de 30 dias.', 'warning');
                return;
            }
            generateLink(seconds);
        });
    }

    // Stepper customizado para validade (incremento/decremento)
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    if (customExpiryInc && customExpiryValue) {
        customExpiryInc.addEventListener('click', () => {
            const min = Number(customExpiryValue.min || 1);
            const max = Number(customExpiryValue.max || 43200);
            const current = Number(customExpiryValue.value || min);
            customExpiryValue.value = clamp(current + 1, min, max);
        });
    }
    if (customExpiryDec && customExpiryValue) {
        customExpiryDec.addEventListener('click', () => {
            const min = Number(customExpiryValue.min || 1);
            const max = Number(customExpiryValue.max || 43200);
            const current = Number(customExpiryValue.value || min);
            customExpiryValue.value = clamp(current - 1, min, max);
        });
    }
    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) copyBtn.addEventListener('click', copyLink);

    // Modal de salvar arquivo
    if (saveCancelBtn) {
        saveCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModals();
            // Se veio de Preferências, restaurar o modal de Configurações
            if (saveModalMode === 'chooseDir' && typeof settingsModal !== 'undefined' && settingsModal) {
                settingsModal.classList.add('active');
            }
        });
    }
    if (saveConfirmBtn) {
        saveConfirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (saveModalMode === 'chooseDir') {
                if (!saveCurrentDir || saveCurrentDir === 'TOP') {
                    showNotification('Selecione uma pasta antes de confirmar.', 'warning');
                    return;
                }
                appPreferences.defaultDownloadDir = saveCurrentDir;
                if (prefDefaultDownloadPath) {
                    prefDefaultDownloadPath.textContent = saveCurrentDir;
                }
                if (prefUseDefaultDownload && !prefUseDefaultDownload.checked) {
                    prefUseDefaultDownload.checked = true;
                    appPreferences.useDefaultDownloadDir = true;
                }
                try { await window.electronAPI.savePreferences(appPreferences); } catch (e) { console.error(e); }
                closeModals();
                // Retornar ao modal de Configurações para manter o contexto
                if (typeof settingsModal !== 'undefined' && settingsModal) {
                    settingsModal.classList.add('active');
                }
                return;
            }
            if (!pendingDownload.key || !pendingDownload.name || !saveCurrentDir || saveCurrentDir === 'TOP') {
                showNotification('Escolha uma pasta para salvar o arquivo.', 'warning');
                return;
            }
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
    // Setas de navegação do modal
    if (saveNavBackBtn) {
        saveNavBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveGoBack();
        });
    }
    if (saveNavForwardBtn) {
        saveNavForwardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveGoForward();
        });
    }
    // Atalhos de teclado para o modal ativo: Alt+Esquerda / Alt+Direita
    document.addEventListener('keydown', (e) => {
        if (!(saveModal && saveModal.classList.contains('active'))) return;
        const isAltLeft = e.altKey && (e.code === 'ArrowLeft' || e.key === 'ArrowLeft');
        const isAltRight = e.altKey && (e.code === 'ArrowRight' || e.key === 'ArrowRight');
        if (isAltLeft) { e.preventDefault(); e.stopPropagation(); saveGoBack(); }
        if (isAltRight) { e.preventDefault(); e.stopPropagation(); saveGoForward(); }
    });

    // Permitir digitar caminho diretamente na área de breadcrumb (editável)
    if (saveBreadcrumb) {
        saveBreadcrumb.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && saveModal && saveModal.classList.contains('active')) {
                e.preventDefault();
                const raw = saveBreadcrumb.innerText || '';
                let targetPath = (raw || '').trim();
                // Mapeamento amigável: 'Locais' -> 'TOP'
                if (targetPath.toLowerCase() === 'locais') targetPath = 'TOP';
                if (targetPath) {
                    loadSaveDir(targetPath, { showErrorModal: true });
                }
            }
        });
        // Ao focar para edição, mostrar o caminho completo atual como texto simples
        saveBreadcrumb.addEventListener('focus', () => {
            if (saveCurrentDir) {
                saveBreadcrumb.textContent = (saveCurrentDir === 'TOP') ? 'Locais' : saveCurrentDir;
            }
        });
        // Ao desfocar sem Enter, re-renderizar os breadcrumbs clicáveis
        saveBreadcrumb.addEventListener('blur', () => {
            if (saveCurrentDir) {
                renderSaveBreadcrumb(saveCurrentDir);
            }
        });
    }

    // Modal de erro: retornar para seletor ao confirmar
    if (pathErrorOkBtn) {
        pathErrorOkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (pathErrorModal) pathErrorModal.classList.remove('active');
            if (saveModal) saveModal.classList.add('active');
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
async function loadFiles(path = '', options = {}) {
    console.log('Iniciando carregamento de arquivos, path:', path);

    if (!currentConfig) {
        showEmptyState('Selecione um bucket para visualizar os arquivos');
        return;
    }

    const fromHistory = !!options.fromHistory;
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
        // Atualizar histórico se não vier de navegação do histórico
        if (!fromHistory) {
            // Se o usuário navegou para uma nova pasta, cortar o futuro
            if (navIndex < navHistory.length - 1) {
                navHistory = navHistory.slice(0, navIndex + 1);
            }
            navHistory.push(path);
            navIndex = navHistory.length - 1;
        }
        updateNavButtons();
        console.log('Carregamento concluído com sucesso');
    } catch (error) {
        console.error('Erro ao carregar arquivos:', error);
        showNotification('Erro ao carregar arquivos: ' + error.message, 'error');
        showEmptyState('Erro ao carregar arquivos');
    } finally {
        showLoading(false);
    }
}

function updateNavButtons() {
    if (navBackBtn) {
        navBackBtn.disabled = navIndex <= 0;
    }
    if (navForwardBtn) {
        navForwardBtn.disabled = navIndex >= navHistory.length - 1;
    }
}

function goBack() {
    if (navIndex > 0) {
        navIndex -= 1;
        const targetPath = navHistory[navIndex] || '';
        loadFiles(targetPath, { fromHistory: true });
        updateNavButtons();
    }
}

function goForward() {
    if (navIndex < navHistory.length - 1) {
        navIndex += 1;
        const targetPath = navHistory[navIndex] || '';
        loadFiles(targetPath, { fromHistory: true });
        updateNavButtons();
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
                    <button class="btn btn-secondary btn-download" title="Baixar">
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

        // Clique único para abrir pasta
        if (type === 'folder') {
            item.addEventListener('click', () => {
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
    // Se preferência de diretório padrão estiver ativa e definida, validar e baixar direto
    try {
        if (appPreferences.useDefaultDownloadDir && appPreferences.defaultDownloadDir) {
            if (window.electronAPI && typeof window.electronAPI.validateDir === 'function') {
                try {
                    const res = await window.electronAPI.validateDir(appPreferences.defaultDownloadDir);
                    const ok = !!(res && res.exists && res.isDirectory);
                    if (!ok) {
                        showNotification('Local de download padrão não encontrado. Selecione um novo local.', 'warning');
                        pendingDownload = { key: fileKey, name: fileName };
                        await openChooseDefaultDirModal();
                        return;
                    }
                } catch (verr) {
                    console.error('Falha ao validar diretório padrão:', verr);
                    showNotification('Não foi possível validar o diretório padrão.', 'error');
                }
            }
            const savePath = joinPaths(appPreferences.defaultDownloadDir, fileName);
            await performDownload(fileKey, fileName, savePath);
            return;
        }
    } catch (e) {
        console.error('Erro ao preparar caminho padrão de download:', e);
    }
    // Senão, abrir modal customizado para escolher diretório e nome
    pendingDownload = { key: fileKey, name: fileName };
    saveFileNameInput && (saveFileNameInput.value = fileName);
    await openSaveModal();
}

async function openSaveModal() {
    try {
        const home = await window.electronAPI.getHomeDir();
        saveCurrentDir = home;
        // inicializar histórico de navegação do seletor
        saveNavHistory = [];
        saveNavIndex = -1;
        await loadSaveDir(home);
        // Modo padrão: download
        saveModalMode = 'download';
        const nameRow = saveFileNameInput?.closest('.form-row');
        if (nameRow) nameRow.style.display = '';
        const labelEl = document.getElementById('save-input-label');
        if (labelEl) labelEl.textContent = 'Nome do arquivo';
        if (saveFileNameInput) {
            saveFileNameInput.placeholder = 'nome.ext';
        }
        if (saveBreadcrumb) {
            renderSaveBreadcrumb(saveCurrentDir || '');
        }
        const headerEl = saveModal?.querySelector('.modal-header h3');
        if (headerEl) headerEl.textContent = 'Salvar arquivo';
        if (saveConfirmBtn) saveConfirmBtn.textContent = 'Salvar aqui';
        if (saveModal) saveModal.classList.add('active');
    } catch (e) {
        console.error('Erro abrindo modal de salvar:', e);
        showNotification('Não foi possível abrir o modal de salvar', 'error');
    }
}

async function openChooseDefaultDirModal() {
    try {
        const home = await window.electronAPI.getHomeDir();
        saveCurrentDir = home;
        // inicializar histórico de navegação do seletor
        saveNavHistory = [];
        saveNavIndex = -1;
        // Abrir imediatamente o modal para feedback visual
        if (saveModal) saveModal.classList.add('active');
        await loadSaveDir(home);
        // Modo seleção de diretório para preferências
        saveModalMode = 'chooseDir';
        const nameRow = saveFileNameInput?.closest('.form-row');
        if (nameRow) nameRow.style.display = 'none';
        if (saveBreadcrumb) {
            renderSaveBreadcrumb(saveCurrentDir || '');
        }
        const headerEl = saveModal?.querySelector('.modal-header h3');
        if (headerEl) headerEl.textContent = 'Selecionar diretório de download';
        if (saveConfirmBtn) saveConfirmBtn.textContent = 'Selecionar aqui';
        // Manter Configurações abertas; seletor aparece por cima (z-index maior)
    } catch (e) {
        console.error('Erro abrindo modal de diretório:', e);
        showNotification('Não foi possível abrir a seleção de diretório', 'error');
    }
}

async function loadSaveDir(dirPath, options = {}) {
    try {
        const showErrorModal = !!options.showErrorModal;
        // Validação prévia quando usuário digita caminho manualmente
        if (dirPath && dirPath !== 'TOP' && window.electronAPI && typeof window.electronAPI.validateDir === 'function') {
            try {
                const res = await window.electronAPI.validateDir(dirPath);
                const ok = !!(res && res.exists && res.isDirectory);
                if (!ok) {
                    if (showErrorModal && typeof pathErrorModal !== 'undefined' && pathErrorModal) {
                        if (typeof saveModal !== 'undefined' && saveModal) saveModal.classList.remove('active');
                        pathErrorModal.classList.add('active');
                    } else {
                        showNotification('Caminho inválido: ' + dirPath, 'error');
                    }
                    return;
                }
            } catch (verr) {
                console.error('Erro validando caminho digitado:', verr);
                showNotification('Não foi possível validar o caminho informado.', 'error');
                return;
            }
        }
        const { base, entries } = await window.electronAPI.listDir(dirPath);
        saveCurrentDir = base;
        if (saveBreadcrumb) {
            renderSaveBreadcrumb(base);
        }
        // atualizar histórico, a menos que explicitamente desativado
        if (options.pushHistory !== false) {
            if (saveNavHistory.length === 0) {
                saveNavHistory = [base];
                saveNavIndex = 0;
            } else if (saveNavHistory[saveNavIndex] !== base) {
                if (saveNavIndex < saveNavHistory.length - 1) {
                    saveNavHistory = saveNavHistory.slice(0, saveNavIndex + 1);
                }
                saveNavHistory.push(base);
                saveNavIndex = saveNavHistory.length - 1;
            }
            updateSaveNavButtons();
        }
        renderSaveBreadcrumb(base);
        renderSaveDirEntries(entries);
    } catch (e) {
        console.error('Erro listando diretório:', e);
        if (options && options.showErrorModal && typeof pathErrorModal !== 'undefined' && pathErrorModal) {
            if (typeof saveModal !== 'undefined' && saveModal) saveModal.classList.remove('active');
            pathErrorModal.classList.add('active');
        } else {
            showNotification('Erro ao listar diretório: ' + e.message, 'error');
        }
    }
}

function updateSaveNavButtons() {
    if (saveNavBackBtn) {
        if (saveNavIndex > 0) {
            saveNavBackBtn.removeAttribute('disabled');
        } else {
            saveNavBackBtn.setAttribute('disabled', 'true');
        }
    }
    if (saveNavForwardBtn) {
        if (saveNavIndex >= 0 && saveNavIndex < saveNavHistory.length - 1) {
            saveNavForwardBtn.removeAttribute('disabled');
        } else {
            saveNavForwardBtn.setAttribute('disabled', 'true');
        }
    }
}

function saveGoBack() {
    if (saveNavIndex > 0) {
        saveNavIndex -= 1;
        const target = saveNavHistory[saveNavIndex];
        loadSaveDir(target, { pushHistory: false });
        updateSaveNavButtons();
    }
}

function saveGoForward() {
    if (saveNavIndex >= 0 && saveNavIndex < saveNavHistory.length - 1) {
        saveNavIndex += 1;
        const target = saveNavHistory[saveNavIndex];
        loadSaveDir(target, { pushHistory: false });
        updateSaveNavButtons();
    }
}

function renderSaveBreadcrumb(base) {
    if (!saveBreadcrumb) return;
    // Exibir rótulo amigável quando na origem TOP
    if (base === 'TOP') {
        saveBreadcrumb.innerHTML = `<span class="crumb" data-path="TOP">Locais</span>`;
        return;
    }
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
    // Se já há download ativo, enfileira até o máximo de 4
    if (_downloadActive) {
        if (_downloadQueue.length >= 4) {
            showNotification('Limite de 4 arquivos na fila atingido', 'info');
            return;
        }
        _downloadQueue.push({ fileKey, fileName, savePath });
        updateMiniQueueInfo();
        showNotification(`Adicionado à fila: ${fileName}`, 'info');
        // Garantir mini janela visível ao enfileirar no modo minimizado
        if (_downloadMinimized && downloadMini) downloadMini.classList.add('active');
        return;
    }

    // Inicia imediatamente
    _downloadActive = true;
    _downloadCancelledFlag = false;
    _downloadLastSample = null;
    _downloadSpeedBps = null;
    _etaLastUpdateAt = 0;
    // Ao iniciar novo download sem processo ativo nem fila, abrir modal padrão
    if (!_downloadQueue.length) {
        _downloadMinimized = false;
    }
    // UI conforme estado minimizado
    if (_downloadMinimized) {
        if (progressModal) progressModal.classList.remove('active');
        if (downloadMini) downloadMini.classList.add('active');
    } else {
        showProgressModal();
    }
    resetProgressUI();
    if (progressFileName) progressFileName.textContent = fileName || '';

    try {
        const result = await window.electronAPI.downloadFile(fileKey, fileName, savePath);
        if (result.success) {
            showNotification(`Arquivo baixado: ${result.path}`, 'success');
        } else {
            const msg = (result.error || result.message || '').toString().toLowerCase();
            const isCancel = msg.includes('cancel') || msg.includes('cancelado') || msg.includes('canceled');
            if (!isCancel) {
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
        // Encerrar UI atual
        closeModals();
        _downloadActive = false;
        // Processar próximo da fila
        processNextFromQueue();
    }
}

function processNextFromQueue() {
    if (_downloadQueue.length === 0) {
        updateMiniQueueInfo();
        return;
    }
    const next = _downloadQueue.shift();
    updateMiniQueueInfo();
    if (next && next.fileName) {
        showNotification(`Iniciando próximo download na fila: ${next.fileName}`, 'info');
    } else {
        showNotification('Iniciando próximo download na fila', 'info');
    }
    // Mantém estado minimizado se já estava
    _downloadActive = true;
    _downloadCancelledFlag = false;
    _downloadLastSample = null;
    _downloadSpeedBps = null;
    _etaLastUpdateAt = 0;
    if (_downloadMinimized) {
        if (progressModal) progressModal.classList.remove('active');
        if (downloadMini) downloadMini.classList.add('active');
    } else {
        showProgressModal();
    }
    resetProgressUI();
    if (progressFileName) progressFileName.textContent = next && next.fileName ? next.fileName : '';
    // Executar tarefa
    window.electronAPI.downloadFile(next.fileKey, next.fileName, next.savePath)
        .then(result => {
            if (result && result.success) {
                showNotification(`Arquivo baixado: ${result.path}`, 'success');
            } else if (result) {
                const msg = (result.error || result.message || '').toString().toLowerCase();
                const isCancel = msg.includes('cancel') || msg.includes('cancelado') || msg.includes('canceled');
                if (!isCancel) {
                    showNotification(`Erro no download: ${result.error || result.message}`, 'error');
                }
            }
        })
        .catch(error => {
            console.error('Erro no download:', error);
            const emsg = (error && error.message ? error.message : '').toString().toLowerCase();
            const isCancel = emsg.includes('cancel') || emsg.includes('cancelado') || emsg.includes('canceled');
            if (!isCancel) {
                showNotification('Erro no download: ' + (error.message || 'Falha desconhecida'), 'error');
            }
        })
        .finally(() => {
            closeModals();
            _downloadActive = false;
            processNextFromQueue();
        });
}

// Mostrar modal de link
function showLinkModal(fileKey) {
    selectedFileKey = fileKey;
    linkResult.classList.remove('active');
    generatedLink.value = '';
    if (linkCustom) {
        linkCustom.classList.remove('active');
        linkCustom.setAttribute('aria-hidden', 'true');
        if (customExpiryValue) customExpiryValue.value = '1';
        if (customExpiryUnit) customExpiryUnit.value = 'hours';
    }
    linkModal.classList.add('active');
}

// Gerar link do arquivo (expiração em segundos)
async function generateLink(expirySeconds = 3600) {
    if (!selectedFileKey) return;

    try {
        const url = await window.electronAPI.generateSignedLink(selectedFileKey, expirySeconds);
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
    _downloadMinimized = false;
    if (downloadMini) downloadMini.classList.remove('active');
    progressModal.classList.add('active');
    // Aba da fila fechada por padrão ao mostrar o modal de progresso
    if (modalQueueWrap) {
        modalQueueWrap.classList.remove('active');
        if (queuePopoverToggle) {
            queuePopoverToggle.setAttribute('aria-expanded', 'false');
            const icon = queuePopoverToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }
    }
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
    if (downloadMini) downloadMini.classList.remove('active');
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

// Preferências e Tema
async function initSettings() {
    try {
        if (!window.electronAPI || typeof window.electronAPI.loadPreferences !== 'function') {
            const savedTheme = localStorage.getItem('wasabi-viewer-theme');
            if (savedTheme) appPreferences.theme = savedTheme;
        } else {
            const res = await window.electronAPI.loadPreferences();
            if (res && res.success && res.preferences) {
                appPreferences = Object.assign({}, appPreferences, res.preferences);
            } else {
                const savedTheme = localStorage.getItem('wasabi-viewer-theme');
                if (savedTheme) appPreferences.theme = savedTheme;
            }
        }
    } catch (e) {
        console.error('Erro ao carregar preferências:', e);
        const savedTheme = localStorage.getItem('wasabi-viewer-theme');
        if (savedTheme) appPreferences.theme = savedTheme;
    }
    // aplicar UI
    if (prefUseDefaultDownload) {
        prefUseDefaultDownload.checked = !!appPreferences.useDefaultDownloadDir;
    }
    if (prefDefaultDownloadPath) {
        prefDefaultDownloadPath.textContent = appPreferences.defaultDownloadDir || 'Nenhum diretório definido';
        // Validar diretório padrão carregado e avisar se inexistente/inválido
        try {
            if (appPreferences.useDefaultDownloadDir && appPreferences.defaultDownloadDir && window.electronAPI && typeof window.electronAPI.validateDir === 'function') {
                const v = await window.electronAPI.validateDir(appPreferences.defaultDownloadDir);
                const ok = !!(v && v.exists && v.isDirectory);
                if (!ok) {
                    showNotification('Diretório padrão de download não foi localizado. Selecione um novo local.', 'warning');
                    prefDefaultDownloadPath.textContent = 'Diretório não encontrado';
                }
            }
        } catch (verr) {
            console.error('Falha ao validar diretório padrão ao iniciar:', verr);
        }
    }
    setTheme(appPreferences.theme || 'light');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // sincronia do switch
    if (themeSwitch) themeSwitch.checked = theme === 'dark';
    // persistir no localStorage para compatibilidade
    try { localStorage.setItem('wasabi-viewer-theme', theme); } catch (_) {}
    // salvar preferências
    appPreferences.theme = theme;
    if (window.electronAPI && window.electronAPI.savePreferences) {
        window.electronAPI.savePreferences(appPreferences).catch(err => console.error('Erro salvando preferências:', err));
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
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
function showNotification(message, type = 'info', options = {}) {
    const notifications = document.getElementById('notifications');
    if (!notifications) return;

    const enqueue = (msg, tp, opts) => {
        _notifPending.push({ message: msg, type: tp, options: opts });
        flushQueue();
    };

    const createAndShow = ({ message: msg, type: tp, options: opts }) => {
        // Posicionamento opcional (centralizado)
        if (opts && opts.position === 'center') {
            notifications.classList.add('centered');
        } else {
            notifications.classList.remove('centered');
        }

        const el = document.createElement('div');
        el.className = `notification ${tp || 'info'}`;
        const icon = tp === 'success' ? 'fa-check-circle' : tp === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        el.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${msg}</span>
        `;
        notifications.appendChild(el);
        _notifActiveCount++;

        // Auto-fechamento após 5s
        setTimeout(() => {
            el.remove();
            _notifActiveCount = Math.max(0, _notifActiveCount - 1);
            // Se não há mais notificações ativas, remover centralização
            if (!_notifActiveCount) {
                notifications.classList.remove('centered');
            }
            flushQueue();
        }, 5000);
    };

    const flushQueue = () => {
        while (_notifActiveCount < 3 && _notifPending.length > 0) {
            const next = _notifPending.shift();
            createAndShow(next);
        }
    };

    enqueue(message, type, options);
}
