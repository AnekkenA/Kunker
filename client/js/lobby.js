// --- LOBBY LOGIC ---
const Lobby = {
  decks: [],
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

    list.innerHTML = this.decks.map(deck => `
      <label class="deck-item-label">
        <div>
          <input type="checkbox" name="selected-deck" value="${deck.id}" ${deck.id === 'classic' ? 'checked' : ''}>
          <strong>${deck.name}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${deck.description}</div>
        </div>
      </label>
    `).join('');
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
          categories: activeCategories
        });
      } else {
        // UGC Mode
        await App.sendAction('start_ugc_phase', {
          bunkerCapacity: capacity,
          threatMode,
          threatPercent,
          worldCardsMaxLimit,
          cardsLeftClosed,
          categories: activeCategories
        });
      }
      App.playSound('start');
    });

    // Deck Editor Button
    document.getElementById('btn-open-deck-editor').addEventListener('click', () => {
      App.showScreen('screen-editor');
      DeckEditor.init();
      App.playSound('click');
    });
  },

  render(state) {
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = state.players.length;

    // Render Players List
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
          <div>
            ${p.isHost ? '<span class="role-badge master">Мастер</span>' : '<span class="role-badge">Готов</span>'}
          </div>
        </div>
      `;
    }).join('');

    // If viewer is not Host -> disable start button and settings
    const isMaster = state.isHost;
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
        headerTitle.innerHTML = '⚙️ Ожидание Мастера... <button type="button" class="btn btn-xs btn-outline" id="btn-claim-host-lobby" style="font-size: 11px; margin-left: 8px; color: var(--accent-amber); border-color: var(--accent-amber); vertical-align: middle;">👑 Стать Мастером</button>';
        const btnClaim = document.getElementById('btn-claim-host-lobby');
        if (btnClaim) {
          btnClaim.addEventListener('click', async () => {
            try {
              await App.sendAction('claim_host');
              App.playSound('start');
              App.showToast('👑 Вы теперь Мастер игры!');
            } catch (e) {
              App.showToast(`Ошибка: ${e.message}`);
            }
          });
        }
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
