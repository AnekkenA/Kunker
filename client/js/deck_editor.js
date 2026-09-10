// --- DECK EDITOR: VISUAL CONSTRUCTOR (КОНСТРУКТОР КАРТ) ---
const DeckEditor = {
  currentDeck: null,
  decksList: [],

  categoriesConfig: [
    { key: 'disasters', name: 'Катастрофы', icon: '🌋', type: 'complex', titlePlaceholder: 'Название катастрофы', descPlaceholder: 'Цель выживания / Срок изоляции' },
    { key: 'conditions', name: 'Условия и Угрозы бункера', icon: '🛡️', type: 'complex', titlePlaceholder: 'Название условия / угрозы', descPlaceholder: 'Описание опасности или бонуса бункера' },
    { key: 'professions', name: 'Профессии', icon: '💼', type: 'simple', placeholder: 'Например: Инженер-робототехник (Стаж 10 лет)' },
    { key: 'health', name: 'Здоровье', icon: '❤️', type: 'simple', placeholder: 'Например: Идеальное зрение, аллергия на пыльцу' },
    { key: 'biology', name: 'Биология', icon: '🧬', type: 'simple', placeholder: 'Например: Мужчина, 28 лет, атлетичный, фертилен' },
    { key: 'hobby', name: 'Хобби', icon: '🎨', type: 'simple', placeholder: 'Например: Сборка электроники из хлама' },
    { key: 'traits', name: 'Черты характера', icon: '🧠', type: 'simple', placeholder: 'Например: Хладнокровие в критических ситуациях' },
    { key: 'facts', name: 'Дополнительные сведения', icon: '📜', type: 'simple', placeholder: 'Например: Знает пароль от аварийного генератора' },
    { key: 'small_inventory', name: 'Малый инвентарь', icon: '🎒', type: 'simple', placeholder: 'Например: Армейский швейцарский нож' },
    { key: 'large_inventory', name: 'Крупный инвентарь', icon: '📦', type: 'simple', placeholder: 'Например: Дизельный генератор на 5 кВт' },
    { key: 'special_cards', name: 'Спец-карты', icon: '⚡', type: 'simple', placeholder: 'Например: «Право Вето»: Отмените изгнание 1 раз' }
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
    document.getElementById('edit-deck-desc').value = d.description || '';

    const container = document.getElementById('editor-categories-inputs');
    container.innerHTML = '';

    this.categoriesConfig.forEach(cat => {
      const box = document.createElement('div');
      box.className = 'constructor-category-box';
      box.setAttribute('data-cat-key', cat.key);

      const items = (d[cat.key] || d[cat.key + 's'] || []);
      const count = Array.isArray(items) ? items.length : 0;

      box.innerHTML = `
        <div class="constructor-cat-header">
          <div class="constructor-cat-title">
            <span class="cat-icon">${cat.icon}</span>
            <span class="cat-name">${cat.name}</span>
            <span class="cat-count-badge" id="count-badge-${cat.key}">${count} шт.</span>
          </div>
          <button type="button" class="btn btn-sm btn-primary btn-add-card" onclick="DeckEditor.addItem('${cat.key}')">+ Добавить карту</button>
        </div>
        <div class="constructor-items-list" id="items-list-${cat.key}"></div>
      `;

      container.appendChild(box);

      const itemsListContainer = box.querySelector(`#items-list-${cat.key}`);
      if (Array.isArray(items)) {
        items.forEach((item, idx) => {
          this.appendItemRow(itemsListContainer, cat, item);
        });
      }
    });
  },

  appendItemRow(container, catConfig, itemData = null) {
    const row = document.createElement('div');
    row.className = 'constructor-item-row';

    if (catConfig.type === 'complex') {
      // For Disasters and Conditions (Title + Description/Goal)
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
          <input type="text" class="form-input input-item-title" placeholder="${catConfig.titlePlaceholder}" value="${this.escapeHtml(titleVal)}">
          <input type="text" class="form-input input-item-desc" placeholder="${catConfig.descPlaceholder}" value="${this.escapeHtml(descVal)}">
        </div>
        <button type="button" class="btn-delete-item" title="Удалить карту" onclick="DeckEditor.deleteItem(this, '${catConfig.key}')">🗑️</button>
      `;
    } else {
      // Simple 1-line cards (Profession, Health, Luggage, etc.)
      const textVal = typeof itemData === 'string' ? itemData : (itemData ? (itemData.text || itemData.name || JSON.stringify(itemData)) : '');

      row.innerHTML = `
        <input type="text" class="form-input input-item-simple" placeholder="${catConfig.placeholder}" value="${this.escapeHtml(textVal)}">
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
        App.playSound('click');
      }, 150);
    }
  },

  updateCategoryCount(catKey) {
    const listContainer = document.getElementById(`items-list-${catKey}`);
    const badge = document.getElementById(`count-badge-${catKey}`);
    if (listContainer && badge) {
      const count = listContainer.children.length;
      badge.textContent = `${count} шт.`;
    }
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
    const desc = document.getElementById('edit-deck-desc').value.trim();

    if (!id || !name) {
      throw new Error('Укажите ID и название темы!');
    }

    const payload = {
      id,
      name,
      description: desc
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
            } else {
              payload.conditions.push({ title: title || 'Условие бункера', description: description || '' });
            }
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
        name: 'Новый набор карт',
        description: 'Описание нового набора',
        disasters: [{ title: 'Новая катастрофа', goal: 'Цель выживания' }],
        conditions: [{ title: 'Особое условие бункера', description: 'Описание оборудования' }],
        professions: ['Инженер', 'Врач', 'Ученый'],
        health: ['Идеальное здоровье'],
        biology: ['Мужчина, 25 лет, фертилен'],
        hobby: ['Кулинария'],
        traits: ['Оптимист'],
        facts: ['Знает секретный код'],
        small_inventory: ['Фонарик'],
        large_inventory: ['Генератор'],
        special_cards: ['«Право Вето»: Отмените изгнание']
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
  }
};
