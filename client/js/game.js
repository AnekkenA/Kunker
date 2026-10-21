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

    // 4b. MASTER CHANGE BUNKER CAPACITY (+-1)
    const btnCapMinus = document.getElementById('btn-cap-minus');
    if (btnCapMinus) {
      btnCapMinus.addEventListener('click', async () => {
        try {
          await App.sendAction('change_bunker_capacity', { delta: -1 });
          App.playSound('click');
        } catch (e) {}
      });
    }

    const btnCapPlus = document.getElementById('btn-cap-plus');
    if (btnCapPlus) {
      btnCapPlus.addEventListener('click', async () => {
        try {
          await App.sendAction('change_bunker_capacity', { delta: 1 });
          App.playSound('click');
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

        // Lock check: survivors count must not exceed bunker capacity!
        if (App.state && !App.state.survivorsOk) {
          const excess = App.state.excessPlayers || (App.state.activeSurvivorsCount - App.state.bunkerCapacity);
          alert(`⚠️ В бункере перенаселение! Выживших (${App.state.activeSurvivorsCount}) больше, чем мест в бункере (${App.state.bunkerCapacity}).\n\nИгра не дает перейти к подведению итогов. Проведите финальное обсуждение и голосование, затем кнопкой [🚫 Выгнать] исключите еще ${excess} чел.!`);
          return;
        }

        if (App.state && !App.state.cardsRevealedOk) {
          const minRev = App.state.minRegularRevealed || 0;
          const reqRev = App.state.requiredRevealed || 7;
          if (!confirm(`⚠️ Внимание: У игроков открыто минимум по ${minRev} из ${reqRev} обязательных карт.\n\nВы уверены, что хотите завершить игру досрочно прямо сейчас?`)) {
            return;
          }
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

    // 7. TEAM RESOURCES MODAL
    const btnOpenRes = document.getElementById('btn-open-resources-modal');
    if (btnOpenRes) {
      btnOpenRes.addEventListener('click', () => {
        this.openTeamResourcesModal();
      });
    }

    const btnCloseRes = document.getElementById('btn-close-resources-modal');
    if (btnCloseRes) {
      btnCloseRes.addEventListener('click', () => {
        document.getElementById('modal-team-resources').classList.add('hidden');
      });
    }

    // 8. SPECIAL ACTION MODAL
    const btnCloseSpecial = document.getElementById('btn-close-special-modal');
    if (btnCloseSpecial) {
      btnCloseSpecial.addEventListener('click', () => {
        document.getElementById('modal-special-action').classList.add('hidden');
      });
    }

    const btnConfirmSpecial = document.getElementById('btn-confirm-special-action');
    if (btnConfirmSpecial) {
      btnConfirmSpecial.addEventListener('click', async () => {
        await this.confirmSpecialAction();
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
    if (select) {
      select.innerHTML = players.map(p => `
        <option value="${p.id}">${p.name} ${p.isExiled ? '(Изгнан)' : ''}</option>
      `).join('');
    }

    const selectCat = document.getElementById('select-reveal-cat');
    const categories = (App.state && App.state.categories) || [];
    if (selectCat && categories.length > 0) {
      selectCat.innerHTML = categories.map(c => `
        <option value="${c.key}">${c.icon} ${c.name}</option>
      `).join('');
    }

    App.playSound('click');
  },

  openShuffleSelectedModal() {
    const modal = document.getElementById('modal-shuffle-selected');
    if (!modal) return;
    modal.classList.remove('hidden');

    const players = (App.state && App.state.players) || [];
    const list = document.getElementById('shuffle-players-list');
    if (list) {
      list.innerHTML = players.map(p => `
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; font-size: 13px;">
          <input type="checkbox" value="${p.id}" checked>
          <span>${p.isHost ? '👑' : '👤'} <strong>${p.name}</strong> ${p.isExiled ? '<span class="text-red">(Изгнан)</span>' : ''}</span>
        </label>
      `).join('');
    }

    const selectCat = document.getElementById('select-shuffle-cat');
    const categories = (App.state && App.state.categories) || [];
    if (selectCat && categories.length > 0) {
      selectCat.innerHTML = categories.map(c => `
        <option value="${c.key}">${c.icon} ${c.name}</option>
      `).join('');
    }

    App.playSound('click');
  },

  openReplaceCardModal() {
    const modal = document.getElementById('modal-replace-card');
    if (!modal) return;
    modal.classList.remove('hidden');

    const players = (App.state && App.state.players) || [];
    const select = document.getElementById('select-replace-player');
    if (select) {
      select.innerHTML = players.map(p => `
        <option value="${p.id}">${p.name} ${p.isExiled ? '(Изгнан)' : ''}</option>
      `).join('');
    }

    const selectCat = document.getElementById('select-replace-cat');
    const categories = (App.state && App.state.categories) || [];
    if (selectCat && categories.length > 0) {
      selectCat.innerHTML = categories.map(c => `
        <option value="${c.key}">${c.icon} ${c.name}</option>
      `).join('');
    }

    App.playSound('click');
  },

  openTeamResourcesModal() {
    const modal = document.getElementById('modal-team-resources');
    if (!modal) return;
    modal.classList.remove('hidden');

    const res = (App.state && App.state.teamResources) || {};
    const container = document.getElementById('team-resources-modal-grid');
    if (container && typeof TagHelper !== 'undefined') {
      const defs = TagHelper.PARAM_DEFINITIONS;
      container.innerHTML = Object.entries(defs).map(([key, def]) => {
        const val = res[key] || 0;
        return `
          <div class="team-res-card" style="border-left: 4px solid ${def.color};">
            <div class="res-card-icon">${def.icon}</div>
            <div class="res-card-info">
              <div class="res-card-name">${def.name}</div>
              <div class="res-card-val" style="color: ${def.color}; font-weight: 900; font-size: 16px;">${val} pts</div>
            </div>
          </div>
        `;
      }).join('');
    }
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

    // Render team resources chips in evaluation modal
    const evalResChips = document.getElementById('eval-resources-chips');
    if (evalResChips && typeof TagHelper !== 'undefined') {
      const res = state.teamResources || {};
      const chips = Object.entries(TagHelper.PARAM_DEFINITIONS).map(([key, def]) => {
        const val = res[key] || 0;
        return `
          <span class="card-tag-chip" style="color: ${def.color}; background: ${def.bg}; border: 1px solid ${def.color}40; font-size: 11px;">
            ${def.icon} ${def.name}: <strong>${val}</strong>
          </span>
        `;
      }).join('');
      evalResChips.innerHTML = chips;
    }

    App.playSound('click');
  },

  // --- STATE RENDERER ---

  render(state) {
    const isMaster = state.isHost;

    // 0. Theme Background
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
      if (state.backgroundImage) {
        gameContainer.style.backgroundImage = `linear-gradient(rgba(11, 15, 23, 0.88), rgba(11, 15, 23, 0.88)), url('${state.backgroundImage}')`;
        gameContainer.style.backgroundSize = 'cover';
        gameContainer.style.backgroundPosition = 'center';
      } else {
        gameContainer.style.backgroundImage = '';
      }
    }

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
      const worldCount = (state.revealedThreatCards || []).length + (state.revealedBunkerCards || []).length;
      const worldLimit = state.worldCardsMaxLimit || 10;
      const threatPct = state.threatPercent !== undefined ? state.threatPercent : 50;
      const bunkerPct = 100 - threatPct;

      if (state.threatMode === 'timer') {
        const secs = state.threatTimerCountdown !== undefined ? state.threatTimerCountdown : 120;
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        statusBanner.innerHTML = `⏱️ ХАРДКОР: До карты мира: <strong class="threat-timer-badge">${timeStr}</strong> | Карт мира: <strong>${worldCount}/${worldLimit}</strong> (Угрозы ${threatPct}% / Бункер ${bunkerPct}%)`;
      } else {
        const minRev = state.minRegularRevealed !== undefined ? state.minRegularRevealed : (state.minRevealedCards || 0);
        const target = state.nextThreshold || Math.max(2, minRev + 1);
        const reqRev = state.requiredRevealed !== undefined ? state.requiredRevealed : 7;

        let hint = '';
        if (worldCount >= worldLimit) {
          hint = `🛑 Достигнут лимит карт мира (<strong>${worldCount}/${worldLimit}</strong>). Новые карты не будут открываться.`;
        } else if (minRev < 2) {
          hint = `Карт мира: <strong>${worldCount}/${worldLimit}</strong> | У всех открыто минимум по <strong>${minRev}</strong> карт. Первая карта мира откроется, когда все откроют минимум по <strong>2</strong> карты!`;
        } else if (minRev >= reqRev) {
          hint = `Карт мира: <strong>${worldCount}/${worldLimit}</strong> | Все обязательные карты (${reqRev}) открыты. 1 карта оставлена скрытой для интриги.`;
        } else {
          hint = `Карт мира: <strong>${worldCount}/${worldLimit}</strong> | У всех открыто минимум по <strong>${minRev}</strong> карт. Следующая карта откроется на шаге <strong>${target}</strong> (Угрозы: ${threatPct}%, Бункер: ${bunkerPct}%).`;
        }
        statusBanner.innerHTML = `📊 Режим по раундам: ${hint}`;
      }
    }

    const masterDrawBox = document.getElementById('master-draw-card-box');
    if (masterDrawBox) {
      if (isMaster) masterDrawBox.classList.remove('hidden');
      else masterDrawBox.classList.add('hidden');
    }

    // 5. Stats & Master +/- Capacity Buttons
    let activeCount = 0;
    let exiledCount = 0;
    state.players.forEach(p => {
      if (p.isExiled) exiledCount++;
      else activeCount++;
    });

    document.getElementById('stat-bunker-cap').textContent = state.bunkerCapacity;
    document.getElementById('stat-active-count').textContent = activeCount;
    document.getElementById('stat-exiled-count').textContent = exiledCount;

    // Master +- Capacity buttons
    const btnCapMinus = document.getElementById('btn-cap-minus');
    const btnCapPlus = document.getElementById('btn-cap-plus');
    if (btnCapMinus) {
      if (isMaster) btnCapMinus.classList.remove('hidden');
      else btnCapMinus.classList.add('hidden');
    }
    if (btnCapPlus) {
      if (isMaster) btnCapPlus.classList.remove('hidden');
      else btnCapPlus.classList.add('hidden');
    }

    // Excess Survivors Warning & Lock Indicator
    const excessWarn = document.getElementById('stat-excess-warning');
    const excessCountEl = document.getElementById('stat-excess-count');
    const btnFinishEl = document.getElementById('btn-finish-game');

    if (state.excessPlayers > 0) {
      if (excessWarn) excessWarn.classList.remove('hidden');
      if (excessCountEl) excessCountEl.textContent = state.excessPlayers;
      if (btnFinishEl) {
        btnFinishEl.classList.add('btn-disabled-lock');
        btnFinishEl.title = `В бункере перенаселение: лишних ${state.excessPlayers} чел.! Сначала проведите изгнание.`;
      }
    } else {
      if (excessWarn) excessWarn.classList.add('hidden');
      if (btnFinishEl) {
        btnFinishEl.classList.remove('btn-disabled-lock');
        btnFinishEl.title = 'Подвести итоги выживания в бункере';
      }
    }

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

    // Dynamically update table headers to match active categories
    const headerRow = document.getElementById('bunker-table-header-row');
    if (headerRow && categories.length > 0) {
      headerRow.innerHTML = `
        <th class="col-player">Выживший</th>
        ${categories.map(c => `<th class="col-card">${c.icon} ${c.name}</th>`).join('')}
        <th class="col-actions">Мастер</th>
      `;
    }

    tbody.innerHTML = state.players.map(player => {
      const isSelf = player.id === state.myId;
      const isExiled = player.isExiled;

      const cardCells = categories.map(cat => {
        const card = (player.cards && player.cards[cat.key]) || { text: '', revealed: false, canReveal: false };
        return `
          <td>
            ${this.renderCardHtml(player.id, player.name, cat, card, isSelf, isMaster)}
          </td>
        `;
      }).join('');

      // Master actions cell (Выгнать / Вернуть + Вскрыть карты для изгнанного)
      const masterActionsHtml = isMaster ? `
        <div style="display: flex; flex-direction: column; gap: 4px; padding-top: 4px;">
          <button class="btn btn-sm ${isExiled ? 'btn-success' : 'btn-danger'}" onclick="GameBoard.toggleExile('${player.id}')">
            ${isExiled ? '♻️ Вернуть' : '🚫 Выгнать'}
          </button>
          ${isExiled ? `
            <button class="btn btn-sm btn-outline" style="font-size: 10px; padding: 3px 5px; margin-top: 2px;" onclick="GameBoard.revealExiledAll('${player.id}')" title="Вскрыть все обычные карты изгнанного игрока (спец-карта останется скрытой)">
              👁️ Вскрыть карты
            </button>
          ` : ''}
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
    const isSpecial = category.isSpecial || category.key === 'special_cards';

    // Parse survival parameters (tags)
    const parsed = (typeof TagHelper !== 'undefined') ? TagHelper.parse(card.text) : { cleanText: card.text, tags: [] };
    const tagsHtml = (typeof TagHelper !== 'undefined') ? TagHelper.renderTagsHtml(parsed.tags) : '';
    const authorHtml = card.author ? `<span class="card-author-badge" title="Автор карты">✍️ ${card.author}</span>` : '';

    const backCoverStyle = (App.state && App.state.cardBackImage) ? `style="background-image: url('${App.state.cardBackImage}'); background-size: cover; background-position: center;"` : '';

    // CASE 1: Card is Revealed to Everyone (Front face displayed)
    if (isRevealed) {
      return `
        <div class="card-container" onclick="${isMaster ? `GameBoard.toggleCard('${playerId}', '${category.key}')` : ''}">
          <div class="bunker-card revealed">
            <div class="card-face card-back" ${backCoverStyle}>
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
              <div class="card-content-text">${parsed.cleanText}</div>
              ${tagsHtml ? `<div class="card-tags-badges">${tagsHtml}</div>` : ''}
              <div class="card-footer">
                ${authorHtml}
                <span style="font-size: 9px; color: var(--accent-cyan); margin-left: auto;">👁️ Открыта</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // CASE 2: Card is Hidden, Viewer is the Owner (Sees content privately + button to reveal / play)
    if (isSelf && hasText) {
      const revealBtnText = isSpecial ? '⚡ РАЗЫГРАТЬ' : '👁️ ПОКАЗАТЬ ВСЕМ';
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
              <div class="card-content-text">${parsed.cleanText}</div>
              ${tagsHtml ? `<div class="card-tags-badges">${tagsHtml}</div>` : ''}
              <div class="card-footer">
                ${authorHtml}
                <button class="btn-reveal-self ${isSpecial ? 'btn-special-play' : ''}" onclick="event.stopPropagation(); GameBoard.handleCardClick('${playerId}', '${category.key}', '${card.action || 'custom'}', ${isSpecial});">${revealBtnText}</button>
              </div>
            </div>
            <div class="card-face card-back" style="transform: rotateY(180deg);" ${backCoverStyle}>
              <div class="card-back-icon">${category.icon}</div>
              <div class="card-back-text">${category.name}</div>
            </div>
          </div>
        </div>
      `;
    }

    // CASE 3: Card is Hidden for other players (Standard mysterious back cover)
    const masterClickAction = isMaster ? `GameBoard.confirmMasterReveal('${playerId}', '${category.key}', '${category.name}', '${playerName}')` : '';

    return `
      <div class="card-container ${isMaster ? 'cursor-pointer' : ''}" onclick="${masterClickAction}">
        <div class="bunker-card">
          <div class="card-face card-back" ${backCoverStyle}>
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
            <div class="card-content-text">${parsed.cleanText || '—'}</div>
            ${tagsHtml ? `<div class="card-tags-badges">${tagsHtml}</div>` : ''}
            <div class="card-footer">${authorHtml}</div>
          </div>
        </div>
      </div>
    `;
  },

  // --- ACTIONS ---

  pendingSpecialAction: null,

  handleCardClick(playerId, categoryKey, actionType, isSpecial) {
    if (!isSpecial) {
      this.toggleCard(playerId, categoryKey);
      return;
    }

    // Special card action handler
    if (!actionType || actionType === 'custom') {
      if (confirm('Разыграть спец-карту и открыть ее для всех участников?')) {
        this.toggleCard(playerId, categoryKey);
      }
      return;
    }

    // Interactive action handler
    this.openSpecialActionModal(playerId, categoryKey, actionType);
  },

  openSpecialActionModal(playerId, categoryKey, actionType) {
    const modal = document.getElementById('modal-special-action');
    if (!modal) return;

    this.pendingSpecialAction = { playerId, categoryKey, actionType };
    modal.classList.remove('hidden');

    const state = App.state || {};
    const myPlayer = (state.players || []).find(p => p.id === playerId);
    const card = myPlayer ? myPlayer.cards[categoryKey] : null;
    const cardText = card ? (card.cleanText || card.text) : 'Спец-карта';

    const summaryBox = document.getElementById('special-card-summary-box');
    if (summaryBox) {
      summaryBox.innerHTML = `
        <div style="font-weight: 700; color: var(--accent-amber); margin-bottom: 4px;">⚡ Карта к розыгрышу:</div>
        <div style="font-size: 13px; color: #fff;">${cardText}</div>
      `;
    }

    const controls = document.getElementById('special-action-controls');
    if (!controls) return;
    controls.innerHTML = '';

    const otherPlayers = (state.players || []).filter(p => p.id !== playerId);
    const exiledPlayers = (state.players || []).filter(p => p.isExiled);
    const categories = (state.categories || []).filter(c => !c.isSpecial && c.key !== 'special_cards');
    const threats = state.revealedThreatCards || [];

    switch (actionType) {
      case 'bunker_cap_plus':
        controls.innerHTML = `
          <div style="font-size: 13px; color: var(--text-main);">
            ➕ Будет увеличена вместимость бункера на <strong>+1 место</strong> (теперь смогут спастись больше людей).
          </div>
        `;
        break;

      case 'bunker_cap_minus':
        controls.innerHTML = `
          <div style="font-size: 13px; color: var(--text-main);">
            ➖ Будет уменьшена вместимость бункера на <strong>-1 место</strong> (обвал жилого сектора).
          </div>
        `;
        break;

      case 'exile_immunity':
        controls.innerHTML = `
          <div style="font-size: 13px; color: var(--text-main);">
            🛡️ Вам будет присвоен <strong>иммунитет от изгнания</strong> на ближайшем голосовании!
          </div>
        `;
        break;

      case 'discard_threat':
        if (threats.length === 0) {
          controls.innerHTML = `<div style="font-size: 13px; color: var(--accent-amber);">На столе сейчас нет открытых карт угроз. Вы все равно можете сбросить карту.</div>`;
        } else {
          controls.innerHTML = `
            <div class="form-group">
              <label>Выберите активную угрозу для ликвидации:</label>
              <select id="select-special-threat" class="form-input">
                ${threats.map((t, idx) => `<option value="${idx}">⚠️ ${t.title || 'Угроза'}</option>`).join('')}
              </select>
            </div>
          `;
        }
        break;

      case 'spy_card':
        controls.innerHTML = `
          <div class="form-group">
            <label>Выберите игрока для шпионажа:</label>
            <select id="select-special-target" class="form-input">
              ${otherPlayers.map(p => `<option value="${p.id}">${p.name} ${p.isExiled ? '(Изгнан)' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Какую скрытую категорию изучить тайно:</label>
            <select id="select-special-cat" class="form-input">
              ${categories.map(c => `<option value="${c.key}">${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
          <p style="font-size: 11px; color: var(--text-dim);">* Значение карты увидите только вы в секретном окне!</p>
        `;
        break;

      case 'force_reveal_other':
        controls.innerHTML = `
          <div class="form-group">
            <label>У кого вскрыть карту для всех:</label>
            <select id="select-special-target" class="form-input">
              ${otherPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Какую карту принудительно раскрыть:</label>
            <select id="select-special-cat" class="form-input">
              ${categories.map(c => `<option value="${c.key}">${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
        `;
        break;

      case 'exchange_card':
        controls.innerHTML = `
          <div class="form-group">
            <label>С кем обменяться картой:</label>
            <select id="select-special-target" class="form-input">
              ${otherPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Какую категорию обменять (вы получите карту соперника, а он вашу):</label>
            <select id="select-special-cat" class="form-input">
              ${categories.map(c => `<option value="${c.key}">${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
        `;
        break;

      case 'reroll_card':
        controls.innerHTML = `
          <div class="form-group">
            <label>Какую свою карту сбросить и заменить на новую случайную:</label>
            <select id="select-special-cat" class="form-input">
              ${categories.map(c => `<option value="${c.key}">${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
        `;
        break;

      case 'resurrect_exiled':
        if (exiledPlayers.length === 0) {
          controls.innerHTML = `<div style="font-size: 13px; color: var(--text-dim);">Пока никто не был изгнан из бункера.</div>`;
        } else {
          controls.innerHTML = `
            <div class="form-group">
              <label>Кого вернуть обратно в бункер:</label>
              <select id="select-special-target" class="form-input">
                ${exiledPlayers.map(p => `<option value="${p.id}">💀 ${p.name}</option>`).join('')}
              </select>
            </div>
          `;
        }
        break;

      default:
        controls.innerHTML = `<div style="font-size: 13px; color: var(--text-main);">Подтвердите розыгрыш карты для стола.</div>`;
        break;
    }

    App.playSound('click');
  },

  async confirmSpecialAction() {
    if (!this.pendingSpecialAction) return;
    const { actionType } = this.pendingSpecialAction;

    const params = {};
    const targetSelect = document.getElementById('select-special-target');
    if (targetSelect) params.targetPlayerId = targetSelect.value;

    const catSelect = document.getElementById('select-special-cat');
    if (catSelect) params.categoryKey = catSelect.value;

    const threatSelect = document.getElementById('select-special-threat');
    if (threatSelect) params.threatIndex = parseInt(threatSelect.value, 10);

    try {
      App.playSound('flip');
      const res = await App.sendAction('play_special_action', { actionType, params });
      document.getElementById('modal-special-action').classList.add('hidden');

      if (res && res.spyResult) {
        alert(`🔍 СЕКРЕТНЫЕ ДАННЫЕ ШПИОНАЖА:\n\nИгрок: ${res.spyResult.targetPlayerName}\nХарактеристика: [${res.spyResult.categoryName}]\nЗначение: "${res.spyResult.cardText}"\n\n(Эта информация видна только вам!)`);
      } else {
        App.showToast('⚡ Спец-карта успешно разыграна!');
      }
    } catch (e) {
      App.showToast(`Ошибка: ${e.message}`);
    }
  },

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

  async revealExiledAll(targetPlayerId) {
    if (confirm('Вскрыть все обычные карты этого изгнанного игрока для всех? (Спец-карта останется скрытой)')) {
      try {
        App.playSound('flip');
        await App.sendAction('reveal_exiled_all', { targetPlayerId });
        App.showToast('👁️ Все обычные карты игрока вскрыты!');
      } catch (e) {}
    }
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

    if (results.teamResources && typeof TagHelper !== 'undefined') {
      const defs = TagHelper.PARAM_DEFINITIONS;
      const chipsHtml = Object.entries(defs).map(([key, def]) => {
        const val = results.teamResources[key] || 0;
        return `
          <span class="card-tag-chip" style="color: ${def.color}; background: ${def.bg}; border: 1px solid ${def.color}40; font-size: 12px; padding: 3px 8px;">
            ${def.icon} ${def.name}: <strong>+${val}</strong>
          </span>
        `;
      }).join('');

      verdictBox.innerHTML += `
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="font-size: 12px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">📊 Совокупные ресурсы команды:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">${chipsHtml}</div>
        </div>
      `;
    }

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
