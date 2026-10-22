// --- DECK EDITOR: VISUAL CONSTRUCTOR (КОНСТРУКТОР КАРТ) ---
const DeckEditor = {
  currentDeck: null,
  decksList: [],
  currentBulkCategory: null,

  DEFAULT_CATEGORIES_CONFIG: [
    { key: 'disasters', name: 'Катастрофы', icon: '🌋', type: 'complex', scope: 'world', titlePlaceholder: 'Название катастрофы', descPlaceholder: 'Цель выживания / Срок изоляции' },
    { key: 'bunker', name: 'Условия Бункера (Бонусы)', icon: '🛡️', type: 'complex', scope: 'world', titlePlaceholder: 'Название условия (например: Гидропонный сад)', descPlaceholder: 'Описание оборудования или полезных запасов' },
    { key: 'threats', name: 'Угрозы Бункера (Опасности)', icon: '⚠️', type: 'complex', scope: 'world', titlePlaceholder: 'Название угрозы (например: Затопление)', descPlaceholder: 'Описание опасности или аварии' },
    { key: 'professions', name: 'Профессии', icon: '💼', type: 'simple', scope: 'player', placeholder: 'Например: Врач-хирург (#Медицина[5], #Психика[2])' },
    { key: 'health', name: 'Здоровье', icon: '❤️', type: 'simple', scope: 'player', placeholder: 'Например: Идеальное зрение (#Медицина[3])' },
    { key: 'biology', name: 'Биология', icon: '🧬', type: 'simple', scope: 'player', placeholder: 'Например: Мужчина, 28 лет, атлетичен, фертилен' },
    { key: 'hobby', name: 'Хобби', icon: '🎨', type: 'simple', scope: 'player', placeholder: 'Например: Пожарное дело (#Пожаротушение[3])' },
    { key: 'traits', name: 'Черты характера', icon: '🧠', type: 'simple', scope: 'player', placeholder: 'Например: Хладнокровие (#Психика[4])' },
    { key: 'facts', name: 'Дополнительные сведения', icon: '📜', type: 'simple', scope: 'player', placeholder: 'Например: Знает пароль от аварийного генератора' },
    { key: 'small_inventory', name: 'Малый инвентарь', icon: '🎒', type: 'simple', scope: 'player', placeholder: 'Например: Огнетушитель углекислотный (#Пожаротушение[4])' },
    { key: 'large_inventory', name: 'Крупный инвентарь', icon: '📦', type: 'simple', scope: 'player', placeholder: 'Например: Дизельный генератор на 5 кВт (#Инженерия[5])' },
    { key: 'special_cards', name: 'Спец-карты', icon: '⚡', type: 'special', scope: 'player', placeholder: 'Например: «Право Вето»: Отмените изгнание в этом раунде' }
  ],

  // 36 curated thematic survival / bunker emojis
  CURATED_EMOJIS: [
    '☣️', '☢️', '🌋', '⚠️', '🔥', '🧯',
    '💊', '💉', '🩺', '🧬', '❤️', '🧠',
    '🍞', '🥫', '💧', '🥩', '🌾', '🍳',
    '⚙️', '🔧', '🔋', '⚡', '💻', '💡',
    '🛡️', '🗡️', '🔫', '🪓', '🪖', '🏹',
    '🎒', '📦', '📻', '🗝️', '🦾', '📜'
  ],

  setupEmojiPicker(gridId, targetInputId, defaultEmoji = '') {
    const grid = document.getElementById(gridId);
    const input = document.getElementById(targetInputId);
    if (!grid || !input) return;

    const currentVal = (input.value || defaultEmoji).trim();

    grid.innerHTML = this.CURATED_EMOJIS.map(em => `
      <button type="button" class="btn-emoji-pick ${currentVal === em ? 'selected' : ''}" data-emoji="${em}" title="Выбрать ${em}">
        ${em}
      </button>
    `).join('');

    grid.querySelectorAll('.btn-emoji-pick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const em = btn.getAttribute('data-emoji');
        input.value = em;
        grid.querySelectorAll('.btn-emoji-pick').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (typeof App !== 'undefined') App.playSound('click');
      });
    });

    input.oninput = () => {
      const val = input.value.trim();
      grid.querySelectorAll('.btn-emoji-pick').forEach(b => {
        b.classList.toggle('selected', b.getAttribute('data-emoji') === val);
      });
    };
  },

  DEFAULT_EVALUATION_QUESTIONS: [
    {
      id: 'supplies',
      title: '1. Припасы и чистая вода:',
      linkedResource: 'food',
      options: [
        { score: 1, label: '1 — Припасов нет (голод и жажда)' },
        { score: 2, label: '2 — Не хватает на всех (острый дефицит)' },
        { score: 3, label: '3 — Хватает, если строго экономить' },
        { score: 4, label: '4 — В достатке на весь срок изоляции' },
        { score: 5, label: '5 — Больше, чем нужно (полные склады)' }
      ]
    },
    {
      id: 'medicine',
      title: '2. Медицинское обеспечение и здоровье:',
      linkedResource: 'medicine',
      options: [
        { score: 1, label: '1 — Тяжелые больные, лекарств нет' },
        { score: 2, label: '2 — Медикаментов мало, уход затруднен' },
        { score: 3, label: '3 — Базовые аптечки есть, среднее здоровье' },
        { score: 4, label: '4 — Хорошее здоровье, есть врач/лекарства' },
        { score: 5, label: '5 — Полный медблок и идеальное здоровье' }
      ]
    },
    {
      id: 'specialists',
      title: '3. Специалисты и навыки для восстановления мира:',
      linkedResource: 'engineering',
      options: [
        { score: 1, label: '1 — Нет нужных специалистов для катастрофы' },
        { score: 2, label: '2 — Навыки слабые, поддерживать бункер некому' },
        { score: 3, label: '3 — Есть базовые руки (механик/агроном/рабочий)' },
        { score: 4, label: '4 — Отличный баланс профессий под бункер' },
        { score: 5, label: '5 — Идеальный состав ученых, врачей и техников' }
      ]
    },
    {
      id: 'defense',
      title: '4. Защита бункера и нейтрализация угроз:',
      linkedResource: 'defense',
      options: [
        { score: 1, label: '1 — Бункер беззащитен, угрозы смертельны' },
        { score: 2, label: '2 — Защита слабая, высокий риск прорыва' },
        { score: 3, label: '3 — Базовые запоры и охрана, средний риск' },
        { score: 4, label: '4 — Надежные турели/оружие, угрозы под контролем' },
        { score: 5, label: '5 — Неприступная цитадель, полная безопасность' }
      ]
    },
    {
      id: 'psychology',
      title: '5. Психологический климат и совместимость:',
      linkedResource: 'psycho',
      options: [
        { score: 1, label: '1 — Ненависть и бунт, неизбежная резня' },
        { score: 2, label: '2 — Постоянные конфликты, депрессия и паника' },
        { score: 3, label: '3 — Напряженно, но держатся ради выживания' },
        { score: 4, label: '4 — Слаженная команда, высокая мораль' },
        { score: 5, label: '5 — Братство и единодушие, идеальный дух' }
      ]
    }
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

  activeCategories: [],
  customTags: [],
  evaluationQuestions: [],

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

    // 1. Prepare Active Categories
    this.activeCategories = [];

    // Always include World Categories (scope: 'world')
    const worldCats = this.DEFAULT_CATEGORIES_CONFIG.filter(c => c.scope === 'world');
    worldCats.forEach(wc => {
      this.activeCategories.push(JSON.parse(JSON.stringify(wc)));
    });

    // Player categories
    if (Array.isArray(d.playerCategories) && d.playerCategories.length > 0) {
      d.playerCategories.forEach(pc => {
        this.activeCategories.push({
          key: pc.key,
          name: pc.name,
          icon: pc.icon || '🏷️',
          type: pc.type || 'simple',
          placeholder: pc.placeholder || `Например: Карта категории ${pc.name}`,
          scope: 'player',
          isCustom: Boolean(pc.isCustom)
        });
      });
    } else {
      // Default player categories
      const defPlayerCats = this.DEFAULT_CATEGORIES_CONFIG.filter(c => c.scope === 'player');
      defPlayerCats.forEach(pc => {
        this.activeCategories.push(JSON.parse(JSON.stringify(pc)));
      });

      // Plus any customCategories defined in the deck
      if (Array.isArray(d.customCategories)) {
        d.customCategories.forEach(cc => {
          if (!this.activeCategories.some(c => c.key === cc.key)) {
            this.activeCategories.push({
              key: cc.key,
              name: cc.name,
              icon: cc.icon || '🏷️',
              type: cc.type || 'simple',
              placeholder: cc.placeholder || `Например: Карта категории ${cc.name}`,
              scope: 'player',
              isCustom: true
            });
          }
        });
      }
    }

    // 2. Prepare Custom Tags
    this.customTags = Array.isArray(d.customTags) ? JSON.parse(JSON.stringify(d.customTags)) : [];
    if (typeof TagHelper !== 'undefined') {
      TagHelper.resetToDefaults();
      TagHelper.registerCustomTags(this.customTags);
    }
    this.renderTagsManager();

    // 3. Prepare Evaluation Config
    if (d.evaluationConfig && Array.isArray(d.evaluationConfig.questions)) {
      this.evaluationQuestions = JSON.parse(JSON.stringify(d.evaluationConfig.questions));
    } else {
      this.evaluationQuestions = JSON.parse(JSON.stringify(this.DEFAULT_EVALUATION_QUESTIONS));
    }
    this.renderEvaluationConfig();

    // 4. Render Category Card Inputs (Separated: World & Player categories)
    const worldContainer = document.getElementById('editor-world-categories');
    const playerContainer = document.getElementById('editor-player-categories');
    const fallbackContainer = document.getElementById('editor-categories-inputs');

    if (worldContainer) worldContainer.innerHTML = '';
    if (playerContainer) playerContainer.innerHTML = '';
    if (fallbackContainer && !worldContainer) fallbackContainer.innerHTML = '';

    this.activeCategories.forEach(cat => {
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
      // Any player category can be removed, but world categories cannot be deleted
      const deleteCatBtn = (cat.scope === 'player') ? `
        <button type="button" class="btn btn-sm btn-danger" style="padding: 2px 8px; font-size: 11px;" title="Удалить категорию из набора" onclick="DeckEditor.deleteCategory('${cat.key}')">🗑️ Удалить категорию</button>
      ` : '';

      box.innerHTML = `
        <div class="constructor-cat-header">
          <div class="constructor-cat-title">
            <span class="cat-icon">${cat.icon}</span>
            <span class="cat-name">${cat.name}</span>
            <span class="cat-count-badge" id="count-badge-${cat.key}">${count} шт.</span>
            ${deleteCatBtn}
          </div>
          <div class="constructor-header-btn-group">
            <button type="button" class="btn btn-sm btn-outline btn-bulk-import" onclick="DeckEditor.openBulkModal('${cat.key}', '${cat.name}')">📋 Вставить списком</button>
            <button type="button" class="btn btn-sm btn-primary btn-add-card" onclick="DeckEditor.addItem('${cat.key}')">+ Добавить карту</button>
          </div>
        </div>
        <div class="constructor-items-list" id="items-list-${cat.key}"></div>
      `;

      if (cat.scope === 'world' && worldContainer) {
        worldContainer.appendChild(box);
      } else if (playerContainer) {
        playerContainer.appendChild(box);
      } else if (fallbackContainer) {
        fallbackContainer.appendChild(box);
      }

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
          <input type="text" class="form-input input-item-title" placeholder="${catConfig.titlePlaceholder || 'Заголовок'}" value="${this.escapeHtml(titleVal)}" oninput="DeckEditor.onItemInput(this, '${catConfig.key}')">
          <textarea class="form-input input-item-desc" rows="2" placeholder="${catConfig.descPlaceholder || 'Описание / условия'}" oninput="DeckEditor.onItemInput(this, '${catConfig.key}')">${this.escapeHtml(descVal)}</textarea>
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
        <input type="text" class="form-input input-item-simple" placeholder="${catConfig.placeholder || 'Текст карты'}" value="${this.escapeHtml(textVal)}" oninput="DeckEditor.onItemInput(this, '${catConfig.key}')">
        <button type="button" class="btn-delete-item" title="Удалить карту" onclick="DeckEditor.deleteItem(this, '${catConfig.key}')">🗑️</button>
      `;
    }

    container.appendChild(row);
    this.updateCategoryCount(catConfig.key);
  },

  addItem(catKey) {
    const catConfig = this.activeCategories.find(c => c.key === catKey);
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

  // --- CUSTOM CATEGORIES MANAGEMENT ---
  openNewCategoryModal() {
    const modal = document.getElementById('modal-new-category');
    if (!modal) return;
    const nameInput = document.getElementById('input-modal-new-cat-name') || document.getElementById('input-new-cat-name');
    const iconInput = document.getElementById('input-modal-new-cat-icon') || document.getElementById('input-new-cat-icon');
    const typeSelect = document.getElementById('select-modal-new-cat-type') || document.getElementById('select-new-cat-type');
    if (nameInput) nameInput.value = '';
    if (iconInput) iconInput.value = '🦾';
    if (typeSelect) typeSelect.value = 'simple';
    this.setupEmojiPicker('category-emoji-grid', (iconInput ? iconInput.id : 'input-modal-new-cat-icon'), '🦾');
    modal.classList.remove('hidden');
    if (nameInput) nameInput.focus();
    App.playSound('click');
  },

  saveNewCategory() {
    const nameInput = document.getElementById('input-modal-new-cat-name') || document.getElementById('input-new-cat-name');
    const iconInput = document.getElementById('input-modal-new-cat-icon') || document.getElementById('input-new-cat-icon');
    const typeSelect = document.getElementById('select-modal-new-cat-type') || document.getElementById('select-new-cat-type');

    const name = nameInput ? nameInput.value.trim() : '';
    const icon = iconInput ? iconInput.value.trim() || '🏷️' : '🏷️';
    const type = typeSelect ? typeSelect.value : 'simple';

    if (!name) {
      App.showToast('⚠️ Введите название категории!');
      return;
    }

    const key = 'cat_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100);

    const newCat = {
      key,
      name,
      icon,
      type,
      placeholder: `Например: Карта категории ${name}`,
      scope: 'player',
      isCustom: true
    };

    this.activeCategories.push(newCat);
    this.renderConstructor();

    document.getElementById('modal-new-category').classList.add('hidden');
    App.showToast(`✅ Категория "${name}" успешно добавлена!`);
    App.playSound('start');
  },

  deleteCategory(catKey) {
    const cat = this.activeCategories.find(c => c.key === catKey);
    if (!cat) return;
    if (cat.scope === 'world') {
      App.showToast('⚠️ Обязательные карты мира и бункера нельзя удалять!');
      return;
    }
    if (!confirm(`Удалить категорию "${cat.name}" и все заполненные в ней карты?`)) return;

    this.activeCategories = this.activeCategories.filter(c => c.key !== catKey);
    if (this.currentDeck) {
      delete this.currentDeck[catKey];
      delete this.currentDeck[catKey + 's'];
      if (Array.isArray(this.currentDeck.customCategories)) {
        this.currentDeck.customCategories = this.currentDeck.customCategories.filter(c => c.key !== catKey);
      }
      if (Array.isArray(this.currentDeck.playerCategories)) {
        this.currentDeck.playerCategories = this.currentDeck.playerCategories.filter(c => c.key !== catKey);
      }
    }
    this.renderConstructor();
    App.showToast(`🗑️ Категория "${cat.name}" удалена`);
    App.playSound('click');
  },

  deleteCustomCategory(catKey) {
    this.deleteCategory(catKey);
  },

  // --- CUSTOM TAGS MANAGEMENT ---
  renderTagsManager() {
    const container = document.getElementById('editor-tags-list-container');
    if (!container) return;

    const allTags = typeof TagHelper !== 'undefined' ? TagHelper.getAllTagsList() : [];

    container.innerHTML = allTags.map(t => {
      const isCustom = this.customTags.some(ct => ct.key === t.key);
      const deleteBtn = isCustom ? `
        <button type="button" class="btn-delete-chip-tag" title="Удалить тег" onclick="DeckEditor.deleteCustomTag('${t.key}')">✕</button>
      ` : '';

      return `
        <div class="editor-tag-chip-card" style="border-color: ${t.color}40; background: ${t.bg}; color: ${t.color};">
          <span class="tag-chip-icon">${t.icon}</span>
          <span class="tag-chip-name">#${t.name}</span>
          ${deleteBtn}
        </div>
      `;
    }).join('');
  },

  openNewTagModal() {
    const modal = document.getElementById('modal-new-tag');
    if (!modal) return;
    document.getElementById('input-new-tag-name').value = '';
    document.getElementById('input-new-tag-icon').value = '☢️';
    document.getElementById('input-new-tag-color').value = '#10b981';
    document.getElementById('input-new-tag-aliases').value = '';
    this.setupEmojiPicker('tag-emoji-grid', 'input-new-tag-icon', '☢️');
    modal.classList.remove('hidden');
    document.getElementById('input-new-tag-name').focus();
    App.playSound('click');
  },

  saveNewTag() {
    const name = (document.getElementById('input-new-tag-name')?.value || '').trim();
    const icon = (document.getElementById('input-new-tag-icon')?.value || '🏷️').trim();
    const color = (document.getElementById('input-new-tag-color')?.value || '#38bdf8').trim();
    const aliasesRaw = (document.getElementById('input-new-tag-aliases')?.value || '').trim();

    if (!name) {
      App.showToast('⚠️ Укажите название тега!');
      return;
    }

    const key = 'tag_' + name.toLowerCase().replace(/[^а-яa-z0-9]/gi, '_');
    const aliases = aliasesRaw ? aliasesRaw.split(',').map(a => a.trim().toLowerCase()).filter(Boolean) : [name.toLowerCase()];

    const tagObj = {
      key,
      name,
      icon,
      color,
      bg: color + '22',
      aliases
    };

    this.customTags = this.customTags.filter(t => t.key !== key);
    this.customTags.push(tagObj);

    if (typeof TagHelper !== 'undefined') {
      TagHelper.registerCustomTags([tagObj]);
    }

    this.renderTagsManager();
    document.getElementById('modal-new-tag').classList.add('hidden');
    App.showToast(`✅ Тег #${name} успешно создан!`);
    App.playSound('start');
  },

  deleteCustomTag(tagKey) {
    this.customTags = this.customTags.filter(t => t.key !== tagKey);
    if (typeof TagHelper !== 'undefined') {
      TagHelper.resetToDefaults();
      TagHelper.registerCustomTags(this.customTags);
    }
    this.renderTagsManager();
    App.showToast('🗑️ Тег удален');
    App.playSound('click');
  },

  // --- CUSTOM EVALUATION CONFIG MANAGEMENT ---
  renderEvaluationConfig() {
    const container = document.getElementById('editor-eval-questions-list');
    if (!container) return;

    const resourceOptions = [
      { key: 'none', label: '— Без привязки к ресурсу —' },
      { key: 'food', label: '🍞 Провизия/Вода' },
      { key: 'medicine', label: '💊 Медицина' },
      { key: 'engineering', label: '⚙️ Инженерия' },
      { key: 'defense', label: '🛡️ Защита/Оборона' },
      { key: 'psycho', label: '🧠 Психика/Сон' },
      { key: 'fire', label: '🧯 Пожаротушение' },
      { key: 'science', label: '🔬 Наука/Био' }
    ];

    // Add any custom tags as possible linked resources
    this.customTags.forEach(ct => {
      resourceOptions.push({ key: ct.key, label: `${ct.icon} ${ct.name}` });
    });

    container.innerHTML = this.evaluationQuestions.map((q, qIdx) => {
      const resSelectHtml = resourceOptions.map(opt => `
        <option value="${opt.key}" ${q.linkedResource === opt.key ? 'selected' : ''}>${opt.label}</option>
      `).join('');

      const optionsHtml = (q.options || []).map((opt, optIdx) => `
        <div class="eval-editor-option-row">
          <input type="number" class="form-input eval-opt-score" value="${opt.score || (optIdx + 1)}" min="1" max="10" title="Балл за вариант" style="width: 55px; text-align: center;">
          <input type="text" class="form-input eval-opt-label" value="${this.escapeHtml(opt.label)}" placeholder="Текст варианта" style="flex: 1;">
          <button type="button" class="btn-delete-item" title="Удалить вариант" onclick="DeckEditor.deleteEvalOption(${qIdx}, ${optIdx})">✕</button>
        </div>
      `).join('');

      return `
        <div class="eval-editor-question-card" data-qidx="${qIdx}">
          <div class="eval-editor-q-header">
            <span class="q-badge">Вопрос #${qIdx + 1}</span>
            <input type="text" class="form-input eval-q-title-input" value="${this.escapeHtml(q.title)}" placeholder="Текст вопроса" style="flex: 1; font-weight: 700;">
            <button type="button" class="btn btn-sm btn-danger" onclick="DeckEditor.deleteEvalQuestion(${qIdx})">🗑️</button>
          </div>
          <div class="eval-q-res-row">
            <span class="eval-q-res-label">📊 Связанный ресурс команды:</span>
            <select class="form-input eval-q-res-select">
              ${resSelectHtml}
            </select>
          </div>
          <div class="eval-editor-options-container" id="eval-options-list-${qIdx}">
            ${optionsHtml}
          </div>
          <button type="button" class="btn btn-sm btn-outline" style="margin-top: 6px; font-size: 11px;" onclick="DeckEditor.addEvalOption(${qIdx})">+ Добавить вариант ответа</button>
        </div>
      `;
    }).join('');
  },

  addEvaluationQuestion() {
    this.readCurrentEvalFromDOM();
    const newIdx = this.evaluationQuestions.length + 1;
    this.evaluationQuestions.push({
      id: 'q_' + Date.now().toString(36),
      title: `${newIdx}. Новый критерий выживаемости:`,
      linkedResource: 'none',
      options: [
        { score: 1, label: '1 — Критический провал' },
        { score: 2, label: '2 — Недостаточно' },
        { score: 3, label: '3 — Средний уровень' },
        { score: 4, label: '4 — Хорошо' },
        { score: 5, label: '5 — Идеально' }
      ]
    });
    this.renderEvaluationConfig();
    App.playSound('click');
  },

  deleteEvalQuestion(qIdx) {
    this.readCurrentEvalFromDOM();
    if (this.evaluationQuestions.length <= 1) {
      App.showToast('⚠️ В анкете должен оставаться хотя бы один вопрос!');
      return;
    }
    this.evaluationQuestions.splice(qIdx, 1);
    this.renderEvaluationConfig();
    App.playSound('click');
  },

  addEvalOption(qIdx) {
    this.readCurrentEvalFromDOM();
    const q = this.evaluationQuestions[qIdx];
    if (q) {
      const nextScore = (q.options || []).length + 1;
      q.options.push({ score: nextScore, label: `${nextScore} — Новый вариант ответа` });
      this.renderEvaluationConfig();
    }
  },

  deleteEvalOption(qIdx, optIdx) {
    this.readCurrentEvalFromDOM();
    const q = this.evaluationQuestions[qIdx];
    if (q && q.options && q.options.length > 2) {
      q.options.splice(optIdx, 1);
      this.renderEvaluationConfig();
    } else {
      App.showToast('⚠️ В вопросе должно быть минимум 2 варианта ответа!');
    }
  },

  resetEvaluationConfig() {
    if (!confirm('Сбросить вопросы анкеты к стандартным 5 вопросам?')) return;
    this.evaluationQuestions = JSON.parse(JSON.stringify(this.DEFAULT_EVALUATION_QUESTIONS));
    this.renderEvaluationConfig();
    App.showToast('↺ Вопросы анкеты сброшены к стандартным');
    App.playSound('click');
  },

  readCurrentEvalFromDOM() {
    const cards = document.querySelectorAll('.eval-editor-question-card');
    cards.forEach((card, idx) => {
      const q = this.evaluationQuestions[idx];
      if (!q) return;
      const titleInput = card.querySelector('.eval-q-title-input');
      const resSelect = card.querySelector('.eval-q-res-select');
      if (titleInput) q.title = titleInput.value.trim();
      if (resSelect) q.linkedResource = resSelect.value;

      const optRows = card.querySelectorAll('.eval-editor-option-row');
      const options = [];
      optRows.forEach(row => {
        const score = parseInt(row.querySelector('.eval-opt-score')?.value, 10) || 1;
        const label = row.querySelector('.eval-opt-label')?.value.trim() || '';
        options.push({ score, label });
      });
      if (options.length > 0) q.options = options;
    });
  },

  // --- IMAGE UPLOAD HELPER ---
  async uploadImageFile(file, targetInputId, isBack = false) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      App.showToast('⚠️ Пожалуйста, выберите файл изображения (PNG, JPG, WEBP)!');
      return;
    }

    App.showToast('⏳ Загрузка изображения на сервер...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target.result;
        const res = await fetch('/api/upload_image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: base64Data,
            filename: file.name
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');

        const input = document.getElementById(targetInputId);
        if (input) {
          input.value = data.url;
        }

        this.updateLivePreview();
        App.showToast(`✅ Изображение "${file.name}" успешно загружено!`);
        App.playSound('start');
      } catch (err) {
        App.showToast(`❌ Ошибка загрузки: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  },

  // --- LIVE STATIC PREVIEW ---
  updateLivePreview(catKey = null, text = null) {
    const testInput = document.getElementById('prev-test-input');
    const rawText = text !== null ? text : (testInput ? testInput.value : 'Огнетушитель ОП-4 (#Пожаротушение[4])');
    const cat = this.activeCategories.find(c => c.key === (catKey || 'small_inventory')) || this.activeCategories[3] || this.DEFAULT_CATEGORIES_CONFIG[0];

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

    // Render bulk tags helpers
    const chipsBar = document.getElementById('bulk-tags-chips');
    if (chipsBar && typeof TagHelper !== 'undefined') {
      const allTags = TagHelper.getAllTagsList();
      chipsBar.innerHTML = allTags.map(t => `
        <button type="button" class="btn-tag-chip" onclick="DeckEditor.insertBulkTag('${t.defaultTag}')" style="border-color: ${t.color}60; color: ${t.color}; background: ${t.bg}; font-size: 11px; padding: 2px 7px; border-radius: 4px; cursor: pointer;">
          + ${t.icon} ${t.defaultTag}
        </button>
      `).join('');
    }

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

    const catConfig = this.activeCategories.find(c => c.key === this.currentBulkCategory);
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
    this.readCurrentEvalFromDOM();

    const id = document.getElementById('edit-deck-id').value.trim();
    const name = document.getElementById('edit-deck-name').value.trim();
    const author = document.getElementById('edit-deck-author').value.trim();
    const desc = document.getElementById('edit-deck-desc').value.trim();
    const bg = document.getElementById('edit-deck-bg').value.trim();
    const back = document.getElementById('edit-deck-card-back').value.trim();

    if (!id || !name) {
      throw new Error('Укажите ID и название темы!');
    }

    // Filter player categories
    const playerCats = this.activeCategories.filter(c => c.scope === 'player');
    const customCats = playerCats.filter(c => c.isCustom).map(c => ({
      key: c.key,
      name: c.name,
      icon: c.icon,
      type: c.type
    }));

    const payload = {
      id,
      name,
      author: author || 'Бункер 3.1',
      description: desc,
      backgroundImage: bg || null,
      cardBackImage: back || null,
      playerCategories: playerCats.map(c => ({
        key: c.key,
        name: c.name,
        icon: c.icon,
        type: c.type,
        scope: 'player',
        isCustom: Boolean(c.isCustom)
      })),
      customCategories: customCats,
      customTags: this.customTags,
      evaluationConfig: {
        questions: this.evaluationQuestions
      }
    };

    this.activeCategories.forEach(cat => {
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
              payload[cat.key].push({ title: title || 'Условие бункера', description: description || '' });
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
    const btnBack = document.getElementById('btn-editor-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        App.showScreen('screen-lobby');
        Lobby.fetchDecks();
        App.playSound('click');
      });
    }

    // Create New Theme
    const btnNew = document.getElementById('btn-editor-new');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        this.currentDeck = {
          id: 'new_deck_' + Math.floor(Math.random() * 1000),
          name: 'Новый авторский набор',
          author: 'Мастер',
          description: 'Описание нового набора карт',
          backgroundImage: '',
          cardBackImage: '',
          customCategories: [],
          customTags: [],
          evaluationConfig: { questions: JSON.parse(JSON.stringify(this.DEFAULT_EVALUATION_QUESTIONS)) },
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
    }

    // Save Deck
    const btnSave = document.getElementById('btn-editor-save');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
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
    }

    // Delete Deck
    const btnDelete = document.getElementById('btn-editor-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
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
    }

    // Upload Background Image
    const btnUploadBg = document.getElementById('btn-upload-deck-bg');
    const inputUploadBg = document.getElementById('input-file-deck-bg');
    if (btnUploadBg && inputUploadBg) {
      btnUploadBg.addEventListener('click', () => inputUploadBg.click());
      inputUploadBg.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.uploadImageFile(file, 'edit-deck-bg');
      });
    }

    // Upload Card Back Image
    const btnUploadBack = document.getElementById('btn-upload-deck-back');
    const inputUploadBack = document.getElementById('input-file-deck-back');
    if (btnUploadBack && inputUploadBack) {
      btnUploadBack.addEventListener('click', () => inputUploadBack.click());
      inputUploadBack.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.uploadImageFile(file, 'edit-deck-card-back', true);
      });
    }

    // Category modal events
    const btnOpenCat = document.getElementById('btn-open-new-cat-modal');
    if (btnOpenCat) btnOpenCat.addEventListener('click', () => this.openNewCategoryModal());
    const btnCloseCat = document.getElementById('btn-close-new-cat-modal');
    if (btnCloseCat) btnCloseCat.addEventListener('click', () => document.getElementById('modal-new-category').classList.add('hidden'));
    const btnCancelCat = document.getElementById('btn-cancel-new-cat');
    if (btnCancelCat) btnCancelCat.addEventListener('click', () => document.getElementById('modal-new-category').classList.add('hidden'));
    const btnSaveCat = document.getElementById('btn-save-new-cat');
    if (btnSaveCat) btnSaveCat.addEventListener('click', () => this.saveNewCategory());

    // Tag modal events
    const btnOpenTag = document.getElementById('btn-open-new-tag-modal');
    if (btnOpenTag) btnOpenTag.addEventListener('click', () => this.openNewTagModal());
    const btnCloseTag = document.getElementById('btn-close-new-tag-modal');
    if (btnCloseTag) btnCloseTag.addEventListener('click', () => document.getElementById('modal-new-tag').classList.add('hidden'));
    const btnCancelTag = document.getElementById('btn-cancel-new-tag');
    if (btnCancelTag) btnCancelTag.addEventListener('click', () => document.getElementById('modal-new-tag').classList.add('hidden'));
    const btnSaveTag = document.getElementById('btn-save-new-tag');
    if (btnSaveTag) btnSaveTag.addEventListener('click', () => this.saveNewTag());

    // Evaluation config buttons
    const btnResetEval = document.getElementById('btn-reset-eval-config');
    if (btnResetEval) btnResetEval.addEventListener('click', () => this.resetEvaluationConfig());
    const btnAddEval = document.getElementById('btn-add-eval-question');
    if (btnAddEval) btnAddEval.addEventListener('click', () => this.addEvaluationQuestion());

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
