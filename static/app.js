// 全局状态
const state = {
    currentSession: null,
    isLoading: false
};

// API基础地址
const API_BASE_URL = '/api';

// DOM元素
const elements = {
    sessionList: document.querySelector('#sessionList'),
    newSessionBtn: document.querySelector('#newSessionBtn'),
    sessionName: document.querySelector('#sessionName'),
    themeInput: document.querySelector('#themeInput'),
    poetryTypeRadios: document.querySelectorAll('input[name="poetryType"]'),
    formSelect: document.querySelector('#formSelect'),
    generateBtn: document.querySelector('#generateBtn'),
    resultContainer: document.querySelector('#resultContainer'),
    themeBtn: document.querySelector('#themeBtn'),
    themeDropdown: document.querySelector('#themeDropdown')
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await init();
});

async function init() {
    // 绑定事件
    bindEventListeners();
    // 加载会话列表
    await loadSessionList();
    // 默认创建新会话
    if (!state.currentSession) {
        await createNewSession();
    }
    // 初始化主题
    initTheme();
}

// 事件绑定
function bindEventListeners() {
    // 新建会话
    elements.newSessionBtn.addEventListener('click', createNewSession);
    // 生成诗词
    elements.generateBtn.addEventListener('click', generatePoetry);
    // 回车生成
    elements.themeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !state.isLoading) {
            generatePoetry();
        }
    });
    // 诗词类型切换
    elements.poetryTypeRadios.forEach(radio => {
        radio.addEventListener('change', switchPoetryForm);
    });
    // 主题切换
    elements.themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.themeDropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => {
        elements.themeDropdown.classList.remove('show');
    });
    elements.themeDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const theme = e.target.closest('.theme-option')?.dataset.theme;
        if (theme) {
            setTheme(theme);
            elements.themeDropdown.classList.remove('show');
        }
    });
}

// 切换诗词体裁选项
function switchPoetryForm() {
    const selectedType = document.querySelector('input[name="poetryType"]:checked').value;
    const options = elements.formSelect.options;

    // 显示对应类型的选项
    for (let i = 0; i < options.length; i++) {
        const optgroup = options[i].parentNode.label;
        options[i].hidden = optgroup !== selectedType;
    }

    // 默认选中第一个可用选项
    for (let i = 0; i < options.length; i++) {
        if (!options[i].hidden) {
            elements.formSelect.selectedIndex = i;
            break;
        }
    }
}

// 主题切换
function initTheme() {
    const savedTheme = localStorage.getItem('poetry-theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.body.className = '';
    if (theme === 'dark') {
        document.body.classList.add('theme-dark');
    }
    localStorage.setItem('poetry-theme', theme);

    // 更新选中状态
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.theme === theme) {
            option.classList.add('active');
        }
    });
}

// 会话管理
async function loadSessionList() {
    try {
        const res = await fetch(`${API_BASE_URL}/sessions`);
        const data = await res.json();
        if (data.code === 200) {
            renderSessionList(data.data);
        }
    } catch (err) {
        console.error('加载会话失败:', err);
        alert('加载创作记录失败');
    }
}

function renderSessionList(sessions) {
    elements.sessionList.innerHTML = '';
    sessions.forEach(sessionId => {
        const item = document.createElement('div');
        item.className = 'session-item';
        item.innerHTML = `
            <button class="session-btn ${sessionId === state.currentSession ? 'btn-active' : ''}"
                    data-session="${sessionId}">
                ${sessionId}
            </button>
            <button class="btn btn-icon" data-delete="${sessionId}">❌</button>
        `;
        // 加载会话
        item.querySelector('[data-session]').addEventListener('click', () => {
            loadSession(sessionId);
        });
        // 删除会话
        item.querySelector('[data-delete]').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(sessionId);
        });
        elements.sessionList.appendChild(item);
    });
}

async function createNewSession() {
    try {
        const res = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.code === 200) {
            state.currentSession = data.data;
            elements.sessionName.textContent = `当前会话：${data.data}`;
            elements.resultContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <div class="empty-state-text">输入主题，生成专属古典诗词~</div>
                </div>
            `;
            await loadSessionList();
        }
    } catch (err) {
        console.error('创建会话失败:', err);
        alert('创建创作会话失败');
    }
}

async function loadSession(sessionId) {
    try {
        const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
        const data = await res.json();
        if (data.code === 200) {
            state.currentSession = sessionId;
            elements.sessionName.textContent = `当前会话：${sessionId}`;
            // 显示最后一条生成记录
            const records = data.data.records;
            if (records.length > 0) {
                renderPoetryResult(records[records.length - 1].content);
            } else {
                elements.resultContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📜</div>
                        <div class="empty-state-text">输入主题，生成专属古典诗词~</div>
                    </div>
                `;
            }
            await loadSessionList();
        }
    } catch (err) {
        console.error('加载会话失败:', err);
        alert('加载创作记录失败');
    }
}

async function deleteSession(sessionId) {
    if (!confirm(`确定删除会话 "${sessionId}" 吗？`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.code === 200) {
            if (sessionId === state.currentSession) {
                state.currentSession = null;
                elements.sessionName.textContent = '当前会话：未选择';
                elements.resultContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📜</div>
                        <div class="empty-state-text">输入主题，生成专属古典诗词~</div>
                    </div>
                `;
            }
            await loadSessionList();
            // 无会话时创建新的
            if (elements.sessionList.children.length === 0) {
                await createNewSession();
            }
        }
    } catch (err) {
        console.error('删除会话失败:', err);
        alert('删除创作记录失败');
    }
}

// 诗词生成
async function generatePoetry() {
    const theme = elements.themeInput.value.trim();
    if (!theme) {
        alert('请输入创作主题！');
        return;
    }
    if (state.isLoading) return;

    // 获取选中的类型和体裁
    const poetryType = document.querySelector('input[name="poetryType"]:checked').value;
    const form = elements.formSelect.value;

    // 显示加载状态
    state.isLoading = true;
    elements.generateBtn.disabled = true;
    elements.resultContainer.innerHTML = `
        <div class="loading">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <span>AI正在创作中...</span>
        </div>
    `;

    try {
        // 调用生成接口
        const res = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: state.currentSession,
                theme: theme,
                poetry_type: poetryType,
                form: form
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            renderPoetryResult(data.data);
        } else {
            throw new Error(data.message || '生成失败');
        }
    } catch (err) {
        console.error('生成诗词失败:', err);
        elements.resultContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-text">生成失败：${err.message}</div>
            </div>
        `;
    } finally {
        state.isLoading = false;
        elements.generateBtn.disabled = false;
    }
}

// 渲染诗词结果
function renderPoetryResult(content) {
    // 解析诗词内容（分离标题、内容、解析）
    let title = '';
    let poetry = '';
    let analysis = '';

    const lines = content.split('\n').filter(line => line.trim());
    lines.forEach(line => {
        if (line.startsWith('【标题】')) {
            title = line.replace('【标题】', '').trim();
        } else if (line.startsWith('【')) {
            // 宋词标题（如【江城子·中秋】）
            if (!title && line.includes('·')) {
                title = line.replace(/【|】/g, '').trim();
            }
            // 解析部分
            else if (line.startsWith('【解析】')) {
                analysis = line.replace('【解析】', '').trim();
            }
        } else if (line.trim() && !analysis) {
            poetry += line.trim() + '\n';
        }
    });

    // 渲染HTML
    elements.resultContainer.innerHTML = `
        <div class="poetry-result">
            <div class="poetry-title">${title || '无题'}</div>
            <div class="poetry-content">${poetry || content}</div>
            ${analysis ? `<div class="poetry-analysis">【解析】${analysis}</div>` : ''}
        </div>
    `;
}