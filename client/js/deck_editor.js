// --- DECK EDITOR: VISUAL CONSTRUCTOR (КОНСТРУКТОР КАРТ) ---
const DeckEditor = {
  currentDeck: null,
  decksList: [],
  currentBulkCategory: null,

  categoriesConfig: [
    { key: 'disasters', name: 'Катастрофы', icon: '🌋', type: 'complex', titlePlaceholder: 'Название катастрофы', descPlaceholder: 'Цель выживания / Срок изоляции' },
    { key: 'bunker', name: 'Условия Бункера (Бонусы)', icon: '🛡️', type: 'complex', titlePlaceholder: 'Название условия (например: Гидропонный сад)', descPlaceholder: 'Описание оборудования или полезных запасов' },
    { key: 'threats', name: 'Угрозы Бункера (Опасности)', icon: '⚠️', type: 'complex', titlePlaceholder: 'Название угрозы (например: Затопление)', descPlaceholder: 'Описание опасности или аварии' },
    { key: 'professions', name: 'Профессии', icon: '💼', type: 'simple', placeholder: 'Например: Врач-хирург (#Медицина[5], #Психика[2])' },
    { key: 'health', name: 'Здоровье', icon: '❤️', type: 'simple', placeholder: 'Например: Идеальное зрение (#Медицина[3])' },
    { key: 'biology', name: 'Биология', icon: '🧬', type: 'simple', placeholder: 'Например: Мужчина, 28 лет, атлетичен, фертилен' },
    { key: 'hobby', name: 'Хобби', icon: '🎨', type: 'simple', placeholder: 'Например: Пожарное дело (#Пожаротушение[3])' },
    { key: 'traits', name: 'Черты характера', icon: '🧠', type: 'simple', placeholder: 'Например: Хладнокровие (#Психика[4])' },
    { key: 'facts', name: 'Дополнительные сведения', icon: '📜', type: 'simple', placeholder: 'Например: Знает пароль от аварийного генератора' },
    { key: 'small_inventory', name: 'Малый инвентарь', icon: '🎒', type: 'simple', placeholder: 'Например: Огнетушитель углекислотный (#Пожаротушение[4])' },
    { key: 'large_inventory', name: 'Крупный инвентарь', icon: '📦', type: 'simple', placeholder: 'Например: Дизельный генератор на 5 кВт (#Инженерия[5])' },
    { key: 'special_cards', name: 'Спец-карты', icon: '⚡', type: 'special', placeholder: 'Например: «Право Вето»: Отмените изгнание в этом раунде' }
  ],

  specialActionOptions: [
    { value: 'custom', label: '💬 Свободный текст (без авто-действия)' },
    { value: 'bunker_cap_plus', label: '➕ Вместимость бункера +1' },
    { value: 'bunker_cap_minus', label: '➖ Вместимость бункера -1' },
    { value: 'exile_immunity', label: '🛡️ Право Вето / Иммунитет к изгнанию' },
    { value: 'discard_threat', label: '🧯 Ликвидация активной угрозы' },
    { value: 'force_reveal_other', label: '📢 Разоблачение (вскрыть карту соперника)' },
    { value: 'exchange_card', label: '🔀 Обмен картами с другим игроком' },
    { value: 'reroll_card', label: '🎲 Второй шанс (замена своей карты)' },
    { value: 'resurrect_exiled', label: '♻️ Возвращение изгнанного в бункер' }
  ],

  async init() {
    this.bindEvents();
    await this.fetchDecks();
  },

  async fetchDecks() {
    try {
      const res = await fetch('/api/decks');
      const data = await res.json();
      this.decksList = data.decks || [];
      this.renderSidebar();
      if (this.decksList.length > 0 && !this.currentDeck) {
        this.loadDeck(this.decksList[0].id);
      }
    } catch (e) {
      console.warn('Ошибка загрузки колод:', e);
    }
  },

  renderSidebar() {
    const list = document.getElementById('editor-decks-list');
    if (!list) return;
    list.innerHTML = this.decksList.map(deck => `
      <button class="editor-deck-btn ${this.currentDeck && this.currentDeck.id === deck.id ? 'active' : ''}" onclick="DeckEditor.loadDeck('${deck.id}')">
        <strong>${deck.name}</strong>
        <div style="font-size: 11px; color: var(--text-muted);">${deck.id}.json</div>
      </button>
    `).join('');
  },

  async loadDeck(deckId) {
    try {
      const res = await fetch(`/api/decks/${deckId}`);
      const data = await res.json();
      this.currentDeck = data.deck;
      this.renderConstructor();
      this.renderSidebar();
    } catch (e) {
      App.showToast(`Ошибка: ${e.message}`);
    }
  },

  renderConstructor() {
    const d = this.currentDeck || {};
    document.getElementById('edit-deck-id').value = d.id || '';
    document.getElementById('edit-deck-name').value = d.name || '';
    document.getElementById('edit-deck-author').value = d.author || '';
    document.getElementById('edit-deck-desc').value = d.description || '';
    document.getElementById('edit-deck-bg').value = d.backgroundImage || '';
    document.getElementById('edit-deck-card-back').value = d.cardBackImage || '';

    const container = document.getElementById('editor-categories-inputs');
    container.innerHTML = '';

    this.categoriesConfig.forEach(cat => {
      const box = document.createElement('div');
      box.className = 'constructor-category-box';
      box.setAttribute('data-cat-key', cat.key);

      let items = (d[cat.key] || d[cat.key + 's'] || []);
      // Handle legacy conditions if bunker/threats not explicitly filled
      if (cat.key === 'bunker' && items.length === 0 && Array.isArray(d.conditions)) {
        items = d.conditions.filter(c => !String(c.title || c).toLowerCase().includes('угроз'));
      } else if (cat.key === 'threats' && items.length === 0 && Array.isArray(d.conditions)) {
        items = d.conditions.filter(c => String(c.title || c).toLowerCase().includes('угроз'));
      }

      const count = Array.isArray(items) ? items.length : 0;

      box.innerHTML = `
        <div class="constructor-cat-header">
          <div class="constructor-cat-title">
            <span class="cat-icon">${cat.icon}</span>
            <span class="cat-name">${cat.name}</span>
            <span class="cat-count-badge" id="count-badge-${cat.key}">${count} шт.</span>
          </div>
          <div class="constructor-header-btn-group">
            <button type="button" class="btn btn-sm btn-outline btn-bulk-import" onclick="DeckEditor.openBulkModal('${cat.key}', '${cat.name}')">📋 Вставить списком</button>
            <button type="button" class="btn btn-sm btn-primary btn-add-card" onclick="DeckEditor.addItem('${cat.key}')">+ Добавить карту</button>
          </div>
        </div>
        <div class="constructor-items-list" id="items-list-${cat.key}"></div>
      `;

      container.appendChild(box);

      const itemsListContainer = box.querySelector(`#items-list-${cat.key}`);
      if (Array.isArray(items)) {
        items.forEach(item => {
          this.appendItemRow(itemsListContainer, cat, item);
        });
      }
    });

    this.updateLivePreview();
  },

  appendItemRow(container, catConfig, itemData = null) {
    const row = document.createElement('div');
    row.className = 'constructor-item-row';

    if (catConfig.type === 'complex') {
      let titleVal = '';
      let descVal = '';
      if (typeof itemData === 'string') {
        const parts = itemData.split('|');
        titleVal = (parts[0] || '').trim();
        descVal = (parts[1] || '').trim();
      } else if (itemData) {
        titleVal = itemData.title || '';
        descVal = itemData.goal || itemData.description || '';
      }

      row.innerHTML = `
        <div class="complex-inputs">
          <input type="text" class="form-input input-item-title" placeholder="${catConfig.titlePlaceholder}" value="${this.escapeHtml(titleVal)}" oninput="DeckEditor.onItemInput(this, '${catConfig.key}')">
          <input type="text" class="form-input input-item-desc" placeholder="${catConfig.descPlaceholder}" value="${this.escapeHtml(descVal)}" oninput="DeckEditor.onItemInput(this, '${catConfig.key}')">
        </div>
        <button type="button" class="btn-delete-item" title="Удалить карту" onclick="DeckEditor.deleteItem(this, '${catConfig.key}')">🗑️</button>
      `;
    } else if (catConfig.type === 'special') {
      let textVal = '';
      let actionVal = 'custom';
      if (typeof itemData === 'string') {
        textVal = itemData;
      } else if (itemData && typeof itemData === 'object') {
        textVal = itemData.text || itemData.title || '';
        actionVal = itemData.action || 'custom';
      }

      const actionsOptionsHtml = this.specialActionOptions.map(opt => `
        <option value="${opt.value}" ${opt.value === actionVal ? 'selected' : ''}>${opt.label}</option>
      `).join('');

      row.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
          <input type="text" class="form-input input-item-simple" placeholder="${catConfig.placeholder}" value="${this.escapeHtml(textVal)}" oninput="DeckEditor.onItemInput(this, '${catConfig.key}')">
          <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
            <span style="color: var(--accent-amber); font-weight: 700;">⚡ Действие:</span>
            <select class="form-input input-item-action" style="padding: 2px 6px; font-size: 11px; height: 26px;">
              ${actionsOptionsHtml}
            </select>
          </div>
        </div>
        <button type="button" class="btn-delete-item" title="Удалить карту" onclick="DeckEditor.deleteItem(this, '${catConfig.key}')">🗑️</button>
      `;
    } else {
      let textVal = typeof itemData === 'string' ? itemData : (itemData ? (itemData.text || itemData.name || JSON.stringify(itemData)) : '');

      row.innerHTML = `
        <input type="text" class="form-input input-item-simple" placeholder="${catConfig.placeholder}" value="${this.escapeHtml(textVal)}" oninput="DeckEditor.onItemInput(this, '${catConfig.key}')">
        <button type="button" class="btn-delete-item" title="Удалить карту" onclick="DeckEditor.deleteItem(this, '${catConfig.key}')">🗑️</button>
      `;
    }

    container.appendChild(row);
    this.updateCategoryCount(catConfig.key);
  },

  addItem(catKey) {
    const catConfig = this.categoriesConfig.find(c => c.key === catKey);
    if (!catConfig) return;

    const listContainer = document.getElementById(`items-list-${catKey}`);
    if (listContainer) {
      this.appendItemRow(listContainer, catConfig, '');
      const inputs = listContainer.querySelectorAll('input');
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
      App.playSound('click');
    }
  },

  deleteItem(btnElement, catKey) {
    const row = btnElement.closest('.constructor-item-row');
    if (row) {
      row.style.opacity = '0';
      row.style.transform = 'scale(0.95)';
      setTimeout(() => {
        row.remove();
        this.updateCategoryCount(catKey);
        this.updateLivePreview();
        App.playSound('click');
      }, 150);
    }
  },

  updateCategoryCount(catKey) {
    const listContainer = document.getElementById(`items-list-${catKey}`);
    const badge = document.getElementById(`count-badge-${catKey}`);
    if (listContainer && badge) {
      badge.textContent = `${listContainer.children.length} шт.`;
    }
  },

  onItemInput(inputElement, catKey) {
    this.updateLivePreview(catKey, inputElement.value);
  },

  // --- LIVE STATIC PREVIEW ---
  updateLivePreview(catKey = null, text = null) {
    const testInput = document.getElementById('prev-test-input');
    const rawText = text !== null ? text : (testInput ? testInput.value : 'Огнетушитель ОП-4 (#Пожаротушение[4])');
    const cat = this.categoriesConfig.find(c => c.key === (catKey || 'small_inventory')) || this.categoriesConfig[3];

    const parsed = TagHelper.parse(rawText);

    const prevIcon = document.getElementById('prev-cat-icon');
    const prevName = document.getElementById('prev-cat-name');
    const prevText = document.getElementById('prev-card-text');
    const prevTags = document.getElementById('prev-card-tags');
    const prevAuthor = document.getElementById('prev-card-author');
    const prevBack = document.getElementById('card-preview-back');

    if (prevIcon) prevIcon.textContent = cat.icon;
    if (prevName) prevName.textContent = cat.name;
    if (prevText) prevText.textContent = parsed.cleanText || '—';

    if (prevTags) {
      prevTags.innerHTML = TagHelper.renderTagsHtml(parsed.tags);
    }

    const authorInput = document.getElementById('edit-deck-author');
    const authorName = (authorInput && authorInput.value.trim()) || 'Бункер 3.1';
    if (prevAuthor) {
      prevAuthor.textContent = `✍️ Автор: ${authorName}`;
    }

    const backInput = document.getElementById('edit-deck-card-back');
    const backUrl = backInput ? backInput.value.trim() : '';
    if (prevBack) {
      if (backUrl) {
        prevBack.style.backgroundImage = `url('${backUrl}')`;
        prevBack.style.backgroundSize = 'cover';
        prevBack.style.backgroundPosition = 'center';
      } else {
        prevBack.style.backgroundImage = '';
      }
    }
  },

  // --- BULK IMPORT MODAL ---
  openBulkModal(catKey, catName) {
    this.currentBulkCategory = catKey;
    const modal = document.getElementById('modal-bulk-import');
    if (!modal) return;
    document.getElementById('bulk-modal-title').textContent = `📋 Вставка списка карт: ${catName}`;
    document.getElementById('bulk-import-textarea').value = '';
    modal.classList.remove('hidden');
    document.getElementById('bulk-import-textarea').focus();
    App.playSound('click');
  },

  insertBulkTag(tagStr) {
    const textarea = document.getElementById('bulk-import-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + ' ' + tagStr + val.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + tagStr.length + 1;
  },

  applyBulkImport() {
    if (!this.currentBulkCategory) return;
    const textarea = document.getElementById('bulk-import-textarea');
    const rawVal = textarea ? textarea.value : '';
    const lines = rawVal.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length === 0) {
      App.showToast('⚠️ Введите хотя бы одну строку!');
      return;
    }

    const catConfig = this.categoriesConfig.find(c => c.key === this.currentBulkCategory);
    const listContainer = document.getElementById(`items-list-${this.currentBulkCategory}`);
    if (catConfig && listContainer) {
      lines.forEach(line => {
        this.appendItemRow(listContainer, catConfig, line);
      });
      document.getElementById('modal-bulk-import').classList.add('hidden');
      App.showToast(`✅ Добавлено ${lines.length} карт в категорию "${catConfig.name}"!`);
      App.playSound('start');
      this.updateLivePreview(this.currentBulkCategory, lines[lines.length - 1]);
    }
  },

  // --- PRESETS FOR BACKGROUND & CARD BACK ---
  setBgPreset(type) {
    const input = document.getElementById('edit-deck-bg');
    if (!input) return;
    const presets = {
      bunker: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=1200&q=80',
      ruins: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      space: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
      none: ''
    };
    input.value = presets[type] !== undefined ? presets[type] : '';
    App.showToast('Пресет фона стола установлен!');
    App.playSound('click');
  },

  setBackPreset(type) {
    const input = document.getElementById('edit-deck-card-back');
    if (!input) return;
    const presets = {
      vault: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=80',
      biohazard: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=80',
      cyber: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80',
      none: ''
    };
    input.value = presets[type] !== undefined ? presets[type] : '';
    this.updateLivePreview();
    App.showToast('Пресет рубашки карт установлен!');
    App.playSound('click');
  },

  // --- EXPORT & IMPORT JSON ---
  exportCurrentDeckJson() {
    try {
      const payload = this.gatherDeckData();
      const str = JSON.stringify(payload, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${payload.id || 'deck'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.showToast(`📥 Файл "${payload.id}.json" успешно скачан!`);
      App.playSound('start');
    } catch (e) {
      App.showToast(`Ошибка экспорта: ${e.message}`);
    }
  },

  importDeckFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !data.id) {
          throw new Error('В файле отсутствует обязательное поле "id"!');
        }
        this.currentDeck = data;
        this.renderConstructor();
        App.showToast(`📤 Тема "${data.name || data.id}" успешно загружена из файла!`);
        App.playSound('start');
      } catch (err) {
        App.showToast(`❌ Ошибка импорта: ${err.message}`);
      }
    };
    reader.readAsText(file);
  },

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  gatherDeckData() {
    const id = document.getElementById('edit-deck-id').value.trim();
    const name = document.getElementById('edit-deck-name').value.trim();
    const author = document.getElementById('edit-deck-author').value.trim();
    const desc = document.getElementById('edit-deck-desc').value.trim();
    const bg = document.getElementById('edit-deck-bg').value.trim();
    const back = document.getElementById('edit-deck-card-back').value.trim();

    if (!id || !name) {
      throw new Error('Укажите ID и название темы!');
    }

    const payload = {
      id,
      name,
      author: author || 'Бункер 3.1',
      description: desc,
      backgroundImage: bg || null,
      cardBackImage: back || null
    };

    this.categoriesConfig.forEach(cat => {
      const listContainer = document.getElementById(`items-list-${cat.key}`);
      if (!listContainer) return;

      if (cat.type === 'complex') {
        const rows = listContainer.querySelectorAll('.constructor-item-row');
        payload[cat.key] = [];
        rows.forEach(r => {
          const title = (r.querySelector('.input-item-title')?.value || '').trim();
          const description = (r.querySelector('.input-item-desc')?.value || '').trim();
          if (title || description) {
            if (cat.key === 'disasters') {
              payload.disasters.push({ title: title || 'Катастрофа', goal: description || 'Выжить' });
            } else if (cat.key === 'threats') {
              payload.threats.push({ title: title || 'Угроза бункера', description: description || '' });
            } else {
              payload.bunker.push({ title: title || 'Условие бункера', description: description || '' });
            }
          }
        });
      } else if (cat.type === 'special') {
        const rows = listContainer.querySelectorAll('.constructor-item-row');
        payload[cat.key] = [];
        rows.forEach(r => {
          const val = (r.querySelector('.input-item-simple')?.value || '').trim();
          const action = (r.querySelector('.input-item-action')?.value || 'custom').trim();
          if (val) {
            payload[cat.key].push({
              text: val,
              action: action !== 'custom' ? action : null
            });
          }
        });
      } else {
        const inputs = listContainer.querySelectorAll('.input-item-simple');
        payload[cat.key] = [];
        inputs.forEach(inp => {
          const val = inp.value.trim();
          if (val) payload[cat.key].push(val);
        });
      }
    });

    return payload;
  },

  bindEvents() {
    // Back to Lobby
    document.getElementById('btn-editor-back').addEventListener('click', () => {
      App.showScreen('screen-lobby');
      Lobby.fetchDecks();
      App.playSound('click');
    });

    // Create New Theme
    document.getElementById('btn-editor-new').addEventListener('click', () => {
      this.currentDeck = {
        id: 'new_deck_' + Math.floor(Math.random() * 1000),
        name: 'Новый авторский набор',
        author: 'Мастер',
        description: 'Описание нового набора карт',
        backgroundImage: '',
        cardBackImage: '',
        disasters: [{ title: 'Новая катастрофа', goal: 'Выжить и перезапустить бункер' }],
        bunker: [{ title: 'Автономный генератор', description: 'Обеспечивает бункер светом (#Инженерия[4])' }],
        threats: [{ title: 'Задымление вентиляции', description: 'Требуется тушение (#Пожаротушение[4])' }],
        professions: ['Инженер-электрик (#Инженерия[5])', 'Врач-хирург (#Медицина[5])', 'Пожарный спасатель (#Пожаротушение[4])'],
        health: ['Идеальное здоровье (#Медицина[3])'],
        biology: ['Мужчина, 28 лет, атлетичен'],
        hobby: ['Кулинария и заготовки (#Еда[3])'],
        traits: ['Хладнокровие (#Психика[4])'],
        facts: ['Знает пароль от оружейной'],
        small_inventory: ['Огнетушитель углекислотный (#Пожаротушение[4])', 'Аптечка первой помощи (#Медицина[3])'],
        large_inventory: ['Дизельный генератор на 5 кВт (#Инженерия[5])', 'Ящик армейских пайков (#Еда[5])'],
        special_cards: [
          { text: '«Право Вето»: Отмените изгнание в этом раунде', action: 'exile_immunity' },
          { text: '«Расширение убежища»: Добавьте +1 место в бункер', action: 'bunker_cap_plus' }
        ]
      };
      this.renderConstructor();
      App.playSound('click');
    });

    // Save Deck
    document.getElementById('btn-editor-save').addEventListener('click', async () => {
      try {
        const payload = this.gatherDeckData();
        const res = await fetch('/api/decks/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');

        App.showToast(`💾 Набор "${payload.name}" успешно сохранен!`);
        App.playSound('start');
        await this.fetchDecks();
      } catch (err) {
        App.showToast(`❌ ${err.message}`);
      }
    });

    // Delete Deck
    document.getElementById('btn-editor-delete').addEventListener('click', async () => {
      if (!this.currentDeck || !this.currentDeck.id) return;
      if (!confirm(`Удалить набор карт "${this.currentDeck.name}"?`)) return;

      try {
        await fetch('/api/decks/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: this.currentDeck.id })
        });
        App.showToast('🗑️ Набор удален');
        this.currentDeck = null;
        await this.fetchDecks();
      } catch (e) {
        App.showToast(`Ошибка: ${e.message}`);
      }
    });

    // Export JSON
    const btnExport = document.getElementById('btn-editor-export-json');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        this.exportCurrentDeckJson();
      });
    }

    // Import JSON
    const btnImport = document.getElementById('btn-editor-import-json');
    const inputImport = document.getElementById('input-editor-file');
    if (btnImport && inputImport) {
      btnImport.addEventListener('click', () => {
        inputImport.value = '';
        inputImport.click();
      });
      inputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.importDeckFromFile(file);
      });
    }

    // Bulk Modal buttons
    const btnCloseBulk = document.getElementById('btn-close-bulk-modal');
    if (btnCloseBulk) {
      btnCloseBulk.addEventListener('click', () => {
        document.getElementById('modal-bulk-import').classList.add('hidden');
      });
    }
    const btnCancelBulk = document.getElementById('btn-cancel-bulk-modal');
    if (btnCancelBulk) {
      btnCancelBulk.addEventListener('click', () => {
        document.getElementById('modal-bulk-import').classList.add('hidden');
      });
    }
    const btnApplyBulk = document.getElementById('btn-apply-bulk-import');
    if (btnApplyBulk) {
      btnApplyBulk.addEventListener('click', () => {
        this.applyBulkImport();
      });
    }

    // Test input for Live Preview
    const testInput = document.getElementById('prev-test-input');
    if (testInput) {
      testInput.addEventListener('input', (e) => {
        this.updateLivePreview(null, e.target.value);
      });
    }

    const authorInput = document.getElementById('edit-deck-author');
    if (authorInput) {
      authorInput.addEventListener('input', () => {
        this.updateLivePreview();
      });
    }

    const cardBackInput = document.getElementById('edit-deck-card-back');
    if (cardBackInput) {
      cardBackInput.addEventListener('input', () => {
        this.updateLivePreview();
      });
    }
  }
};
