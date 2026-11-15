
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const STORAGE = {
    key: 'akira_tokenwave_key',
    chats: 'akira_chats_v1',
    current: 'akira_current_chat',
    model: 'akira_selected_model',
    level: 'akira_reasoning_level'
  };

  const state = {
    apiKey: localStorage.getItem(STORAGE.key) || '',
    models: [],
    selectedModel: localStorage.getItem(STORAGE.model) || '',
    level: Number(localStorage.getItem(STORAGE.level) ?? 3),
    chats: loadChats(),
    currentChatId: localStorage.getItem(STORAGE.current) || null,
    generating: false,
    abortController: null,
    attachments: [],
    toastTimer: null
  };

  const levels = [
    'Минимальный',
    'Низкий',
    'Умеренный',
    'Стандартный',
    'Повышенный',
    'Высокий',
    'Максимальный',
    'Экстра'
  ];

  function loadChats() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE.chats) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveChats() {
    localStorage.setItem(STORAGE.chats, JSON.stringify(state.chats));
  }

  function getCurrentChat() {
    return state.chats.find(chat => chat.id === state.currentChatId) || null;
  }

  function createChat() {
    const chat = {
      id: crypto.randomUUID(),
      title: 'Новый диалог',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    state.chats.unshift(chat);
    state.currentChatId = chat.id;

    localStorage.setItem(STORAGE.current, chat.id);
    saveChats();
    renderHistory();
    renderMessages();

    return chat;
  }

  function ensureChat() {
    return getCurrentChat() || createChat();
  }

  function updateChatTitle(chat) {
    const firstUserMessage = chat.messages.find(message => message.role === 'user');
    if (!firstUserMessage) return;

    chat.title = firstUserMessage.content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 42) || 'Новый диалог';
  }

  function toast(message) {
    const element = $('#toast');
    if (!element) return;

    element.textContent = message;
    element.classList.add('show');

    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      element.classList.remove('show');
    }, 3000);
  }

  function setConnectionStatus(connected, label = '') {
    const dot = $('#connectionDot');
    const connectionLabel = $('#connectionLabel');
    const status = $('#connectionStatus');

    if (dot) {
      dot.style.background = connected ? '#64dfa6' : '#e0a65b';
      dot.style.boxShadow = connected
        ? '0 0 10px rgba(100,223,166,.6)'
        : '0 0 9px rgba(224,166,91,.5)';
    }

    if (connectionLabel) {
      connectionLabel.textContent = connected
        ? 'Подключено'
        : label || 'Не подключено';
    }

    if (status) {
      status.textContent = connected ? 'ONLINE' : 'OFFLINE';
      status.style.color = connected ? '#75dca9' : '#777f9a';
    }
  }

  function openConnectModal() {
    const modal = $('#connectModal');
    if (!modal) return;

    $('#connectError').textContent = '';
    $('#apiKeyInput').value = state.apiKey;

    if (!modal.open) modal.showModal();
  }

  function closeConnectModal() {
    const modal = $('#connectModal');
    if (modal?.open) modal.close();
  }

  function openSettings() {
    $('#settingsModelName').textContent =
      state.selectedModel || 'Не выбрана';

    const modal = $('#settingsModal');
    if (modal && !modal.open) modal.showModal();
  }

  function closeSettings() {
    const modal = $('#settingsModal');
    if (modal?.open) modal.close();
  }

  function setModelDropdown(open) {
    const dropdown = $('#modelDropdown');
    const button = $('#modelPicker');

    if (!dropdown || !button) return;

    dropdown.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function setReasoningDropdown(open) {
    const dropdown = $('#reasoningDropdown');
    const button = $('#reasoningButton');

    if (!dropdown || !button) return;

    dropdown.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function updateSelectedModel() {
    $('#selectedModel').textContent =
      state.selectedModel || 'Выбрать модель';

    $('#sidebarModel').textContent =
      state.selectedModel || 'Модель не выбрана';

    $('#settingsModelName').textContent =
      state.selectedModel || 'Не выбрана';

    $('#sendButton').disabled =
      !$('#promptInput').value.trim() ||
      !state.selectedModel ||
      state.generating;
  }

  function selectModel(modelId) {
    state.selectedModel = modelId;
    localStorage.setItem(STORAGE.model, modelId);

    updateSelectedModel();
    setModelDropdown(false);

    toast(`Выбрана модель: ${modelId}`);
  }

  function normalizeModels(payload) {
    let models = [];

    if (Array.isArray(payload)) {
      models = payload;
    } else if (Array.isArray(payload?.data)) {
      models = payload.data;
    } else if (Array.isArray(payload?.models)) {
      models = payload.models;
    }

    return models
      .map(item => {
        if (typeof item === 'string') {
          return { id: item, name: item };
        }

        if (!item || typeof item !== 'object') return null;

        const id = item.id || item.name || item.model;

        if (!id || typeof id !== 'string') return null;

        return {
          id,
          name: item.name || item.id || id,
          description: item.description || '',
          ownedBy: item.owned_by || item.provider || ''
        };
      })
      .filter(Boolean);
  }

  function renderModels(filter = '') {
    const container = $('#modelList');
    if (!container) return;

    const query = filter.trim().toLowerCase();

    const filtered = state.models.filter(model =>
      `${model.id} ${model.name} ${model.description} ${model.ownedBy}`
        .toLowerCase()
        .includes(query)
    );

    container.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-empty';
      empty.textContent = state.models.length
        ? 'Ничего не найдено'
        : 'Сначала подключи TokenWave';

      container.append(empty);
      return;
    }

    filtered.forEach(model => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'model-option';
      button.style.cssText = `
        display:flex;
        align-items:center;
        gap:11px;
        width:100%;
        padding:12px 10px;
        border:1px solid transparent;
        border-radius:10px;
        background:${model.id === state.selectedModel ? 'rgba(126,119,255,.13)' : 'transparent'};
        color:#e1e5f7;
        text-align:left;
        cursor:pointer;
      `;

      const orb = document.createElement('span');
      orb.textContent = '✳';
      orb.style.cssText = `
        display:grid;
        place-items:center;
        flex:0 0 30px;
        width:30px;
        height:30px;
        border-radius:9px;
        background:rgba(130,123,255,.16);
        color:#b6aaff;
      `;

      const info = document.createElement('span');
      info.style.cssText = 'display:flex;flex:1;flex-direction:column;gap:4px;min-width:0;';

      const name = document.createElement('strong');
      name.textContent = model.name;
      name.style.cssText = 'font-size:12px;font-weight:600;overflow-wrap:anywhere;';

      const detail = document.createElement('small');
      detail.textContent = model.ownedBy || model.id;
      detail.style.cssText = 'font-size:10px;color:#808aa6;overflow-wrap:anywhere;';

      info.append(name, detail);

      const selected = document.createElement('span');
      selected.textContent = model.id === state.selectedModel ? '✓' : '';
      selected.style.color = '#a99cff';

      button.append(orb, info, selected);

      button.addEventListener('click', () => {
        selectModel(model.id);
      });

      button.addEventListener('mouseenter', () => {
        button.style.borderColor = 'rgba(145,150,255,.2)';
        button.style.background = 'rgba(130,130,255,.09)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.borderColor = 'transparent';
        button.style.background =
          model.id === state.selectedModel
            ? 'rgba(126,119,255,.13)'
            : 'transparent';
      });

      container.append(button);
    });
  }

  async function loadModels() {
    if (!state.apiKey) {
      openConnectModal();
      return;
    }

    const container = $('#modelList');
    container.textContent = 'Загрузка моделей…';

    try {
      const response = await fetch('/api/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${state.apiKey}`
        },
        cache: 'no-store'
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || payload.message || `Ошибка API: ${response.status}`
        );
      }

      state.models = normalizeModels(payload);

      if (!state.models.length) {
        throw new Error('TokenWave не вернул список моделей.');
      }

      if (
        state.selectedModel &&
        !state.models.some(model => model.id === state.selectedModel)
      ) {
        state.selectedModel = '';
        localStorage.removeItem(STORAGE.model);
      }

      if (!state.selectedModel) {
        const preferred = state.models.find(model =>
          /gpt|claude|qwen/i.test(model.id)
        );
        if (preferred) {
          state.selectedModel = preferred.id;
          localStorage.setItem(STORAGE.model, preferred.id);
        }
      }

      renderModels($('#modelSearch').value);
      updateSelectedModel();
      setConnectionStatus(true);

      toast(`Загружено моделей: ${state.models.length}`);
    } catch (error) {
      state.models = [];
      renderModels();

      setConnectionStatus(false);

      $('#connectError').textContent = error.message;
      toast(`Не удалось загрузить модели: ${error.message}`);
    }
  }

  async function connectTokenWave(event) {
    event.preventDefault();

    const input = $('#apiKeyInput');
    const error = $('#connectError');
    const button = $('#connectButton');

    const key = input.value.trim();

    if (!key) {
      error.textContent = 'Введи API-ключ TokenWave.';
      return;
    }

    state.apiKey = key;
    button.disabled = true;
    button.querySelector('span:first-child').textContent = 'Проверка…';

    try {
      const response = await fetch('/api/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store'
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || payload.message || `Ошибка API: ${response.status}`
        );
      }

      const models = normalizeModels(payload);

      if (!models.length) {
        throw new Error('Список моделей пуст. Проверь доступ к TokenWave.');
      }

      state.models = models;
      localStorage.setItem(STORAGE.key, key);

      if (!state.selectedModel || !models.some(m => m.id === state.selectedModel)) {
        state.selectedModel = models[0].id;
        localStorage.setItem(STORAGE.model, state.selectedModel);
      }

      renderModels($('#modelSearch').value);
      updateSelectedModel();
      setConnectionStatus(true);

      closeConnectModal();
      toast('TokenWave успешно подключён.');
    } catch (err) {
      state.apiKey = '';
      error.textContent = err.message;
      setConnectionStatus(false);
    } finally {
      button.disabled = false;
      button.querySelector('span:first-child').textContent = 'Подключить AKIRA';
    }
  }

  function setReasoningLevel(level) {
    const value = Number(level);

    if (!Number.isInteger(value) || value < 0 || value > 7) return;

    state.level = value;
    localStorage.setItem(STORAGE.level, String(value));

    $('#reasoningLabel').textContent = levels[value];

    document.querySelectorAll('[data-level]').forEach(button => {
      button.classList.toggle(
        'selected',
        Number(button.dataset.level) === value
      );
    });

    setReasoningDropdown(false);
  }

  function createMessageElement(message) {
    const wrapper = document.createElement('article');
    wrapper.className = `message ${message.role}`;

    if (message.role === 'assistant') {
      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.textContent = 'A';

      const content = document.createElement('div');
      content.className = 'message-content';

      const role = document.createElement('div');
      role.className = 'message-role';
      role.textContent = 'AKIRA';

      const text = document.createElement('div');
      text.className = 'message-text';
      text.textContent = message.content || '';

      content.append(role, text);
      wrapper.append(avatar, content);

      return { wrapper, text };
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message.content || '';

    content.append(text);
    wrapper.append(content);

    return { wrapper, text };
  }

  function renderMessages() {
    const container = $('#messages');
    const welcome = $('#welcomeScreen');

    if (!container) return;

    container.replaceChildren();

    const chat = getCurrentChat();
    const messages = chat?.messages || [];

    if (welcome) {
      welcome.style.display = messages.length ? 'none' : '';
    }

    messages.forEach(message => {
      const element = createMessageElement(message);
      container.append(element.wrapper);
    });

    scrollToBottom();
  }

  function scrollToBottom() {
    const viewport = $('#chatViewport');
    if (!viewport) return;

    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
  }

  function renderHistory() {
    const container = $('#historyList');
    if (!container) return;

    container.replaceChildren();

    if (!state.chats.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'Твои диалоги появятся здесь';
      container.append(empty);
      return;
    }

    state.chats.forEach(chat => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'side-link';
      button.style.cssText = `
        min-height:38px;
        margin-top:2px;
        overflow:hidden;
        font-size:11px;
        white-space:nowrap;
        text-overflow:ellipsis;
        ${chat.id === state.currentChatId ? 'background:rgba(120,125,255,.12);color:#e3e6ff;' : ''}
      `;

      const icon = document.createElement('span');
      icon.textContent = '◷';
      icon.className = 'side-icon';

      const title = document.createElement('span');
      title.textContent = chat.title || 'Новый диалог';
      title.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

      button.append(icon, title);

      button.addEventListener('click', () => {
        if (state.generating) return;

        state.currentChatId = chat.id;
        localStorage.setItem(STORAGE.current, chat.id);

        renderHistory();
        renderMessages();
        closeSidebar();
      });

      container.append(button);
    });
  }

  function addMessage(role, content) {
    const chat = ensureChat();

    const message = {
      role,
      content,
      createdAt: Date.now()
    };

    chat.messages.push(message);
    chat.updatedAt = Date.now();

    if (role === 'user') updateChatTitle(chat);

    saveChats();
    renderHistory();

    const element = createMessageElement(message);
    $('#messages').append(element.wrapper);

    const welcome = $('#welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    scrollToBottom();

    return { message, element };
  }

  function addCodeBlock(parent, code, language) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      margin:12px 0;
      overflow:hidden;
      border:1px solid rgba(146,157,216,.18);
      border-radius:12px;
      background:#0b0e17;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:8px 12px;
      border-bottom:1px solid rgba(146,157,216,.12);
      color:#929bb5;
      font-size:10px;
    `;

    const label = document.createElement('span');
    label.textContent = language || 'CODE';

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Копировать';
    copy.style.cssText = `
      border:0;
      background:transparent;
      color:#aaa2ff;
      font-size:10px;
      cursor:pointer;
    `;

    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = 'Скопировано ✓';
        setTimeout(() => copy.textContent = 'Копировать', 1500);
      } catch {
        toast('Не удалось скопировать код.');
      }
    });

    const pre = document.createElement('pre');
    pre.style.cssText = 'overflow:auto;margin:0;padding:14px;color:#dce2f8;';

    const codeElement = document.createElement('code');
    codeElement.textContent = code;

    pre.append(codeElement);
    header.append(label, copy);
    wrapper.append(header, pre);
    parent.append(wrapper);
  }

  function renderAssistantText(element, value) {
    element.replaceChildren();

    const parts = value.split(/```/);

    parts.forEach((part, index) => {
      if (index % 2 === 1) {
        const newline = part.indexOf('\n');
        const language = newline >= 0 ? part.slice(0, newline).trim() : '';
        const code = newline >= 0 ? part.slice(newline + 1) : part;

        addCodeBlock(element, code, language);
      } else if (part) {
        const paragraph = document.createElement('div');
        paragraph.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;';
        paragraph.textContent = part;
        element.append(paragraph);
      }
    });
  }

  function setGenerating(value) {
    state.generating = value;

    const button = $('#sendButton');
    const icon = $('#sendIcon');

    if (button) {
      button.disabled = value || !$('#promptInput').value.trim() || !state.selectedModel;
      button.title = value ? 'Остановить генерацию' : 'Отправить сообщение';
    }

    if (icon) icon.textContent = value ? '■' : '↑';
  }

  async function sendMessage() {
    if (state.generating) {
      state.abortController?.abort();
      return;
    }

    const input = $('#promptInput');
    const prompt = input.value.trim();

    if (!prompt) return;

    if (!state.apiKey) {
      openConnectModal();
      return;
    }

    if (!state.selectedModel) {
      toast('Сначала выбери модель.');
      setModelDropdown(true);
      return;
    }

    const attachmentText = state.attachments
      .filter(item => item.text)
      .map(item => `\n\n[Файл: ${item.name}]\n${item.text}`)
      .join('');

    const finalPrompt = prompt + attachmentText;

    const chat = ensureChat();

    addMessage('user', finalPrompt);

    input.value = '';
    autoResizeInput();
    updateSelectedModel();

    state.attachments = [];
    renderAttachments();

    const assistant = addMessage('assistant', '');
    const assistantMessage = assistant.message;
    const assistantText = assistant.element.text;

    setGenerating(true);
    state.abortController = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({
          model: state.selectedModel,
          messages: chat.messages
            .filter(message => message.role === 'user' || message.role === 'assistant')
            .map(message => ({
              role: message.role,
              content: message.content
            })),
          level: state.level
        }),
        signal: state.abortController.signal
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(
          errorPayload.error ||
          errorPayload.message ||
          `Ошибка сервера: ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error('Сервер не вернул поток ответа.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      function handleSSELine(line) {
        const trimmed = line.trim();

        if (!trimmed.startsWith('data:')) return;

        const data = trimmed.slice(5).trim();

        if (!data || data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            throw new Error(parsed.error.message || parsed.error);
          }

          const delta =
            parsed.choices?.[0]?.delta?.content ??
            parsed.choices?.[0]?.message?.content ??
            parsed.delta?.text ??
            parsed.output_text ??
            '';

          if (typeof delta === 'string' && delta) {
            fullText += delta;
            assistantMessage.content = fullText;
            renderAssistantText(assistantText, fullText);
            scrollToBottom();
          }
        } catch (error) {
          if (error instanceof SyntaxError) return;
          throw error;
        }
      }

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          handleSSELine(line);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        handleSSELine(buffer);
      }

      if (!fullText.trim()) {
        assistantMessage.content = 'Модель завершила ответ без текстового содержимого.';
        assistantText.textContent = assistantMessage.content;
      }

      chat.updatedAt = Date.now();
      saveChats();
      renderHistory();
    } catch (error) {
      if (error.name === 'AbortError') {
        assistantMessage.content += '\n\n[Генерация остановлена]';
      } else {
        assistantMessage.content =
          assistantMessage.content
            ? assistantMessage.content + `\n\nОшибка: ${error.message}`
            : `Ошибка: ${error.message}`;

        toast(error.message);
      }

      renderAssistantText(assistantText, assistantMessage.content);
      saveChats();
    } finally {
      state.abortController = null;
      setGenerating(false);
      updateSelectedModel();
    }
  }

  function autoResizeInput() {
    const input = $('#promptInput');
    if (!input) return;

    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 190)}px`;

    updateSelectedModel();
  }

  function renderAttachments() {
    const preview = $('#attachmentPreview');
    if (!preview) return;

    preview.replaceChildren();
    preview.hidden = state.attachments.length === 0;

    state.attachments.forEach((file, index) => {
      const item = document.createElement('span');
      item.style.cssText = `
        display:inline-flex;
        align-items:center;
        gap:7px;
        margin:3px 7px 3px 0;
        padding:7px 9px;
        border:1px solid rgba(146,157,216,.16);
        border-radius:8px;
        background:rgba(255,255,255,.04);
      `;

      const name = document.createElement('span');
      name.textContent = file.name;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.style.cssText = 'border:0;background:transparent;color:#ff9ba8;cursor:pointer;';

      remove.addEventListener('click', () => {
        state.attachments.splice(index, 1);
        renderAttachments();
      });

      item.append(name, remove);
      preview.append(item);
    });
  }

  async function handleFiles(files) {
    const maxSize = 2 * 1024 * 1024;
    const allowedText = /\.(txt|md|json|csv|js|ts|html|css|py|log|xml|yaml|yml)$/i;

    for (const file of files) {
      if (file.size > maxSize) {
        toast(`${file.name}: файл больше 2 МБ.`);
        continue;
      }

      if (!allowedText.test(file.name)) {
        toast(`${file.name}: пока поддерживаются текстовые файлы.`);
        continue;
      }

      try {
        const text = await file.text();

        state.attachments.push({
          name: file.name,
          text
        });
      } catch {
        toast(`Не удалось прочитать ${file.name}.`);
      }
    }

    renderAttachments();
  }

  function openSidebar() {
    $('#sidebar')?.classList.add('open');
    $('#sidebarBackdrop')?.classList.add('show');
  }

  function closeSidebar() {
    $('#sidebar')?.classList.remove('open');
    $('#sidebarBackdrop')?.classList.remove('show');
  }

  function newConversation() {
    if (state.generating) {
      state.abortController?.abort();
    }

    createChat();
    closeSidebar();
    $('#promptInput').focus();
  }

  function clearHistory() {
    if (!state.chats.length) {
      toast('История уже пуста.');
      return;
    }

    if (!confirm('Удалить все сохранённые диалоги?')) return;

    state.chats = [];
    state.currentChatId = null;

    saveChats();
    localStorage.removeItem(STORAGE.current);

    createChat();
    renderHistory();
    renderMessages();

    toast('История очищена.');
  }

  function manageConnection() {
    closeSettings();
    openConnectModal();
  }

  function deleteAllChats() {
    if (!confirm('Точно удалить всю историю диалогов?')) return;

    state.chats = [];
    state.currentChatId = null;

    saveChats();
    localStorage.removeItem(STORAGE.current);

    createChat();
    renderHistory();
    renderMessages();

    closeSettings();
    toast('История удалена.');
  }

  function initVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast('Голосовой ввод не поддерживается этим браузером.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = false;

    const button = $('#voiceButton');

    recognition.onstart = () => {
      button.style.color = '#ff8eae';
      toast('Слушаю…');
    };

    recognition.onend = () => {
      button.style.color = '';
    };

    recognition.onerror = () => {
      toast('Не удалось распознать речь.');
    };

    recognition.onresult = event => {
      let result = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        result += event.results[i][0].transcript;
      }

      $('#promptInput').value = result;
      autoResizeInput();
    };

    try {
      recognition.start();
    } catch {
      toast('Не удалось запустить голосовой ввод.');
    }
  }

  function bindEvents() {
    $('#connectForm').addEventListener('submit', connectTokenWave);

    $('#toggleKeyVisibility').addEventListener('click', () => {
      const input = $('#apiKeyInput');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    $('#modelPicker').addEventListener('click', () => {
      const open = $('#modelDropdown').hidden;
      setModelDropdown(open);

      if (open && !state.models.length) {
        loadModels();
      }
    });

    $('#refreshModels').addEventListener('click', loadModels);

    $('#modelSearch').addEventListener('input', event => {
      renderModels(event.target.value);
    });

    $('#reasoningButton').addEventListener('click', () => {
      setReasoningDropdown($('#reasoningDropdown').hidden);
    });

    $('#reasoningOptions').addEventListener('click', event => {
      const button = event.target.closest('[data-level]');
      if (button) setReasoningLevel(button.dataset.level);
    });

    $('#promptInput').addEventListener('input', autoResizeInput);

    $('#promptInput').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        sendMessage();
      }
    });

    $('#sendButton').addEventListener('click', sendMessage);

    $('#newChat').addEventListener('click', newConversation);

    $('#clearHistory').addEventListener('click', clearHistory);

    $('#attachButton').addEventListener('click', () => {
      $('#fileInput').click();
    });

    $('#fileInput').addEventListener('change', event => {
      handleFiles(Array.from(event.target.files || []));
      event.target.value = '';
    });

    $('#voiceButton').addEventListener('click', initVoiceInput);

    $('#settingsButton').addEventListener('click', openSettings);
    $('#topSettings').addEventListener('click', openSettings);
    $('#closeSettings').addEventListener('click', closeSettings);

    $('#manageConnection').addEventListener('click', manageConnection);

    $('#settingsChooseModel').addEventListener('click', () => {
      closeSettings();
      setModelDropdown(true);

      if (!state.models.length) loadModels();
    });

    $('#deleteAllChats').addEventListener('click', deleteAllChats);

    $('#openSidebar').addEventListener('click', openSidebar);
    $('#closeSidebar').addEventListener('click', closeSidebar);
    $('#sidebarBackdrop').addEventListener('click', closeSidebar);

    $('#libraryNav').addEventListener('click', () => {
      toast('Библиотека появится в следующем обновлении.');
    });

    $('#chatNav').addEventListener('click', () => {
      closeSidebar();
      renderMessages();
    });

    $('#profileMenu').addEventListener('click', () => {
      toast('AKIRA Personal Workspace');
    });

    document.querySelectorAll('[data-prompt]').forEach(button => {
      button.addEventListener('click', () => {
        $('#promptInput').value = button.dataset.prompt;
        autoResizeInput();
        $('#promptInput').focus();
      });
    });

    document.addEventListener('click', event => {
      if (
        !event.target.closest('.model-picker-wrap') &&
        !event.target.closest('#modelDropdown')
      ) {
        setModelDropdown(false);
      }

      if (
        !event.target.closest('.reasoning-wrap') &&
        !event.target.closest('#reasoningDropdown')
      ) {
        setReasoningDropdown(false);
      }
    });

    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        newConversation();
      }

      if (event.key === 'Escape') {
        setModelDropdown(false);
        setReasoningDropdown(false);
        closeSidebar();
      }
    });
  }

  function init() {
    bindEvents();

    setReasoningLevel(
      Number.isInteger(state.level) && state.level >= 0 && state.level <= 7
        ? state.level
        : 3
    );

    if (!getCurrentChat()) {
      if (state.chats.length) {
        state.currentChatId = state.chats[0].id;
      } else {
        createChat();
      }
    }

    localStorage.setItem(STORAGE.current, state.currentChatId);

    renderHistory();
    renderMessages();
    updateSelectedModel();

    if (state.apiKey) {
      setConnectionStatus(false, 'Проверка подключения…');
      loadModels();
    } else {
      setConnectionStatus(false);
      openConnectModal();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
