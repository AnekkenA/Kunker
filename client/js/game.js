// --- MAIN GAME TABLE, 3D CARDS, MASTER ACTIONS, THREATS & SURVIVAL EVALUATION ---
const GameBoard = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    // 1. OPEN REVEAL OTHER PLAYER CARD MODAL (МАСТЕР)
    const btnOpenReveal = document.getElementById('btn-open-reveal-modal');
    if (btnOpenReveal) {
      btnOpenReveal.addEventListener('click', () => {
        this.openRevealOtherModal();
      });
    }

    const btnCloseReveal = document.getElementById('btn-close-reveal-modal');
    if (btnCloseReveal) {
      btnCloseReveal.addEventListener('click', () => {
        document.getElementById('modal-reveal-other').classList.add('hidden');
      });
    }

    const btnApplyReveal = document.getElementById('btn-apply-reveal-other');
    if (btnApplyReveal) {
      btnApplyReveal.addEventListener('click', async () => {
        const targetPlayerId = document.getElementById('select-reveal-player').value;
        const categoryKey = document.getElementById('select-reveal-cat').value;
        if (!targetPlayerId || !categoryKey) return;

        try {
          await App.sendAction('reveal_other_card', { targetPlayerId, categoryKey });
          document.getElementById('modal-reveal-other').classList.add('hidden');
          App.playSound('flip');
          App.showToast('👁️ Карта успешно вскрыта для всех!');
        } catch (e) {}
      });
    }

    // 2. OPEN SHUFFLE SELECTED MODAL (МАСТЕР)
    const btnOpenShuffle = document.getElementById('btn-open-shuffle-modal');
    if (btnOpenShuffle) {
      btnOpenShuffle.addEventListener('click', () => {
        this.openShuffleSelectedModal();
      });
    }

    const btnCloseShuffle = document.getElementById('btn-close-shuffle-modal');
    if (btnCloseShuffle) {
      btnCloseShuffle.addEventListener('click', () => {
        document.getElementById('modal-shuffle-selected').classList.add('hidden');
      });
    }

    const btnApplyShuffle = document.getElementById('btn-apply-shuffle-selected');
    if (btnApplyShuffle) {
      btnApplyShuffle.addEventListener('click', async () => {
        const categoryKey = document.getElementById('select-shuffle-cat').value;
        const checkedBoxes = Array.from(document.querySelectorAll('#shuffle-players-list input[type="checkbox"]:checked'));
        const playerIds = checkedBoxes.map(cb => cb.value);

        if (playerIds.length < 2) {
          App.showToast('⚠️ Выберите как минимум 2-х игроков для перемешивания!');
          return;
        }

        try {
          await App.sendAction('shuffle_selected_cards', { categoryKey, playerIds });
          document.getElementById('modal-shuffle-selected').classList.add('hidden');
          App.playSound('start');
          App.showToast('🔀 Выбранные карты успешно перемешаны!');
        } catch (e) {}
      });
    }

    // 3. OPEN REPLACE CARD MODAL (МАСТЕР)
    const btnOpenReplace = document.getElementById('btn-open-replace-modal');
    if (btnOpenReplace) {
      btnOpenReplace.addEventListener('click', () => {
        this.openReplaceCardModal();
      });
    }

    const btnCloseReplace = document.getElementById('btn-close-replace-modal');
    if (btnCloseReplace) {
      btnCloseReplace.addEventListener('click', () => {
        document.getElementById('modal-replace-card').classList.add('hidden');
      });
    }

    const btnApplyReplace = document.getElementById('btn-apply-replace-card');
    if (btnApplyReplace) {
      btnApplyReplace.addEventListener('click', async () => {
        const targetPlayerId = document.getElementById('select-replace-player').value;
        const categoryKey = document.getElementById('select-replace-cat').value;
        if (!targetPlayerId || !categoryKey) return;

        if (!confirm('Подтвердить замену? Старая карта игрока вернется в колоду, а игрок получит случайную свободную карту из этой категории.')) {
          return;
        }

        try {
          await App.sendAction('replace_card', { targetPlayerId, categoryKey });
          document.getElementById('modal-replace-card').classList.add('hidden');
          App.playSound('flip');
          App.showToast('🎲 Карта успешно заменена на случайную из колоды!');
        } catch (e) {}
      });
    }

    // 4. MANUAL DRAW WORLD CARD BUTTON (МАСТЕР)
    const btnDrawWorld = document.getElementById('btn-draw-world-card');
    if (btnDrawWorld) {
      btnDrawWorld.addEventListener('click', async () => {
        try {
          await App.sendAction('draw_world_card');
          App.playSound('start');
        } catch (e) {}
      });
    }

    // 5. MASTER FINISH GAME -> OPENS SURVIVAL EVALUATION QUESTIONNAIRE
    const btnFinish = document.getElementById('btn-finish-game');
    if (btnFinish) {
      btnFinish.addEventListener('click', () => {
        if (!App.isHost) {
          App.showToast('Только Мастер игры может подвести итоги.');
          return;
        }
        this.openEvaluationModal();
      });
    }

    const btnCloseEval = document.getElementById('btn-close-eval-modal');
    if (btnCloseEval) {
      btnCloseEval.addEventListener('click', () => {
        document.getElementById('modal-evaluation').classList.add('hidden');
      });
    }

    const btnSubmitEval = document.getElementById('btn-submit-final-evaluation');
    if (btnSubmitEval) {
      btnSubmitEval.addEventListener('click', async () => {
        const supplies = document.querySelector('input[name="eval-supplies"]:checked')?.value || '3';
        const medicine = document.querySelector('input[name="eval-medicine"]:checked')?.value || '3';
        const specialists = document.querySelector('input[name="eval-specialists"]:checked')?.value || '3';
        const defense = document.querySelector('input[name="eval-defense"]:checked')?.value || '3';
        const psychology = document.querySelector('input[name="eval-psychology"]:checked')?.value || '3';

        try {
          await App.sendAction('submit_evaluation', {
            evaluation: { supplies, medicine, specialists, defense, psychology }
          });
          document.getElementById('modal-evaluation').classList.add('hidden');
          App.playSound('start');
        } catch (e) {}
      });
    }

    // 6. MASTER RESET TO LOBBY
    const btnResetLobby = document.getElementById('btn-reset-lobby');
    if (btnResetLobby) {
      btnResetLobby.addEventListener('click', async () => {
        if (confirm('Сбросить игру и вернуться в лобби? Все текущие карты будут очищены.')) {
          await App.sendAction('reset_lobby');
          App.playSound('click');
        }
      });
    }

    // Results Modal Return to Lobby
    const btnResultsLobby = document.getElementById('btn-results-to-lobby');
    if (btnResultsLobby) {
      btnResultsLobby.addEventListener('click', async () => {
        if (App.isHost) {
          await App.sendAction('reset_lobby');
        } else {
          document.getElementById('results-modal').classList.add('hidden');
          App.showToast('Ожидание возврата в лобби Мастером...');
        }
      });
    }

    const btnResultsClose = document.getElementById('btn-results-close');
    if (btnResultsClose) {
      btnResultsClose.addEventListener('click', () => {
        document.getElementById('results-modal').classList.add('hidden');
      });
    }
  },

  // --- MODAL OPENERS ---

  openRevealOtherModal() {
    const modal = document.getElementById('modal-reveal-other');
    if (!modal) return;
    modal.classList.remove('hidden');

    const players = (App.state && App.state.players) || [];
    const select = document.getElementById('select-reveal-player');
    select.innerHTML = players.map(p => `
      <option value="${p.id}">${p.name} ${p.isExiled ? '(Изгнан)' : ''}</option>
    `).join('');

    App.playSound('click');
  },

  openShuffleSelectedModal() {
    const modal = document.getElementById('modal-shuffle-selected');
    if (!modal) return;
    modal.classList.remove('hidden');

    const players = (App.state && App.state.players) || [];
    const list = document.getElementById('shuffle-players-list');
    list.innerHTML = players.map(p => `
      <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; font-size: 13px;">
        <input type="checkbox" value="${p.id}" checked>
        <span>${p.isHost ? '👑' : '👤'} <strong>${p.name}</strong> ${p.isExiled ? '<span class="text-red">(Изгнан)</span>' : ''}</span>
      </label>
    `).join('');

    App.playSound('click');
  },

  openReplaceCardModal() {
    const modal = document.getElementById('modal-replace-card');
    if (!modal) return;
    modal.classList.remove('hidden');

    const players = (App.state && App.state.players) || [];
    const select = document.getElementById('select-replace-player');
    select.innerHTML = players.map(p => `
      <option value="${p.id}">${p.name} ${p.isExiled ? '(Изгнан)' : ''}</option>
    `).join('');

    App.playSound('click');
  },

  openEvaluationModal() {
    const modal = document.getElementById('modal-evaluation');
    if (!modal) return;
    modal.classList.remove('hidden');

    const state = App.state || {};
    const players = state.players || [];
    let survivorsCount = 0;
    players.forEach(p => {
      if (!p.isExiled) survivorsCount++;
    });

    document.getElementById('eval-bunker-cap').textContent = state.bunkerCapacity || 3;
    const survEl = document.getElementById('eval-survivors-count');
    survEl.textContent = survivorsCount;

    if (survivorsCount > (state.bunkerCapacity || 3)) {
      survEl.className = 'text-red';
    } else {
      survEl.className = 'text-green';
    }

    App.playSound('click');
  },

  // --- STATE RENDERER ---

  render(state) {
    const isMaster = state.isHost;

    // 1. Catastrophe (Disaster)
    if (state.disaster) {
      document.getElementById('disaster-title').textContent = state.disaster.title;
      document.getElementById('disaster-goal').textContent = state.disaster.goal;
    }

    // 2. Bunker Cards List
    const bunkerContainer = document.getElementById('bunker-cards-container');
    const bunkerCountEl = document.getElementById('bunker-cards-count');
    const bunkerCards = state.revealedBunkerCards || [];
    if (bunkerCountEl) bunkerCountEl.textContent = bunkerCards.length;

    if (bunkerContainer) {
      if (bunkerCards.length === 0) {
        bunkerContainer.innerHTML = '<div class="world-card-empty">Карты бункера пока закрыты</div>';
      } else {
        bunkerContainer.innerHTML = bunkerCards.map((bc, idx) => `
          <div class="world-item-chip bunker-chip">
            <div class="chip-title">🛡️ ${bc.title || 'Условие бункера'}</div>
            <div class="chip-desc">${bc.description || ''}</div>
          </div>
        `).join('');
      }
    }

    // 3. Threat Cards List
    const threatsContainer = document.getElementById('threats-cards-container');
    const threatsCountEl = document.getElementById('threats-cards-count');
    const threatCards = state.revealedThreatCards || [];
    if (threatsCountEl) threatsCountEl.textContent = threatCards.length;

    if (threatsContainer) {
      if (threatCards.length === 0) {
        threatsContainer.innerHTML = '<div class="world-card-empty">Активных угроз пока нет</div>';
      } else {
        threatsContainer.innerHTML = threatCards.map((tc, idx) => `
          <div class="world-item-chip threat-chip">
            <div class="chip-title">⚠️ ${tc.title || 'Угроза бункера'}</div>
            <div class="chip-desc">${tc.description || ''}</div>
          </div>
        `).join('');
      }
    }

    // 4. Threat Progress / Timer Banner
    const statusBanner = document.getElementById('threat-mode-status');
    if (statusBanner) {
      if (state.threatMode === 'timer') {
        const secs = state.threatTimerCountdown !== undefined ? state.threatTimerCountdown : 120;
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        statusBanner.innerHTML = `⏱️ ХАРДКОР: До следующей карты Угрозы/Бункера: <strong class="threat-timer-badge">${timeStr}</strong>`;
      } else {
        const current = state.totalRevealsCount || 0;
        const target = state.nextThreshold || 10;
        statusBanner.innerHTML = `📊 Режим по картам: Открыто карт: <strong>${current}</strong>. Следующая карта на: <strong>${target}</strong>`;
      }
    }

    const masterDrawBox = document.getElementById('master-draw-card-box');
    if (masterDrawBox) {
      if (isMaster) masterDrawBox.classList.remove('hidden');
      else masterDrawBox.classList.add('hidden');
    }

    // 5. Stats
    let activeCount = 0;
    let exiledCount = 0;
    state.players.forEach(p => {
      if (p.isExiled) exiledCount++;
      else activeCount++;
    });

    document.getElementById('stat-bunker-cap').textContent = state.bunkerCapacity;
    document.getElementById('stat-active-count').textContent = activeCount;
    document.getElementById('stat-exiled-count').textContent = exiledCount;

    // 6. Master Controls visibility
    const masterControls = document.getElementById('master-game-controls');
    if (isMaster) {
      masterControls.classList.remove('hidden');
    } else {
      masterControls.classList.add('hidden');
    }

    // 7. Render Table Rows
    const tbody = document.getElementById('bunker-table-body');
    const categories = state.categories || [];

    tbody.innerHTML = state.players.map(player => {
      const isSelf = player.id === state.myId;
      const isExiled = player.isExiled;

      const cardCells = categories.map(cat => {
        const card = player.cards[cat.key] || { text: '', revealed: false, canReveal: false };
        return `
          <td>
            ${this.renderCardHtml(player.id, player.name, cat, card, isSelf, isMaster)}
          </td>
        `;
      }).join('');

      // Master actions cell (Выгнать / Вернуть)
      const masterActionsHtml = isMaster ? `
        <div style="display: flex; flex-direction: column; gap: 4px; padding-top: 4px;">
          <button class="btn btn-sm ${isExiled ? 'btn-success' : 'btn-danger'}" onclick="GameBoard.toggleExile('${player.id}')">
            ${isExiled ? '♻️ Вернуть' : '🚫 Выгнать'}
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

    // 8. Trigger Results Modal if Game Finished
    if (state.status === 'finished' && state.results) {
      this.showResultsModal(state.results);
    }
  },

  // --- CARD 3D HTML GENERATOR ---
  renderCardHtml(playerId, playerName, category, card, isSelf, isMaster) {
    const isRevealed = card.revealed;
    const hasText = Boolean(card.text);

    // CASE 1: Card is Revealed to Everyone (Front face displayed)
    if (isRevealed) {
      return `
        <div class="card-container" onclick="${isMaster ? `GameBoard.toggleCard('${playerId}', '${category.key}')` : ''}">
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
                <span style="font-size: 9px; color: var(--accent-cyan);">👁️ Открыта для всех</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // CASE 2: Card is Hidden, Viewer is the Owner (Sees content privately + button to reveal)
    if (isSelf && hasText) {
      return `
        <div class="card-container">
          <div class="bunker-card">
            <div class="card-face card-front" style="transform: rotateY(0deg);">
              <div class="card-header">
                <div class="card-cat-title">
                  <span class="card-cat-icon">${category.icon}</span>
                  <span class="card-cat-name">${category.name}</span>
                </div>
                <span style="font-size: 9px; color: var(--accent-amber);">🔒 Скрыто</span>
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
    // Regular players CANNOT flip it! Master can click to trigger confirmation.
    const masterClickAction = isMaster ? `GameBoard.confirmMasterReveal('${playerId}', '${category.key}', '${category.name}', '${playerName}')` : '';

    return `
      <div class="card-container ${isMaster ? 'cursor-pointer' : ''}" onclick="${masterClickAction}">
        <div class="bunker-card">
          <div class="card-face card-back">
            <div class="card-back-icon">${category.icon}</div>
            <div class="card-back-text">${category.name}</div>
            <div style="font-size: 9px; color: var(--text-dim); margin-top: 4px;">
              ${isMaster ? '👁️ Нажмите для вскрытия' : '🔒 Скрыто'}
            </div>
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

  // --- ACTIONS ---

  async toggleCard(targetPlayerId, categoryKey) {
    try {
      App.playSound('flip');
      await App.sendAction('reveal_card', { targetPlayerId, categoryKey });
    } catch (e) {}
  },

  confirmMasterReveal(targetPlayerId, categoryKey, catName, playerName) {
    if (confirm(`Вскрыть карту [${catName}] игрока ${playerName} для всех участников?`)) {
      this.toggleCard(targetPlayerId, categoryKey);
    }
  },

  async toggleExile(targetPlayerId) {
    try {
      App.playSound('exile');
      await App.sendAction('toggle_exile', { targetPlayerId });
    } catch (e) {}
  },

  // --- SHOW FINAL RESULTS MODAL ---
  showResultsModal(results) {
    const modal = document.getElementById('results-modal');
    modal.classList.remove('hidden');

    document.getElementById('results-disaster-title').textContent = `Катастрофа: ${results.disaster || 'Глобальный катаклизм'}`;

    const verdictBox = document.getElementById('results-verdict-box');
    verdictBox.innerHTML = `
      <div style="font-size: 26px; font-weight: 900; margin-bottom: 4px;">${results.percentage}%</div>
      <div style="font-size: 16px; font-weight: 700;">${results.verdict}</div>
      <p style="font-size: 13px; font-weight: normal; margin-top: 8px; line-height: 1.5; color: var(--text-main);">${results.epilogue || ''}</p>
    `;
    verdictBox.className = `results-badge-verdict ${results.isSuccess ? 'success' : 'danger'}`;

    const survList = document.getElementById('results-survivors-list');
    survList.innerHTML = (results.survivors && results.survivors.length > 0) ? results.survivors.map(s => `
      <div class="survivor-item">
        <strong>🛡️ ${s.name}</strong>
        <small>${s.profession} | ${s.health}</small>
        ${s.traits ? `<small style="color: var(--text-dim); display: block;">Черта: ${s.traits}</small>` : ''}
      </div>
    `).join('') : '<div style="color: var(--text-dim); font-size: 12px;">Никто не спасся в бункере</div>';

    const exiledList = document.getElementById('results-exiled-list');
    exiledList.innerHTML = (results.exiled && results.exiled.length > 0) ? results.exiled.map(e => `
      <div class="survivor-item" style="border-left: 2px solid var(--accent-red);">
        <strong style="color: var(--accent-red);">💀 ${e.name} (ИЗГНАН)</strong>
        <small>${e.profession}</small>
      </div>
    `).join('') : '<div style="color: var(--text-dim); font-size: 12px;">Никто не был изгнан</div>';

    const btnLobby = document.getElementById('btn-results-to-lobby');
    if (!App.isHost) {
      btnLobby.textContent = 'Ожидание решения Мастера...';
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
