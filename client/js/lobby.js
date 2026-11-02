// --- LOBBY LOGIC ---
const Lobby = {
  decks: [],
  visualSettings: {
    backgroundImage: '',
    cardBackImage: '',
    cardBorderFront: '#06b6d4',
    cardBorderBack: '#f59e0b'
  },
  hasUserCustomizedVisuals: false,
  _syncTimer: null,
  categories: [
    { key: 'profession', name: 'Профессия', icon: '💼', isSpecial: false, enabled: true },
    { key: 'health', name: 'Здоровье', icon: '❤️', isSpecial: false, enabled: true },
    { key: 'biology', name: 'Биология', icon: '🧬', isSpecial: false, enabled: true },
    { key: 'hobby', name: 'Хобби', icon: '🎨', isSpecial: false, enabled: true },
    { key: 'traits', name: 'Черты', icon: '🧠', isSpecial: false, enabled: true },
    { key: 'facts', name: 'Доп. сведения', icon: '📜', isSpecial: false, enabled: true },
    { key: 'small_inventory', name: 'Малый инв.', icon: '🎒', isSpecial: false, enabled: true },
    { key: 'large_inventory', name: 'Крупный инв.', icon: '📦', isSpecial: false, enabled: true },
    { key: 'special_cards', name: 'Спец-карта', icon: '⚡', isSpecial: true, enabled: true }
  ],

  async init() {
    this.bindEvents();
    this.renderCategoriesUI();
    await this.fetchDecks();
  },

  renderCategoriesUI() {
    const preview = document.getElementById('lobby-categories-preview');
    const list = document.getElementById('lobby-categories-list');
    const badge = document.getElementById('categories-count-badge');

    const enabledCats = this.categories.filter(c => c.enabled !== false);
    if (badge) badge.textContent = enabledCats.length;

    if (preview) {
      preview.innerHTML = enabledCats.map(c => `
        <span style="display: inline-block; background: var(--bg-surface); padding: 2px 7px; border-radius: 4px; margin: 2px 4px 2px 0; border: 1px solid rgba(255,255,255,0.08);">
          ${c.icon || '🃏'} ${c.name} ${c.isSpecial ? '<strong style="color:var(--accent-amber);">⚡</strong>' : ''}
        </span>
      `).join('');
    }

    if (list) {
      list.innerHTML = this.categories.map((cat, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; background: var(--bg-card); padding: 5px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
            <input type="checkbox" data-idx="${idx}" class="cat-checkbox" ${cat.enabled !== false ? 'checked' : ''}>
            <span>${cat.icon || '🃏'} <strong>${cat.name}</strong> ${cat.isSpecial ? '<span style="color:var(--accent-amber); font-size:10px;">(Спец-карта)</span>' : '<span style="color:var(--text-dim); font-size:10px;">(Обычная)</span>'}</span>
          </label>
          <button type="button" class="btn-icon" data-del="${idx}" style="color:var(--accent-red); font-size:12px; padding: 2px 6px;" title="Удалить категорию">🗑️</button>
        </div>
      `).join('');

      list.querySelectorAll('.cat-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          if (this.categories[idx]) {
            this.categories[idx].enabled = e.target.checked;
            this.renderCategoriesUI();
          }
        });
      });

      list.querySelectorAll('button[data-del]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.del, 10);
          this.categories.splice(idx, 1);
          this.renderCategoriesUI();
        });
      });
    }
  },

  async fetchDecks() {
    try {
      const res = await fetch('/api/decks');
      const data = await res.json();
      this.decks = data.decks || [];
      this.renderDeckCheckboxes();
    } catch (e) {
      console.warn('Ошибка загрузки колод:', e);
    }
  },

  renderDeckCheckboxes() {
    const list = document.getElementById('decks-checkbox-list');
    if (!list) return;

    const currentChecked = new Set(
      Array.from(document.querySelectorAll('input[name="selected-deck"]:checked')).map(cb => cb.value)
    );

    list.innerHTML = this.decks.map(deck => {
      const isChecked = currentChecked.size > 0 ? currentChecked.has(deck.id) : (deck.id === 'classic');
      const customBadge = deck.isCustom
        ? `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 11px; padding: 2px 7px; border-radius: 6px; margin-left: 6px; font-weight: 800;">ВРЕМЕННАЯ</span>`
        : '';

      return `
        <div class="deck-item-row ${isChecked ? 'is-checked' : ''}">
          <label class="deck-item-label">
            <input type="checkbox" name="selected-deck" value="${deck.id}" ${isChecked ? 'checked' : ''} onchange="this.closest('.deck-item-row').classList.toggle('is-checked', this.checked); Lobby.onDeckSelectionChanged();">
            <div class="deck-item-info">
              <div class="deck-item-title">
                <span>${deck.name}</span>
                ${customBadge}
              </div>
              <div class="deck-item-desc">${deck.description || 'Набор карт для бункера'}</div>
            </div>
          </label>
          <div class="deck-item-actions">
            <button type="button" class="btn btn-xs btn-outline btn-deck-download" title="Скачать тему на устройство (.json)" onclick="event.stopPropagation(); Lobby.downloadDeckJson('${deck.id}')">
              ⬇️ JSON
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (!this.hasUserCustomizedVisuals) {
      this.onDeckSelectionChanged();
    }
  },

  onDeckSelectionChanged() {
    const checkedDecks = Array.from(document.querySelectorAll('input[name="selected-deck"]:checked')).map(cb => cb.value);
    if (checkedDecks.length > 0 && !this.hasUserCustomizedVisuals) {
      const primaryDeck = this.decks.find(d => d.id === checkedDecks[0]);
      if (primaryDeck) {
        if (primaryDeck.backgroundImage !== undefined && primaryDeck.backgroundImage !== null) {
          this.visualSettings.backgroundImage = primaryDeck.backgroundImage;
          const bgInput = document.getElementById('lobby-deck-bg');
          if (bgInput) bgInput.value = primaryDeck.backgroundImage;
        }
        if (primaryDeck.cardBackImage !== undefined && primaryDeck.cardBackImage !== null) {
          this.visualSettings.cardBackImage = primaryDeck.cardBackImage;
          const backInput = document.getElementById('lobby-deck-card-back');
          if (backInput) backInput.value = primaryDeck.cardBackImage;
        }
        if (primaryDeck.cardBorderFront) {
          this.setFrontBorderColor(primaryDeck.cardBorderFront, false);
        }
        if (primaryDeck.cardBorderBack) {
          this.setBackBorderColor(primaryDeck.cardBorderBack, false);
        }
        this.updatePreview();
      }
    }
  },

  setBgPreset(type) {
    const presets = {
      entrance: 'https://avatars.mds.yandex.net/i?id=672bc03703857f60a3ed8ffdc09d16977b6f5f81-5424841-images-thumbs&n=13',
      hangar: 'https://avatars.mds.yandex.net/i?id=c10030d51804fb60126e5ea689ab0defbbd6003b-11938745-images-thumbs&n=13',
      corridor: 'https://avatars.mds.yandex.net/i?id=00294e1bc8ce0cf0902c38ad30101712395c288a-5340221-images-thumbs&n=13',
      sands: 'https://i.pinimg.com/originals/ec/1c/39/ec1c39f1a9ae71dbb2b45a31dec6dcbf.jpg?nii=t',
      none: ''
    };
    const val = presets[type] !== undefined ? presets[type] : '';
    this.visualSettings.backgroundImage = val;
    this.hasUserCustomizedVisuals = true;
    const bgInput = document.getElementById('lobby-deck-bg');
    if (bgInput) bgInput.value = val;
    this.updatePreview();
    this.syncVisualsToServer();
    const names = { entrance: 'Вход', hangar: 'Ангар', corridor: 'Коридор', sands: 'Пески', none: 'Сброс' };
    App.showToast(`Пресет фона стола "${names[type] || type}" установлен!`);
    App.playSound('click');
  },

  setBackPreset(type) {
    const presets = {
      radiation: 'https://i.pinimg.com/736x/c4/f6/3c/c4f63cc26821408c52a6d607b54d2fa3.jpg',
      association: 'https://img.freepik.com/premium-photo/nuclear-radiation-symbol-danger-hazard-caution-warning-illustration_167857-30664.jpg?semt=ais_hybrid',
      umbrella: 'https://yt3.googleusercontent.com/ytc/AIdro_mYG-DR1xeyiJ7qdfcs6XnO9XohibzxoPo268egrDZKMw=s900-c-k-c0x00ffffff-no-rj',
      door: 'https://i.pinimg.com/736x/ac/38/b0/ac38b01d680dde2decb12904e74021d8.jpg',
      none: ''
    };
    const val = presets[type] !== undefined ? presets[type] : '';
    this.visualSettings.cardBackImage = val;
    this.hasUserCustomizedVisuals = true;
    const backInput = document.getElementById('lobby-deck-card-back');
    if (backInput) backInput.value = val;
    this.updatePreview();
    this.syncVisualsToServer();
    const names = { radiation: 'Радиация', association: 'Ассоциация', umbrella: 'Амбрелла', door: 'Дверь', none: 'Сброс' };
    App.showToast(`Пресет рубашки карт "${names[type] || type}" установлен!`);
    App.playSound('click');
  },

  setFrontBorderColor(color, markCustom = true) {
    if (!color) return;
    this.visualSettings.cardBorderFront = color;
    if (markCustom) this.hasUserCustomizedVisuals = true;
    const valEl = document.getElementById('lobby-val-front-border');
    if (valEl) valEl.textContent = color;
    const input = document.getElementById('lobby-input-front-border');
    if (input && input.value !== color) input.value = color;

    const chips = document.querySelectorAll('#lobby-front-border-chips .color-chip');
    chips.forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-color').toLowerCase() === color.toLowerCase());
    });

    this.updatePreview();
    if (markCustom) this.syncVisualsToServer();
  },

  setBackBorderColor(color, markCustom = true) {
    if (!color) return;
    this.visualSettings.cardBorderBack = color;
    if (markCustom) this.hasUserCustomizedVisuals = true;
    const valEl = document.getElementById('lobby-val-back-border');
    if (valEl) valEl.textContent = color;
    const input = document.getElementById('lobby-input-back-border');
    if (input && input.value !== color) input.value = color;

    const chips = document.querySelectorAll('#lobby-back-border-chips .color-chip');
    chips.forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-color').toLowerCase() === color.toLowerCase());
    });

    this.updatePreview();
    if (markCustom) this.syncVisualsToServer();
  },

  async uploadVisualFile(file, targetType) {
    if (!file) return;
    try {
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

          if (targetType === 'bg') {
            this.visualSettings.backgroundImage = data.url;
            const input = document.getElementById('lobby-deck-bg');
            if (input) input.value = data.url;
          } else {
            this.visualSettings.cardBackImage = data.url;
            const input = document.getElementById('lobby-deck-card-back');
            if (input) input.value = data.url;
          }
          this.hasUserCustomizedVisuals = true;
          this.updatePreview();
          this.syncVisualsToServer();
          App.showToast(`✅ Изображение "${file.name}" загружено!`);
          App.playSound('start');
        } catch (err) {
          App.showToast(`❌ Ошибка загрузки: ${err.message}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      App.showToast(`❌ Ошибка чтения файла: ${err.message}`);
    }
  },

  updatePreview() {
    const bgUrl = this.visualSettings.backgroundImage || '';
    const backUrl = this.visualSettings.cardBackImage || '';
    const frontBorder = this.visualSettings.cardBorderFront || '#06b6d4';
    const backBorder = this.visualSettings.cardBorderBack || '#f59e0b';

    // 1. Tabletop box
    const tabletopBox = document.getElementById('lobby-preview-tabletop-box');
    if (tabletopBox) {
      if (bgUrl) {
        tabletopBox.style.backgroundImage = `linear-gradient(rgba(11, 15, 23, 0.35), rgba(11, 15, 23, 0.35)), url('${bgUrl}'), radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)`;
        tabletopBox.style.backgroundSize = 'cover';
        tabletopBox.style.backgroundPosition = 'center center';
      } else {
        tabletopBox.style.backgroundImage = '';
      }
    }

    // 2. Front card
    const faceEl = document.getElementById('lobby-card-preview-face');
    if (faceEl) {
      faceEl.style.borderColor = frontBorder;
    }

    // 3. Back card
    const backEl = document.getElementById('lobby-card-preview-back');
    if (backEl) {
      backEl.style.borderColor = backBorder;
      if (backUrl) {
        backEl.style.setProperty('--card-back-img', `url('${backUrl}')`);
        backEl.style.backgroundImage = `url('${backUrl}')`;
        backEl.classList.add('has-custom-back');
      } else {
        backEl.style.removeProperty('--card-back-img');
        backEl.style.backgroundImage = '';
        backEl.classList.remove('has-custom-back');
      }
    }
  },

  syncVisualsToServer() {
    if (!App.isHost) return;
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => {
      App.sendAction('update_settings', {
        backgroundImage: this.visualSettings.backgroundImage,
        cardBackImage: this.visualSettings.cardBackImage,
        cardBorderFront: this.visualSettings.cardBorderFront,
        cardBorderBack: this.visualSettings.cardBorderBack
      }).catch(err => console.warn('Sync visuals error:', err));
    }, 300);
  },

  async downloadDeckJson(deckId) {
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(deckId)}`);
      if (!res.ok) throw new Error('Не удалось загрузить данные темы');
      const data = await res.json();
      const deck = data.deck;
      if (!deck) throw new Error('Колода пуста');

      const str = JSON.stringify(deck, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck.id || 'deck'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.showToast(`📥 Тема "${deck.name || deck.id}" скачана на устройство!`);
    } catch (err) {
      alert('Ошибка скачивания темы: ' + err.message);
    }
  },

  async uploadDeckJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const deckData = JSON.parse(text);

      if (!deckData || typeof deckData !== 'object') {
        throw new Error('Файл не содержит корректную структуру колоды JSON.');
      }
      if (!deckData.id) {
        deckData.id = 'custom_' + Date.now();
      }
      if (!deckData.name) {
        deckData.name = file.name.replace(/\.json$/i, '');
      }

      deckData.isCustom = true;
      deckData.autoSelect = true;

      const res = await fetch('/api/decks/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-room-id': App.roomId || ''
        },
        body: JSON.stringify(deckData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Ошибка при сохранении темы на сервере');
      }

      const savedRes = await res.json();
      App.showToast(`✅ Тема "${deckData.name}" успешно загружена!`);

      await this.fetchDecks();
      const newCb = document.querySelector(`input[name="selected-deck"][value="${savedRes.deck.id}"]`);
      if (newCb) {
        newCb.checked = true;
      }
    } catch (err) {
      alert('Не удалось загрузить тему: ' + err.message);
    }
  },

  bindEvents() {
    // Mode radio switch
    document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        const presetGroup = document.getElementById('preset-decks-group');
        if (mode === 'ugc') {
          presetGroup.classList.add('hidden');
        } else {
          presetGroup.classList.remove('hidden');
        }
        App.playSound('click');
      });
    });

    // Threat / Bunker probability slider/input
    const threatInput = document.getElementById('input-threat-percent');
    const threatBadge = document.getElementById('threat-percent-badge');
    if (threatInput && threatBadge) {
      const updateThreatBadge = () => {
        let val = parseInt(threatInput.value, 10);
        if (isNaN(val)) val = 50;
        val = Math.max(0, Math.min(100, val));
        const bunkerVal = 100 - val;
        threatBadge.textContent = `${val}% Угрозы / ${bunkerVal}% Бункер`;
      };
      threatInput.addEventListener('input', updateThreatBadge);
    }

    // Toggle categories box
    const btnToggleCats = document.getElementById('btn-toggle-cat-manager');
    const catsBox = document.getElementById('lobby-categories-box');
    if (btnToggleCats && catsBox) {
      btnToggleCats.addEventListener('click', () => {
        catsBox.classList.toggle('hidden');
        App.playSound('click');
      });
    }

    // Setup Lobby Emoji Picker for custom category
    const lobbyEmojiGrid = document.getElementById('lobby-category-emoji-grid');
    const lobbyIconInput = document.getElementById('input-lobby-new-cat-icon') || document.getElementById('input-new-cat-icon');
    if (lobbyEmojiGrid && lobbyIconInput) {
      const emojis = (typeof DeckEditor !== 'undefined' && DeckEditor.CURATED_EMOJIS) || [
        '☣️', '☢️', '🌋', '⚠️', '🔥', '🧯',
        '💊', '💉', '🩺', '🧬', '❤️', '🧠',
        '🍞', '🥫', '💧', '🥩', '🌾', '🍳',
        '⚙️', '🔧', '🔋', '⚡', '💻', '💡',
        '🛡️', '🗡️', '🔫', '🪓', '🪖', '🏹',
        '🎒', '📦', '📻', '🗝️', '🦾', '📜'
      ];
      lobbyEmojiGrid.innerHTML = emojis.map(em => `
        <button type="button" class="btn-emoji-pick ${lobbyIconInput.value === em ? 'selected' : ''}" data-emoji="${em}" style="font-size: 14px; height: 28px;">
          ${em}
        </button>
      `).join('');

      lobbyEmojiGrid.querySelectorAll('.btn-emoji-pick').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const em = btn.getAttribute('data-emoji');
          lobbyIconInput.value = em;
          lobbyEmojiGrid.querySelectorAll('.btn-emoji-pick').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          App.playSound('click');
        });
      });
    }

    // Add custom category button
    const btnAddCat = document.getElementById('btn-add-custom-cat');
    if (btnAddCat) {
      btnAddCat.addEventListener('click', () => {
        const nameInput = document.getElementById('input-lobby-new-cat-name') || document.getElementById('input-new-cat-name');
        const iconInput = document.getElementById('input-lobby-new-cat-icon') || document.getElementById('input-new-cat-icon');
        const cardsInput = document.getElementById('input-lobby-new-cat-cards') || document.getElementById('input-new-cat-cards');

        const name = nameInput ? nameInput.value.trim() : '';
        const icon = iconInput && iconInput.value.trim() ? iconInput.value.trim() : '🃏';
        const cardsStr = cardsInput ? cardsInput.value.trim() : '';

        if (!name) {
          App.showToast('⚠️ Введите название категории!');
          return;
        }

        const customCards = cardsStr ? cardsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const key = 'custom_' + Date.now();

        this.categories.push({
          key,
          name,
          icon,
          isSpecial: false,
          isCustom: true,
          enabled: true,
          customCards
        });

        if (nameInput) nameInput.value = '';
        if (iconInput) iconInput.value = '🏷️';
        if (cardsInput) cardsInput.value = '';

        this.renderCategoriesUI();
        App.showToast(`✅ Категория "${name}" добавлена!`);
        App.playSound('click');
      });
    }

    // Bunker capacity range slider
    const slider = document.getElementById('input-bunker-capacity');
    const badge = document.getElementById('capacity-value');
    if (slider) {
      slider.addEventListener('input', (e) => {
        if (badge) badge.textContent = e.target.value;
      });
    }

    // Start Game Button
    document.getElementById('btn-start-game').addEventListener('click', async () => {
      const mode = document.querySelector('input[name="game-mode"]:checked').value;
      const capacity = parseInt(slider.value, 10) || 3;

      const threatModeRadio = document.querySelector('input[name="threat-mode"]:checked');
      const threatMode = threatModeRadio ? threatModeRadio.value : 'threshold';

      const threatPercent = parseInt(document.getElementById('input-threat-percent')?.value, 10) || 50;
      const worldCardsMaxLimit = parseInt(document.getElementById('input-world-cards-limit')?.value, 10) || 6;
      const cardsLeftClosed = parseInt(document.getElementById('input-cards-left-closed')?.value, 10) || 1;

      const activeCategories = this.categories.filter(c => c.enabled !== false);
      if (activeCategories.length < 2) {
        App.showToast('⚠️ В игре должно быть включено хотя бы 2 категории!');
        return;
      }

      if (mode === 'preset') {
        const checkedDecks = Array.from(document.querySelectorAll('input[name="selected-deck"]:checked')).map(cb => cb.value);
        if (checkedDecks.length === 0) {
          App.showToast('⚠️ Выберите хотя бы одну тему колоды!');
          return;
        }

        await App.sendAction('start_preset', {
          decks: checkedDecks,
          bunkerCapacity: capacity,
          threatMode,
          threatPercent,
          worldCardsMaxLimit,
          cardsLeftClosed,
          categories: activeCategories,
          backgroundImage: this.visualSettings.backgroundImage || null,
          cardBackImage: this.visualSettings.cardBackImage || null,
          cardBorderFront: this.visualSettings.cardBorderFront || '#06b6d4',
          cardBorderBack: this.visualSettings.cardBorderBack || '#f59e0b'
        });
      } else {
        // UGC Mode
        await App.sendAction('start_ugc_phase', {
          bunkerCapacity: capacity,
          threatMode,
          threatPercent,
          worldCardsMaxLimit,
          cardsLeftClosed,
          categories: activeCategories,
          backgroundImage: this.visualSettings.backgroundImage || null,
          cardBackImage: this.visualSettings.cardBackImage || null,
          cardBorderFront: this.visualSettings.cardBorderFront || '#06b6d4',
          cardBorderBack: this.visualSettings.cardBorderBack || '#f59e0b'
        });
      }
      App.playSound('start');
    });

    // Upload Deck JSON Button in Lobby
    const btnUploadDeck = document.getElementById('btn-lobby-upload-deck');
    const inputUploadDeck = document.getElementById('input-lobby-deck-file');
    if (btnUploadDeck && inputUploadDeck) {
      btnUploadDeck.addEventListener('click', () => {
        inputUploadDeck.value = '';
        inputUploadDeck.click();
      });
      inputUploadDeck.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) this.uploadDeckJson(file);
      });
    }

    // Deck Editor Button
    document.getElementById('btn-open-deck-editor').addEventListener('click', () => {
      App.showScreen('screen-editor');
      DeckEditor.init();
      App.playSound('click');
    });

    // Toggle Advanced Lobby Settings
    const btnAdvLobby = document.getElementById('btn-toggle-advanced-lobby');
    const boxAdvLobby = document.getElementById('lobby-advanced-box');
    const arrowAdvLobby = document.getElementById('advanced-lobby-arrow');
    if (btnAdvLobby && boxAdvLobby) {
      btnAdvLobby.addEventListener('click', () => {
        boxAdvLobby.classList.toggle('hidden');
        const isHidden = boxAdvLobby.classList.contains('hidden');
        if (arrowAdvLobby) arrowAdvLobby.textContent = isHidden ? '▾' : '▴';
        App.playSound('click');
      });
    }

    // Save Room Password (Master)
    const btnSavePass = document.getElementById('btn-save-lobby-password');
    if (btnSavePass) {
      btnSavePass.addEventListener('click', async () => {
        const passInput = document.getElementById('input-lobby-password');
        const password = passInput ? passInput.value.trim() : '';
        try {
          await App.sendAction('update_room_access', { password });
          App.playSound('click');
          App.showToast(password ? `🔒 Пароль бункера установлен: "${password}"` : '🔓 Пароль бункера снят (вход свободный)');
        } catch (e) {
          App.showToast(`Ошибка: ${e.message}`);
        }
      });
    }

    // Lock/Unlock Lobby Toggle (Master)
    const lockCb = document.getElementById('checkbox-lock-lobby');
    if (lockCb) {
      lockCb.addEventListener('change', async (e) => {
        const locked = e.target.checked;
        try {
          await App.sendAction('update_room_access', { lockedLobby: locked });
          App.playSound('click');
          App.showToast(locked ? '🚫 Шлюз заперт! Новые игроки не смогут войти.' : '🚪 Шлюз открыт для входа игроков.');
        } catch (err) {
          e.target.checked = !locked;
          App.showToast(`Ошибка: ${err.message}`);
        }
      });
    }

    // Lobby Visual Controls Binding
    // Front Border chips
    document.querySelectorAll('#lobby-front-border-chips .color-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const color = chip.getAttribute('data-color');
        this.setFrontBorderColor(color, true);
        App.playSound('click');
      });
    });
    const frontBorderInput = document.getElementById('lobby-input-front-border');
    if (frontBorderInput) {
      frontBorderInput.addEventListener('input', (e) => {
        this.setFrontBorderColor(e.target.value, true);
      });
    }

    // Back Border chips
    document.querySelectorAll('#lobby-back-border-chips .color-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const color = chip.getAttribute('data-color');
        this.setBackBorderColor(color, true);
        App.playSound('click');
      });
    });
    const backBorderInput = document.getElementById('lobby-input-back-border');
    if (backBorderInput) {
      backBorderInput.addEventListener('input', (e) => {
        this.setBackBorderColor(e.target.value, true);
      });
    }

    // Lobby Background Image input & upload
    const lobbyBgInput = document.getElementById('lobby-deck-bg');
    if (lobbyBgInput) {
      lobbyBgInput.addEventListener('input', (e) => {
        this.visualSettings.backgroundImage = e.target.value.trim();
        this.hasUserCustomizedVisuals = true;
        this.updatePreview();
        this.syncVisualsToServer();
      });
    }
    const btnUploadLobbyBg = document.getElementById('btn-lobby-upload-bg');
    const inputFileLobbyBg = document.getElementById('input-file-lobby-bg');
    if (btnUploadLobbyBg && inputFileLobbyBg) {
      btnUploadLobbyBg.addEventListener('click', () => {
        inputFileLobbyBg.value = '';
        inputFileLobbyBg.click();
      });
      inputFileLobbyBg.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) this.uploadVisualFile(file, 'bg');
      });
    }

    // Lobby Card Back Image input & upload
    const lobbyBackInput = document.getElementById('lobby-deck-card-back');
    if (lobbyBackInput) {
      lobbyBackInput.addEventListener('input', (e) => {
        this.visualSettings.cardBackImage = e.target.value.trim();
        this.hasUserCustomizedVisuals = true;
        this.updatePreview();
        this.syncVisualsToServer();
      });
    }
    const btnUploadLobbyBack = document.getElementById('btn-lobby-upload-card-back');
    const inputFileLobbyBack = document.getElementById('input-file-lobby-card-back');
    if (btnUploadLobbyBack && inputFileLobbyBack) {
      btnUploadLobbyBack.addEventListener('click', () => {
        inputFileLobbyBack.value = '';
        inputFileLobbyBack.click();
      });
      inputFileLobbyBack.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) this.uploadVisualFile(file, 'back');
      });
    }
  },

  render(state) {
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = state.players.length;

    // Render Players List
    const isMaster = Boolean(state.isHost);
    const playersList = document.getElementById('lobby-players-list');
    playersList.innerHTML = state.players.map(p => {
      const isSelf = p.id === state.myId;
      return `
        <div class="player-list-item ${isSelf ? 'is-self' : ''}">
          <div class="player-name-wrapper">
            <span>${p.isHost ? '👑' : '👤'}</span>
            <strong>${p.name}</strong>
            ${isSelf ? '<span class="role-badge">(Вы)</span>' : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${p.isHost ? '<span class="role-badge master">Мастер</span>' : '<span class="role-badge">Готов</span>'}
            ${isMaster && !p.isHost ? `
              <button type="button" class="btn btn-xs btn-outline btn-transfer-host" data-id="${p.id}" data-name="${p.name}" style="font-size: 11px; padding: 3px 8px; color: var(--accent-amber); border-color: rgba(245, 158, 11, 0.4);" title="Передать роль Мастера этому игроку">👑 Передать</button>
              <button type="button" class="btn btn-xs btn-outline btn-kick-player" data-id="${p.id}" data-name="${p.name}" style="font-size: 11px; padding: 3px 8px; color: var(--accent-red); border-color: rgba(239, 68, 68, 0.4);" title="Удалить лишнего игрока из шлюза">✕ Кикнуть</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach Master Host Transfer and Kick handlers
    if (isMaster) {
      playersList.querySelectorAll('.btn-transfer-host').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetId = btn.getAttribute('data-id');
          const targetName = btn.getAttribute('data-name');
          if (confirm(`👑 Передать роль Мастера игроку "${targetName}"?\nВы станете обычным выжившим.`)) {
            try {
              await App.sendAction('transfer_host', { targetPlayerId: targetId });
              App.playSound('start');
              App.showToast(`👑 Роль Мастера передана игроку ${targetName}!`);
            } catch (err) {
              App.showToast(`Ошибка: ${err.message}`);
            }
          }
        });
      });

      playersList.querySelectorAll('.btn-kick-player').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetId = btn.getAttribute('data-id');
          const targetName = btn.getAttribute('data-name');
          if (confirm(`🗑️ Удалить игрока "${targetName}" из шлюза?`)) {
            try {
              await App.sendAction('kick_player', { targetPlayerId: targetId });
              App.playSound('click');
              App.showToast(`🚪 Игрок ${targetName} удален из шлюза.`);
            } catch (err) {
              App.showToast(`Ошибка: ${err.message}`);
            }
          }
        });
      });
    }

    // Master Access & Security panel
    const accessGroup = document.getElementById('lobby-room-access-group');
    if (accessGroup) {
      accessGroup.style.display = isMaster ? 'block' : 'none';
    }
    const roomBadgeDisplay = document.getElementById('lobby-room-badge-display');
    if (roomBadgeDisplay) {
      roomBadgeDisplay.textContent = state.roomId ? '#' + state.roomId : '';
    }
    const passInput = document.getElementById('input-lobby-password');
    if (passInput && document.activeElement !== passInput) {
      passInput.value = (isMaster && state.currentPassword) ? state.currentPassword : '';
    }
    const lockCb = document.getElementById('checkbox-lock-lobby');
    if (lockCb && document.activeElement !== lockCb) {
      lockCb.checked = Boolean(state.lockedLobby);
    }

    // Master Visual Preview Box: ONLY visible to Master
    const masterVisualBox = document.getElementById('lobby-master-visual-box');
    if (masterVisualBox) {
      if (isMaster) {
        masterVisualBox.classList.remove('hidden');
      } else {
        masterVisualBox.classList.add('hidden');
      }
    }

    if (isMaster) {
      // Sync from state if user hasn't explicitly customized locally
      if (state.cardBorderFront && !this.hasUserCustomizedVisuals) {
        this.visualSettings.cardBorderFront = state.cardBorderFront;
        const frontInput = document.getElementById('lobby-input-front-border');
        if (frontInput && document.activeElement !== frontInput) frontInput.value = state.cardBorderFront;
        const valEl = document.getElementById('lobby-val-front-border');
        if (valEl) valEl.textContent = state.cardBorderFront;
        const chips = document.querySelectorAll('#lobby-front-border-chips .color-chip');
        chips.forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-color').toLowerCase() === state.cardBorderFront.toLowerCase());
        });
      }
      if (state.cardBorderBack && !this.hasUserCustomizedVisuals) {
        this.visualSettings.cardBorderBack = state.cardBorderBack;
        const backInput = document.getElementById('lobby-input-back-border');
        if (backInput && document.activeElement !== backInput) backInput.value = state.cardBorderBack;
        const valEl = document.getElementById('lobby-val-back-border');
        if (valEl) valEl.textContent = state.cardBorderBack;
        const chips = document.querySelectorAll('#lobby-back-border-chips .color-chip');
        chips.forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-color').toLowerCase() === state.cardBorderBack.toLowerCase());
        });
      }
      if (state.backgroundImage !== undefined && !this.hasUserCustomizedVisuals) {
        this.visualSettings.backgroundImage = state.backgroundImage || '';
        const bgInput = document.getElementById('lobby-deck-bg');
        if (bgInput && document.activeElement !== bgInput) bgInput.value = state.backgroundImage || '';
      }
      if (state.cardBackImage !== undefined && !this.hasUserCustomizedVisuals) {
        this.visualSettings.cardBackImage = state.cardBackImage || '';
        const backInput = document.getElementById('lobby-deck-card-back');
        if (backInput && document.activeElement !== backInput) backInput.value = state.cardBackImage || '';
      }
      this.updatePreview();
    }

    // If viewer is not Host -> disable start button and settings
    document.getElementById('btn-start-game').style.display = isMaster ? 'block' : 'none';
    document.querySelectorAll('input[name="game-mode"]').forEach(r => r.disabled = !isMaster);
    document.querySelectorAll('input[name="selected-deck"]').forEach(cb => cb.disabled = !isMaster);
    
    const capSlider = document.getElementById('input-bunker-capacity');
    const capBadge = document.getElementById('capacity-value');
    if (capSlider) {
      capSlider.disabled = !isMaster;
      if (document.activeElement !== capSlider && state.bunkerCapacity) {
        capSlider.value = state.bunkerCapacity;
        if (capBadge) capBadge.textContent = state.bunkerCapacity;
      }
    }

    const headerTitle = document.querySelector('.settings-panel .panel-header h2');
    if (!isMaster) {
      if (headerTitle) {
        headerTitle.textContent = '⚙️ Ожидание запуска игры Мастером...';
      }
    } else {
      if (headerTitle) {
        headerTitle.textContent = '⚙️ Параметры убежища (Панель Мастера)';
      }
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  Lobby.init();
});
