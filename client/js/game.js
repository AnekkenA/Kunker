// --- MAIN GAME TABLE, 3D CARDS, MASTER SPECIAL ACTIONS & RESULTS ---
const GameBoard = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Master Finish Game
    document.getElementById('btn-finish-game').addEventListener('click', async () => {
      if (confirm('Подвести итоги игры? Список выживших и изгнанных будет зафиксирован.')) {
        await App.sendAction('finish_game');
        App.playSound('start');
      }
    });

    // Master Reset to Lobby
    document.getElementById('btn-reset-lobby').addEventListener('click', async () => {
      if (confirm('Сбросить игру и вернуться в лобби? Текущие карты будут очищены.')) {
        await App.sendAction('reset_lobby');
        App.playSound('click');
      }
    });

    // Results Modal Return to Lobby
    document.getElementById('btn-results-to-lobby').addEventListener('click', async () => {
      if (App.isHost) {
        await App.sendAction('reset_lobby');
      } else {
        document.getElementById('results-modal').classList.add('hidden');
        App.showToast('Ожидание возврата в лобби Мастером...');
      }
    });

    document.getElementById('btn-results-close').addEventListener('click', () => {
      document.getElementById('results-modal').classList.add('hidden');
    });

    // Master Actions Modal Open
    document.getElementById('btn-open-master-actions').addEventListener('click', () => {
      this.openMasterActionsModal();
    });

    // Master Actions Modal Close
    document.getElementById('btn-close-master-actions-modal').addEventListener('click', () => {
      document.getElementById('master-actions-modal').classList.add('hidden');
    });

    // Master Actions Tabs
    document.querySelectorAll('#master-actions-modal .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.target.getAttribute('data-tab');
        document.querySelectorAll('#master-actions-modal .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#master-actions-modal .tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const targetContent = document.getElementById(tabId);
        if (targetContent) targetContent.classList.add('active');
      });
    });

    // 1. Apply Replace Card (Master)
    document.getElementById('btn-ma-apply-replace').addEventListener('click', async () => {
      const targetPlayerId = document.getElementById('select-ma-replace-player').value;
      const cat = document.getElementById('select-ma-replace-cat').value;
      if (!targetPlayerId) return;

      try {
        await App.sendAction('replace_card', { targetPlayerId, categoryKey: cat });
        document.getElementById('master-actions-modal').classList.add('hidden');
        App.playSound('flip');
        App.showToast('🎲 Карта успешно заменена из колоды!');
      } catch (e) {}
    });

    // 2. Apply Swap Cards (Master)
    document.getElementById('btn-ma-apply-swap').addEventListener('click', async () => {
      const p1 = document.getElementById('select-ma-swap-p1').value;
      const p2 = document.getElementById('select-ma-swap-p2').value;
      const cat = document.getElementById('select-ma-swap-cat').value;

      if (!p1 || !p2 || p1 === p2) {
        App.showToast('⚠️ Выберите двух РАЗНЫХ игроков для обмена!');
        return;
      }

      try {
        await App.sendAction('swap_cards', { player1Id: p1, player2Id: p2, categoryKey: cat });
        document.getElementById('master-actions-modal').classList.add('hidden');
        App.playSound('flip');
        App.showToast('🔄 Обмен картами успешно совершен!');
      } catch (e) {}
    });

    // 3. Apply Shuffle Revealed Cards (Master)
    document.getElementById('btn-ma-apply-shuffle').addEventListener('click', async () => {
      const cat = document.getElementById('select-ma-shuffle-cat').value;

      try {
        await App.sendAction('shuffle_revealed_cards', { categoryKey: cat });
        document.getElementById('master-actions-modal').classList.add('hidden');
        App.playSound('start');
        App.showToast('🔀 Открытые карты успешно перемешаны!');
      } catch (e) {}
    });

    // 4. Apply Steal Card (Master)
    document.getElementById('btn-ma-apply-steal').addEventListener('click', async () => {
      const fromP = document.getElementById('select-ma-steal-from').value;
      const toP = document.getElementById('select-ma-steal-to').value;
      const cat = document.getElementById('select-ma-steal-cat').value;

      if (!fromP || !toP || fromP === toP) {
        App.showToast('⚠️ Выберите двух РАЗНЫХ игроков (Жертву и Вора)!');
        return;
      }

      try {
        await App.sendAction('steal_card', { fromPlayerId: fromP, toPlayerId: toP, categoryKey: cat });
        document.getElementById('master-actions-modal').classList.add('hidden');
        App.playSound('exile');
        App.showToast('🦹 Карта успешно украдена и передана игроку!');
      } catch (e) {}
    });
  },

  openMasterActionsModal() {
    const modal = document.getElementById('master-actions-modal');
    modal.classList.remove('hidden');

    const players = (App.state && App.state.players) || [];
    const optionsHtml = players.map(p => `
      <option value="${p.id}">${p.name} ${p.isExiled ? '(Изгнан)' : ''}</option>
    `).join('');

    document.getElementById('select-ma-replace-player').innerHTML = optionsHtml;
    document.getElementById('select-ma-swap-p1').innerHTML = optionsHtml;
    document.getElementById('select-ma-swap-p2').innerHTML = optionsHtml;
    document.getElementById('select-ma-steal-from').innerHTML = optionsHtml;
    document.getElementById('select-ma-steal-to').innerHTML = optionsHtml;

    // Set defaults if multiple players
    if (players.length > 1) {
      document.getElementById('select-ma-swap-p2').selectedIndex = 1;
      document.getElementById('select-ma-steal-to').selectedIndex = 1;
    }

    App.playSound('click');
  },

  render(state) {
    const isMaster = state.isHost;

    // 1. World Cards (Disaster & Conditions)
    if (state.disaster) {
      document.getElementById('disaster-title').textContent = state.disaster.title;
      document.getElementById('disaster-goal').textContent = state.disaster.goal;
    }
    if (state.condition) {
      document.getElementById('condition-title').textContent = state.condition.title;
      document.getElementById('condition-desc').textContent = state.condition.description;
    }

    // 2. Stats
    let activeCount = 0;
    let exiledCount = 0;
    state.players.forEach(p => {
      if (p.isExiled) exiledCount++;
      else activeCount++;
    });

    document.getElementById('stat-bunker-cap').textContent = state.bunkerCapacity;
    document.getElementById('stat-active-count').textContent = activeCount;
    document.getElementById('stat-exiled-count').textContent = exiledCount;

    // 3. Master Controls visibility
    const masterControls = document.getElementById('master-game-controls');
    if (isMaster) {
      masterControls.classList.remove('hidden');
    } else {
      masterControls.classList.add('hidden');
    }

    // 4. Render Table Rows
    const tbody = document.getElementById('bunker-table-body');
    const categories = state.categories || [];

    tbody.innerHTML = state.players.map(player => {
      const isSelf = player.id === state.myId;
      const isExiled = player.isExiled;

      const cardCells = categories.map(cat => {
        const card = player.cards[cat.key] || { text: '', revealed: false, canReveal: false };
        return `
          <td>
            ${this.renderCardHtml(player.id, cat, card, isSelf, isMaster)}
          </td>
        `;
      }).join('');

      // Master actions cell
      const masterActionsHtml = isMaster ? `
        <div style="display: flex; flex-direction: column; gap: 4px; padding-top: 4px;">
          <button class="btn btn-sm ${isExiled ? 'btn-success' : 'btn-danger'}" onclick="GameBoard.toggleExile('${player.id}')">
            ${isExiled ? '♻️ Вернуть' : '🚫 Изгнать'}
          </button>
          <button class="btn btn-sm btn-outline" style="font-size: 10px;" onclick="GameBoard.revealAll('${player.id}')">
            👁️ Вскрыть
          </button>
        </div>
      ` : `
        <div style="font-size: 11px; padding-top: 10px; text-align: center;">
          ${isExiled ? '<span class="text-red">Изгнан</span>' : '<span class="text-green">В бункере</span>'}
        </div>
      `;

      return `
        <tr class="player-row ${isExiled ? 'is-exiled' : ''}">
          <td class="player-cell">
            <div class="player-info-card">
              <div class="player-row-name">
                <span>${player.isHost ? '👑' : '👤'}</span>
                <strong>${player.name}</strong>
                ${isSelf ? '<span class="role-badge" style="font-size: 9px;">(Вы)</span>' : ''}
              </div>
              <div>
                ${isExiled ? '<span class="exile-stamp">ИЗГНАН</span>' : '<span class="role-badge" style="color: var(--accent-green);">В ИГРЕ</span>'}
              </div>
            </div>
          </td>
          ${cardCells}
          <td style="min-width: 90px; text-align: center; vertical-align: top !important;">
            ${masterActionsHtml}
          </td>
        </tr>
      `;
    }).join('');
  },

  renderCardHtml(playerId, category, card, isSelf, isMaster) {
    const isRevealed = card.revealed;
    const hasText = Boolean(card.text);
    const canFlip = isSelf || isMaster;

    // CASE 1: Card is Revealed to Everyone (Front face displayed)
    if (isRevealed) {
      return `
        <div class="card-container" onclick="${canFlip ? `GameBoard.toggleCard('${playerId}', '${category.key}')` : ''}">
          <div class="bunker-card revealed">
            <div class="card-face card-back">
              <div class="card-back-icon">${category.icon}</div>
              <div class="card-back-text">${category.name}</div>
            </div>
            <div class="card-face card-front">
              <div class="card-header">
                <div class="card-cat-title">
                  <span class="card-cat-icon">${category.icon}</span>
                  <span class="card-cat-name">${category.name}</span>
                </div>
              </div>
              <div class="card-content-text">${card.text}</div>
              <div class="card-footer">
                <span style="font-size: 9px; color: var(--accent-cyan);">👁️ Открыта</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // CASE 2: Card is Hidden, but Viewer is the Owner (Owner sees content on special card-back)
    if (isSelf && hasText) {
      return `
        <div class="card-container" onclick="GameBoard.toggleCard('${playerId}', '${category.key}')">
          <div class="bunker-card">
            <div class="card-face card-front" style="transform: rotateY(0deg);">
              <div class="card-header">
                <div class="card-cat-title">
                  <span class="card-cat-icon">${category.icon}</span>
                  <span class="card-cat-name">${category.name}</span>
                </div>
              </div>
              <div class="card-content-text">${card.text}</div>
              <div class="card-footer">
                <button class="btn-reveal-self" onclick="event.stopPropagation(); GameBoard.toggleCard('${playerId}', '${category.key}');">👁️ ПОКАЗАТЬ ВСЕМ</button>
              </div>
            </div>
            <div class="card-face card-back" style="transform: rotateY(180deg);">
              <div class="card-back-icon">${category.icon}</div>
              <div class="card-back-text">${category.name}</div>
            </div>
          </div>
        </div>
      `;
    }

    // CASE 3: Card is Hidden for other players (Standard mysterious back cover)
    return `
      <div class="card-container" onclick="${isMaster ? `GameBoard.toggleCard('${playerId}', '${category.key}')` : ''}">
        <div class="bunker-card">
          <div class="card-face card-back">
            <div class="card-back-icon">${category.icon}</div>
            <div class="card-back-text">${category.name}</div>
            <div style="font-size: 9px; color: var(--text-dim); margin-top: 4px;">🔒 Скрыто</div>
          </div>
          <div class="card-face card-front">
            <div class="card-header">
              <div class="card-cat-title">
                <span class="card-cat-icon">${category.icon}</span>
                <span class="card-cat-name">${category.name}</span>
              </div>
            </div>
            <div class="card-content-text">${card.text || '—'}</div>
          </div>
        </div>
      </div>
    `;
  },

  async toggleCard(targetPlayerId, categoryKey) {
    try {
      App.playSound('flip');
      await App.sendAction('reveal_card', { targetPlayerId, categoryKey });
    } catch (e) {}
  },

  async toggleExile(targetPlayerId) {
    try {
      App.playSound('exile');
      await App.sendAction('toggle_exile', { targetPlayerId });
    } catch (e) {}
  },

  async revealAll(targetPlayerId) {
    try {
      App.playSound('flip');
      await App.sendAction('reveal_all_cards', { targetPlayerId });
    } catch (e) {}
  },

  showResultsModal(results) {
    const modal = document.getElementById('results-modal');
    modal.classList.remove('hidden');

    document.getElementById('results-disaster-title').textContent = `Катастрофа: ${results.disaster || 'Апокалипсис'}`;

    const verdictBox = document.getElementById('results-verdict-box');
    verdictBox.textContent = results.verdict;
    verdictBox.className = `results-badge-verdict ${results.isSuccess ? 'success' : 'danger'}`;

    const survList = document.getElementById('results-survivors-list');
    survList.innerHTML = results.survivors.length > 0 ? results.survivors.map(s => `
      <div class="survivor-item">
        <strong>🛡️ ${s.name}</strong>
        <small>${s.profession} | ${s.health}</small>
      </div>
    `).join('') : '<div style="color: var(--text-dim); font-size: 12px;">Никто не спасся</div>';

    const exiledList = document.getElementById('results-exiled-list');
    exiledList.innerHTML = results.exiled.length > 0 ? results.exiled.map(e => `
      <div class="survivor-item" style="border-left: 2px solid var(--accent-red);">
        <strong style="color: var(--accent-red);">💀 ${e.name}</strong>
        <small>${e.profession}</small>
      </div>
    `).join('') : '<div style="color: var(--text-dim); font-size: 12px;">Никто не был изгнан</div>';

    const btnLobby = document.getElementById('btn-results-to-lobby');
    if (!App.isHost) {
      btnLobby.textContent = 'Ожидание Мастера...';
      btnLobby.disabled = true;
    } else {
      btnLobby.textContent = '🔄 ВЕРНУТЬ ВСЕХ В ЛОББИ';
      btnLobby.disabled = false;
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  GameBoard.init();
});
