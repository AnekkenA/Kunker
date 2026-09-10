// --- LOBBY LOGIC ---
const Lobby = {
  decks: [],

  async init() {
    this.bindEvents();
    await this.fetchDecks();
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

    // Bunker capacity range slider
    const slider = document.getElementById('input-bunker-capacity');
    const badge = document.getElementById('capacity-value');
    slider.addEventListener('input', (e) => {
      badge.textContent = e.target.value;
    });

    // Start Game Button
    document.getElementById('btn-start-game').addEventListener('click', async () => {
      const mode = document.querySelector('input[name="game-mode"]:checked').value;
      const capacity = parseInt(slider.value, 10) || 3;

      if (mode === 'preset') {
        const checkedDecks = Array.from(document.querySelectorAll('input[name="selected-deck"]:checked')).map(cb => cb.value);
        if (checkedDecks.length === 0) {
          App.showToast('⚠️ Выберите хотя бы одну тему колоды!');
          return;
        }

        await App.sendAction('start_preset', {
          decks: checkedDecks,
          bunkerCapacity: capacity
        });
      } else {
        // UGC Mode
        await App.sendAction('start_ugc_phase', {
          bunkerCapacity: capacity
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
    document.getElementById('input-bunker-capacity').disabled = !isMaster;

    if (!isMaster) {
      document.querySelector('.settings-panel .panel-header h2').textContent = '⚙️ Ожидание запуска игры Мастером...';
    } else {
      document.querySelector('.settings-panel .panel-header h2').textContent = '⚙️ Параметры убежища (Панель Мастера)';
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  Lobby.init();
});
