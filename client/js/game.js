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

        if (App.state && App.state.excessPlayers > 1) {
          App.showToast(`⚠️ В бункере слишком много лишних (${App.state.excessPlayers} чел.). Допускается максимум +1 перенаселение!`);
          return;
        }

        if (App.state && App.state.excessPlayers === 1) {
          if (!confirm('⚠️ ВНИМАНИЕ: В бункере перенаселение (+1 лишний человек)!\n\nКоманда пожертвует комфортом и психологическим здоровьем (штраф -20% к выживанию).\n\nПерейти к анкете выживания?')) {
            return;
          }
        }

        if (App.state && !App.state.cardsRevealedOk) {
          const minRev = App.state.minRegularRevealed || 0;
          const reqRev = App.state.requiredRevealed || 7;
          if (!confirm(`⚠️ Внимание: У некоторых выживших открыто только ${minRev} из ${reqRev} обязательных карт.\n\nПодвести итоги выживания прямо сейчас?`)) {
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

        const answers = {};
        document.querySelectorAll('.eval-question-block').forEach((block, idx) => {
          const qId = block.getAttribute('data-qid') || `q_${idx}`;
          const checked = block.querySelector('input[type="radio"]:checked');
          if (checked) {
            answers[qId] = checked.value;
          }
        });

        const disasterCondition = document.querySelector('input[name="eval-disaster-condition"]:checked')?.value || 'ok';

        const bunkerStatuses = [];
        (App.state && App.state.revealedBunkerCards || []).forEach((_, idx) => {
          const val = document.querySelector(`input[name="eval-bunker-${idx}"]:checked`)?.value || 'ok';
          bunkerStatuses.push(val);
        });

        const threatStatuses = [];
        (App.state && App.state.revealedThreatCards || []).forEach((_, idx) => {
          const val = document.querySelector(`input[name="eval-threat-${idx}"]:checked`)?.value || 'resolved';
          threatStatuses.push(val);
        });

        try {
          await App.sendAction('submit_evaluation', {
            evaluation: {
              supplies,
              medicine,
              specialists,
              defense,
              psychology,
              answers,
              disasterCondition,
              bunkerStatuses,
              threatStatuses
            }
          });
          document.getElementById('modal-evaluation').classList.add('hidden');
          App.playSound('start');
        } catch (e) {
          App.showToast(`Ошибка: ${e.message}`);
        }
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

    // Results Page Actions
    const btnResultsLobby = document.getElementById('btn-results-to-lobby');
    if (btnResultsLobby) {
      btnResultsLobby.addEventListener('click', async () => {
        if (App.isHost) {
          if (confirm('Сбросить игру и вернуть всех участников в лобби?')) {
            await App.sendAction('reset_lobby');
            App.playSound('click');
          }
        } else {
          App.showToast('Ожидание решения Мастера о возврате в лобби...');
        }
      });
    }

    const btnResultsToTable = document.getElementById('btn-results-to-table');
    if (btnResultsToTable) {
      btnResultsToTable.addEventListener('click', () => {
        App.showScreen('screen-game');
        App.playSound('click');
      });
    }

    const btnBackToResults = document.getElementById('btn-back-to-results');
    if (btnBackToResults) {
      btnBackToResults.addEventListener('click', () => {
        App.showScreen('screen-results');
        App.playSound('click');
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

    // 9. SPEAKER / DEBATE TIMER CONTROLS
    const btnTimerTrigger = document.getElementById('btn-timer-trigger');
    const timerMenu = document.getElementById('timer-presets-menu');
    if (btnTimerTrigger && timerMenu) {
      btnTimerTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        timerMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', () => {
        timerMenu.classList.add('hidden');
      });
      document.querySelectorAll('.btn-preset-time').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          timerMenu.classList.add('hidden');
          const secs = parseInt(btn.getAttribute('data-seconds'), 10) || 30;
          try {
            await App.sendAction('start_speaker_timer', { seconds: secs });
            App.playSound('click');
          } catch (err) {
            App.showToast(`Ошибка: ${err.message}`);
          }
        });
      });
    }

    const btnTimerStop = document.getElementById('btn-timer-stop');
    if (btnTimerStop) {
      btnTimerStop.addEventListener('click', async () => {
        try {
          await App.sendAction('stop_speaker_timer');
          App.playSound('click');
        } catch (err) {}
      });
    }

    // 10. EXPULSION VOTING CONTROLS
    const btnOpenVoting = document.getElementById('btn-open-voting-modal');
    if (btnOpenVoting) {
      btnOpenVoting.addEventListener('click', () => {
        const modal = document.getElementById('modal-voting');
        if (modal) {
          modal.classList.remove('hidden');
          if (App.state && App.state.voting) {
            this.renderVotingModalContent(App.state.voting, App.state);
          }
        }
      });
    }

    const btnMasterStartVoting = document.getElementById('btn-master-start-voting');
    if (btnMasterStartVoting) {
      btnMasterStartVoting.addEventListener('click', async () => {
        if (!confirm('Объявить голосование на изгнание из бункера среди всех активных выживших?')) return;
        try {
          await App.sendAction('start_voting');
          const modal = document.getElementById('modal-voting');
          if (modal) {
            modal.classList.remove('hidden');
            if (App.state && App.state.voting) {
              this.renderVotingModalContent(App.state.voting, App.state);
            }
          }
          App.playSound('start');
        } catch (err) {
          App.showToast(`Ошибка: ${err.message}`);
        }
      });
    }

    const btnCloseVoting = document.getElementById('btn-close-voting-modal');
    if (btnCloseVoting) {
      btnCloseVoting.addEventListener('click', () => {
        document.getElementById('modal-voting').classList.add('hidden');
      });
    }

    const btnEndVoting = document.getElementById('btn-end-voting-now');
    if (btnEndVoting) {
      btnEndVoting.addEventListener('click', async () => {
        if (!confirm('Подвести итоги текущего голосования и исключить набравшего большинство?')) return;
        try {
          await App.sendAction('end_voting');
          App.playSound('flip');
        } catch (err) {
          App.showToast(`Ошибка: ${err.message}`);
        }
      });
    }

    const btnCancelVoting = document.getElementById('btn-cancel-voting');
    if (btnCancelVoting) {
      btnCancelVoting.addEventListener('click', async () => {
        if (!confirm('Отменить голосование?')) return;
        try {
          await App.sendAction('cancel_voting');
          document.getElementById('modal-voting').classList.add('hidden');
          App.playSound('click');
        } catch (err) {}
      });
    }

    // 11. CARD ZOOM MODAL EVENTS
    const btnCloseZoom = document.getElementById('btn-close-zoom-modal');
    if (btnCloseZoom) {
      btnCloseZoom.addEventListener('click', () => {
        document.getElementById('modal-card-zoom').classList.add('hidden');
      });
    }
    const modalZoom = document.getElementById('modal-card-zoom');
    if (modalZoom) {
      modalZoom.addEventListener('click', (e) => {
        if (e.target === modalZoom) modalZoom.classList.add('hidden');
      });
    }

    // 12. FINALE ROULETTE SPIN
    const btnSpinRoulette = document.getElementById('btn-spin-roulette');
    if (btnSpinRoulette) {
      btnSpinRoulette.addEventListener('click', () => {
        this.spinRouletteAnimation();
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

    const cap = state.bunkerCapacity || 3;
    const bunkerCapEl = document.getElementById('eval-bunker-cap');
    if (bunkerCapEl) bunkerCapEl.textContent = cap;

    const survEl = document.getElementById('eval-survivors-count');
    if (survEl) {
      survEl.textContent = survivorsCount;
      survEl.className = survivorsCount > cap ? 'text-red' : 'text-green';
    }

    const noteEl = document.getElementById('eval-capacity-status-note');
    if (noteEl) {
      if (survivorsCount > cap) {
        const excess = survivorsCount - cap;
        noteEl.innerHTML = `<span class="text-red">⚠️ <strong>Перенаселение (+${excess} чел.)</strong>: При расчете будет применен штраф -${excess * 20}% к выживаемости!</span>`;
      } else {
        noteEl.innerHTML = `<span class="text-green">✅ Мест в бункере достаточно для всех ${survivorsCount} выживших.</span>`;
      }
    }

    // Resources to display: prefer finalTeamResources (all cards of survivors) or live teamResources
    const res = state.finalTeamResources || state.teamResources || {};

    const questionsCol = document.querySelector('.eval-questions-col');
    if (questionsCol && state.evaluationConfig && Array.isArray(state.evaluationConfig.questions) && state.evaluationConfig.questions.length > 0) {
      const questions = state.evaluationConfig.questions;
      let qHtml = `
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
          Мастер отвечает на вопросы анкеты набора (${questions.length} шт.), оценивая готовность команды:
        </p>
      `;
      questions.forEach((q, idx) => {
        let resBadge = '';
        if (q.linkedResource && q.linkedResource !== 'none') {
          const def = (typeof TagHelper !== 'undefined') ? TagHelper.PARAM_DEFINITIONS[q.linkedResource] : null;
          const val = res[q.linkedResource] || 0;
          if (def) {
            resBadge = `<span class="card-tag-chip" style="color: ${def.color}; background: ${def.bg}; border: 1px solid ${def.color}40; font-size: 11px;">${def.icon} ${def.name}: +${val}</span>`;
          }
        }

        const optsHtml = (q.options || []).map((opt, oIdx) => `
          <label class="eval-opt">
            <input type="radio" name="eval-custom-q-${idx}" value="${opt.score}" ${oIdx === Math.min(2, (q.options.length - 1)) ? 'checked' : ''}>
            <span>${opt.label}</span>
          </label>
        `).join('');

        qHtml += `
          <div class="eval-question-block" data-qid="${q.id}">
            <div class="eval-q-header">
              <label class="eval-q-title">${q.title}</label>
              <div class="eval-q-res-chip">${resBadge}</div>
            </div>
            <div class="eval-options-grid">${optsHtml}</div>
          </div>
        `;
      });
      questionsCol.innerHTML = qHtml;
    } else {
      // 1. Per-Question Matching Resource Badges for standard questions
      const q1 = document.getElementById('eval-q-res-1');
      if (q1) q1.innerHTML = `<span class="card-tag-chip" style="color: #f59e0b; background: rgba(245,158,11,0.12); border: 1px solid #f59e0b40; font-size: 11px;">🍞 Провизия команды: +${res.food || 0}</span>`;

      const q2 = document.getElementById('eval-q-res-2');
      if (q2) q2.innerHTML = `<span class="card-tag-chip" style="color: #10b981; background: rgba(16,185,129,0.12); border: 1px solid #10b98140; font-size: 11px;">💊 Медицина команды: +${res.medicine || 0}</span>`;

      const q3 = document.getElementById('eval-q-res-3');
      if (q3) q3.innerHTML = `
        <span class="card-tag-chip" style="color: #6366f1; background: rgba(99,102,241,0.12); border: 1px solid #6366f140; font-size: 11px;">⚙️ Инженерия: +${res.engineering || 0}</span>
        <span class="card-tag-chip" style="color: #06b6d4; background: rgba(6,182,212,0.12); border: 1px solid #06b6d440; font-size: 11px;">🔬 Наука: +${res.science || 0}</span>
      `;

      const q4 = document.getElementById('eval-q-res-4');
      if (q4) q4.innerHTML = `
        <span class="card-tag-chip" style="color: #ef4444; background: rgba(239,68,68,0.12); border: 1px solid #ef444440; font-size: 11px;">🧯 Пожаротушение: +${res.fire || 0}</span>
        <span class="card-tag-chip" style="color: #3b82f6; background: rgba(59,130,246,0.12); border: 1px solid #3b82f640; font-size: 11px;">🛡️ Оборона/Защита: +${res.defense || 0}</span>
      `;

      const q5 = document.getElementById('eval-q-res-5');
      if (q5) q5.innerHTML = `<span class="card-tag-chip" style="color: #a855f7; background: rgba(168,85,247,0.12); border: 1px solid #a855f740; font-size: 11px;">🧠 Психика и сон: +${res.psycho || 0}</span>`;
    }

    // 2. Right Reference Column: Catastrophe
    const disTitle = document.getElementById('eval-ref-disaster-title');
    const disGoal = document.getElementById('eval-ref-disaster-goal');
    if (disTitle && disGoal) {
      disTitle.textContent = state.disaster ? state.disaster.title : 'Глобальная катастрофа';
      disGoal.textContent = state.disaster ? (state.disaster.goal || state.disaster.description || 'Выжить любой ценой') : 'Выжить любой ценой';
    }

    // 3. Right Reference Column: Bunker Cards
    const bunkerCountEl = document.getElementById('eval-ref-bunker-count');
    const bunkerListEl = document.getElementById('eval-ref-bunker-list');
    const bunkerCards = state.revealedBunkerCards || [];
    if (bunkerCountEl) bunkerCountEl.textContent = bunkerCards.length;
    if (bunkerListEl) {
      if (bunkerCards.length === 0) {
        bunkerListEl.innerHTML = '<div class="eval-empty-note text-dim">На столе пока нет открытых карт бункера.</div>';
      } else {
        bunkerListEl.innerHTML = bunkerCards.map((c, idx) => `
          <div class="eval-ref-item bunker">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
              <strong class="eval-ref-item-title">🛡️ ${c.title || 'Отсек бункера'}</strong>
              <div style="display: flex; gap: 8px; font-size: 11px;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <input type="radio" name="eval-bunker-${idx}" value="ok" checked>
                  <span style="color: var(--accent-green); font-weight: 600;">✅ Все хорошо</span>
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <input type="radio" name="eval-bunker-${idx}" value="failed">
                  <span style="color: var(--accent-red); font-weight: 600;">⚠️ Сломано</span>
                </label>
              </div>
            </div>
            <div class="eval-ref-item-desc">${c.description || ''}</div>
          </div>
        `).join('');
      }
    }

    // 4. Right Reference Column: Threat Cards
    const threatCountEl = document.getElementById('eval-ref-threats-count');
    const threatListEl = document.getElementById('eval-ref-threats-list');
    const threatCards = state.revealedThreatCards || [];
    if (threatCountEl) threatCountEl.textContent = threatCards.length;
    if (threatListEl) {
      if (threatCards.length === 0) {
        threatListEl.innerHTML = '<div class="eval-empty-note text-dim">На столе пока нет открытых карт угроз.</div>';
      } else {
        threatListEl.innerHTML = threatCards.map((c, idx) => `
          <div class="eval-ref-item threat">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
              <strong class="eval-ref-item-title">⚠️ ${c.title || 'Угроза'}</strong>
              <div style="display: flex; gap: 8px; font-size: 11px;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <input type="radio" name="eval-threat-${idx}" value="resolved" checked>
                  <span style="color: var(--accent-green); font-weight: 600;">✅ Все хорошо (устранена)</span>
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <input type="radio" name="eval-threat-${idx}" value="active">
                  <span style="color: var(--accent-red); font-weight: 600;">💀 Угроза осталась</span>
                </label>
              </div>
            </div>
            <div class="eval-ref-item-desc">${c.description || ''}</div>
          </div>
        `).join('');
      }
    }

    // 5. Full Summary Chips
    const evalResChips = document.getElementById('eval-resources-chips');
    if (evalResChips && typeof TagHelper !== 'undefined') {
      const chips = Object.entries(TagHelper.PARAM_DEFINITIONS).map(([key, def]) => {
        const val = res[key] || 0;
        return `
          <span class="card-tag-chip" style="color: ${def.color}; background: ${def.bg}; border: 1px solid ${def.color}40; font-size: 11px;">
            ${def.icon} ${def.name}: <strong>+${val}</strong>
          </span>
        `;
      }).join('');
      evalResChips.innerHTML = chips;
    }

    App.playSound('click');
  },

  // --- CARD ZOOM MODAL (УВЕЛИЧЕНИЕ КАРТЫ ПО КЛИКУ) ---
  openCardZoom(playerId, categoryKey) {
    const player = (App.state && App.state.players || []).find(p => p.id === playerId);
    if (!player) return;
    const card = player.cards && player.cards[categoryKey];
    if (!card) return;

    const catObj = (App.state && App.state.categories || []).find(c => c.key === categoryKey) || { icon: '🏷️', name: categoryKey };
    const isSelf = playerId === App.state.myId;
    const isMaster = App.isHost;
    const isRevealed = card.revealed;

    // If card is completely hidden and viewer is neither owner nor master, nothing to inspect
    if (!isRevealed && !isSelf && App.state.status !== 'finished') {
      if (isMaster) {
        this.confirmMasterReveal(playerId, categoryKey, catObj.name, player.name);
      }
      return;
    }

    const modal = document.getElementById('modal-card-zoom');
    if (!modal) return;

    const playerEl = document.getElementById('zoom-card-player');
    if (playerEl) {
      playerEl.innerHTML = `${player.isHost ? '👑' : '👤'} Карточка игрока: <strong>${player.name}</strong> ${isSelf ? '<span class="role-badge" style="font-size: 10px;">(Вы)</span>' : ''}`;
    }

    document.getElementById('zoom-cat-icon').textContent = catObj.icon || '🏷️';
    document.getElementById('zoom-cat-name').textContent = catObj.name || categoryKey;

    const statusBadge = document.getElementById('zoom-status-badge');
    if (statusBadge) {
      if (isRevealed) {
        statusBadge.textContent = '👁️ Открыта для всех';
        statusBadge.className = 'zoom-status-badge revealed';
      } else {
        statusBadge.textContent = '🔒 Ваша скрытая карта';
        statusBadge.className = 'zoom-status-badge hidden-self';
      }
    }

    const parsed = (typeof TagHelper !== 'undefined') ? TagHelper.parse(card.text) : { cleanText: card.text, tags: [] };
    document.getElementById('zoom-card-text').textContent = parsed.cleanText || '—';

    const tagsContainer = document.getElementById('zoom-card-tags');
    if (tagsContainer) {
      tagsContainer.innerHTML = (typeof TagHelper !== 'undefined') ? TagHelper.renderTagsHtml(parsed.tags) : '';
    }

    const authorEl = document.getElementById('zoom-card-author');
    if (authorEl) {
      authorEl.textContent = card.author ? `✍️ Автор: ${card.author}` : `✍️ Бункер`;
    }

    // Action buttons inside zoom modal
    const actionsEl = document.getElementById('zoom-card-actions');
    if (actionsEl) {
      let actionsHtml = '';
      const isSpecial = catObj.isSpecial || categoryKey === 'special_cards';

      if (isSelf && !isRevealed) {
        if (isSpecial) {
          actionsHtml += `
            <button class="btn btn-warning btn-block" onclick="document.getElementById('modal-card-zoom').classList.add('hidden'); GameBoard.handleCardClick('${playerId}', '${categoryKey}', '${card.action || 'custom'}', true);">
              ⚡ РАЗЫГРАТЬ СПЕЦ-КАРТУ
            </button>
          `;
        } else {
          actionsHtml += `
            <button class="btn btn-primary btn-block" onclick="document.getElementById('modal-card-zoom').classList.add('hidden'); GameBoard.handleCardClick('${playerId}', '${categoryKey}', '', false);">
              👁️ ПОКАЗАТЬ ВСЕМ УЧАСТНИКАМ
            </button>
          `;
        }
      }

      if (isMaster) {
        actionsHtml += `
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-warning" style="flex: 1;" onclick="document.getElementById('modal-card-zoom').classList.add('hidden'); GameBoard.openReplaceForCard('${playerId}', '${categoryKey}');">
              🎲 Заменить карту
            </button>
            ${!isRevealed ? `
              <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="document.getElementById('modal-card-zoom').classList.add('hidden'); GameBoard.toggleCard('${playerId}', '${categoryKey}');">
                👁️ Вскрыть для всех
              </button>
            ` : ''}
          </div>
        `;
      }

      actionsEl.innerHTML = actionsHtml;
    }

    modal.classList.remove('hidden');
    App.playSound('flip');
  },

  openReplaceForCard(playerId, categoryKey) {
    this.openReplaceCardModal();
    const pSelect = document.getElementById('select-replace-player');
    const cSelect = document.getElementById('select-replace-cat');
    if (pSelect) pSelect.value = playerId;
    if (cSelect) cSelect.value = categoryKey;
  },

  // --- SPEAKER TIMER UI ---
  updateSpeakerTimerUI(speakerTimer) {
    const idleBox = document.getElementById('timer-idle-controls');
    const activeBox = document.getElementById('timer-active-display');
    const countText = document.getElementById('timer-countdown-text');
    if (!idleBox || !activeBox || !countText) return;

    if (speakerTimer && speakerTimer.active) {
      idleBox.classList.add('hidden');
      activeBox.classList.remove('hidden');
      const secs = speakerTimer.secondsLeft || 0;
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      countText.textContent = `⏱️ ${m}:${s.toString().padStart(2, '0')}`;
      this.timerAlarmPlayed = false;
    } else if (speakerTimer && speakerTimer.timeRanOut) {
      idleBox.classList.add('hidden');
      activeBox.classList.remove('hidden');
      countText.textContent = `🔔 0:00 (ВРЕМЯ!)`;
      if (!this.timerAlarmPlayed) {
        this.timerAlarmPlayed = true;
        App.playSound('timer_alarm');
        App.showToast(`🔔 ВРЕМЯ НА ВЫСТУПЛЕНИЕ (${speakerTimer.totalSeconds}с) ВЫШЛО!`);
      }
    } else {
      idleBox.classList.remove('hidden');
      activeBox.classList.add('hidden');
      this.timerAlarmPlayed = false;
    }
  },

  // --- EXPULSION VOTING UI ---
  updateVotingUI(voting, state) {
    const btnOpenVoting = document.getElementById('btn-open-voting-modal');
    const modal = document.getElementById('modal-voting');
    if (!btnOpenVoting) return;

    if (voting && voting.active) {
      btnOpenVoting.classList.remove('hidden');
      if (modal && !modal.classList.contains('hidden')) {
        this.renderVotingModalContent(voting, state);
      }
    } else {
      btnOpenVoting.classList.add('hidden');
      if (modal && !modal.classList.contains('hidden') && this.votingWasActive) {
        modal.classList.add('hidden');
      }
    }
    this.votingWasActive = Boolean(voting && voting.active);
  },

  renderVotingModalContent(voting, state) {
    if (!voting) return;
    const isMaster = App.isHost;
    const myId = state.myId;
    const myVote = voting.myVote;

    const tieBanner = document.getElementById('voting-tie-banner');
    if (tieBanner) {
      if (voting.isRevote) tieBanner.classList.remove('hidden');
      else tieBanner.classList.add('hidden');
    }

    const titleEl = document.getElementById('voting-modal-title');
    if (titleEl) {
      titleEl.textContent = voting.isRevote ? '⚖️ ПЕРЕГОЛОСОВАНИЕ (НИЧЬЯ)' : '🗳️ Голосование на изгнание';
    }

    const grid = document.getElementById('voting-candidates-grid');
    if (grid) {
      const candidates = voting.candidates || [];
      grid.innerHTML = candidates.map(cId => {
        const p = (state.players || []).find(pl => pl.id === cId) || { name: cId, id: cId };
        const isMyPick = (myVote === cId);
        const votesForCand = (voting.votes) ? Object.values(voting.votes).filter(t => t === cId).length : null;

        return `
          <div class="voting-candidate-card ${isMyPick ? 'my-vote' : ''}" onclick="GameBoard.castVote('${cId}')">
            <div class="cand-left">
              <span class="cand-avatar">${p.isHost ? '👑' : '👤'}</span>
              <div>
                <div class="cand-name">${p.name}</div>
                ${isMyPick ? '<small style="color: var(--accent-red); font-weight: 700;">✓ Ваш голос</small>' : ''}
              </div>
            </div>
            ${(isMaster && votesForCand !== null) ? `<span class="cand-votes-chip">${votesForCand} гол.</span>` : ''}
          </div>
        `;
      }).join('');
    }

    const statusEl = document.getElementById('voting-my-status');
    if (statusEl) {
      if (myVote) {
        const targetPl = (state.players || []).find(pl => pl.id === myVote);
        statusEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 700;">✓ Вы проголосовали против: ${targetPl ? targetPl.name : 'кандидата'}.</span> <span style="color: var(--text-dim); font-size: 11px;">(Кликните по другому кандидату, чтобы изменить свой голос)</span>`;
      } else {
        statusEl.innerHTML = `<span style="color: var(--accent-amber); font-weight: 700;">⏳ Вы еще не отдали голос. Выберите кандидата из списка выше!</span>`;
      }
    }

    const masterPanel = document.getElementById('voting-master-panel');
    if (masterPanel) {
      if (isMaster) masterPanel.classList.remove('hidden');
      else masterPanel.classList.add('hidden');
    }
  },

  async castVote(candidateId) {
    try {
      App.playSound('click');
      await App.sendAction('cast_vote', { targetPlayerId: candidateId });
      App.showToast('🗳️ Ваш голос учтен!');
    } catch (e) {
      App.showToast(`Ошибка: ${e.message}`);
    }
  },

  // --- FINALE ROULETTE LOGIC ---
  setupRoulette(results) {
    if (!results) return;
    this.resultsCache = results;

    const chanceVal = document.getElementById('roulette-chance-val');
    if (chanceVal) chanceVal.textContent = results.percentage;

    const thresholdVal = document.getElementById('roulette-threshold-val');
    const threshold = results.threshold !== undefined ? results.threshold : (101 - results.percentage);
    if (thresholdVal) thresholdVal.textContent = threshold;

    const cube = document.getElementById('roulette-cube');
    const numEl = document.getElementById('roulette-number');
    const btnSpin = document.getElementById('btn-spin-roulette');
    const banner = document.getElementById('roulette-outcome-banner');

    if (cube) cube.className = 'roulette-cube';
    if (numEl) numEl.textContent = 'GO';
    if (btnSpin) {
      btnSpin.disabled = false;
      btnSpin.textContent = '⚡ ПРОВЕРИТЬ ВЫЖИВАНИЕ (КУБИК)';
    }
    if (banner) {
      banner.className = 'roulette-outcome-banner hidden';
      banner.textContent = '';
    }
  },

  async spinRouletteAnimation() {
    const results = this.resultsCache || (App.state && App.state.results);
    if (!results) return;

    const btnSpin = document.getElementById('btn-spin-roulette');
    const cube = document.getElementById('roulette-cube');
    const numEl = document.getElementById('roulette-number');
    const banner = document.getElementById('roulette-outcome-banner');

    if (btnSpin) {
      btnSpin.disabled = true;
      btnSpin.textContent = '⏳ СУДЬБА ВЕРШИТСЯ...';
    }
    if (cube) cube.className = 'roulette-cube spinning';
    if (banner) banner.classList.add('hidden');

    // Delays increasing from fast up to maximum 1.0 second (1000ms)
    const delays = [40, 45, 50, 60, 75, 95, 120, 160, 215, 290, 390, 520, 700, 1000];

    for (let i = 0; i < delays.length; i++) {
      await new Promise(resolve => setTimeout(resolve, delays[i]));
      const fakeNum = Math.floor(Math.random() * 100) + 1;
      if (numEl) numEl.textContent = fakeNum;
      App.playSound('roulette_tick');
    }

    // Final Stop on real diceRoll
    const finalRoll = results.diceRoll;
    const threshold = results.threshold !== undefined ? results.threshold : (101 - results.percentage);
    const isSuccess = Boolean(results.isSuccess);

    if (numEl) numEl.textContent = finalRoll;

    if (cube) {
      cube.className = `roulette-cube ${isSuccess ? 'winner' : 'loser'}`;
    }

    if (banner) {
      banner.classList.remove('hidden');
      if (isSuccess) {
        banner.className = 'roulette-outcome-banner success';
        banner.innerHTML = `🎉 ПОБЕДА! Выпало число <strong>${finalRoll}</strong> (требовалось ≥ <strong>${threshold}</strong>). БУНКЕР ВЫЖИЛ!`;
        App.playSound('fanfare');
      } else {
        banner.className = 'roulette-outcome-banner danger';
        banner.innerHTML = `💀 ПОРАЖЕНИЕ! Выпало число <strong>${finalRoll}</strong> (требовалось ≥ <strong>${threshold}</strong>). БУНКЕР ПОГИБ!`;
        App.playSound('fail_horn');
      }
    }

    if (btnSpin) {
      btnSpin.disabled = false;
      btnSpin.textContent = '🔄 ПОВТОРИТЬ ПРОВЕРКУ';
    }

    const verdictBox = document.getElementById('results-verdict-box');
    if (verdictBox) {
      verdictBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  // --- STATE RENDERER ---

  render(state) {
    const isMaster = state.isHost;

    // 0a. Speaker Timer UI
    this.updateSpeakerTimerUI(state.speakerTimer);

    // 0b. Voting UI
    this.updateVotingUI(state.voting, state);

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

    if (state.excessPlayers > 1) {
      if (excessWarn) excessWarn.classList.remove('hidden');
      if (excessCountEl) excessCountEl.textContent = state.excessPlayers;
      if (btnFinishEl) {
        btnFinishEl.classList.add('btn-disabled-lock');
        btnFinishEl.title = `В бункере слишком много лишних (${state.excessPlayers} чел.)! Максимум перенаселения: +1 чел. Проведите изгнание.`;
      }
    } else if (state.excessPlayers === 1) {
      if (excessWarn) {
        excessWarn.classList.remove('hidden');
        if (excessCountEl) excessCountEl.textContent = 1;
      }
      if (btnFinishEl) {
        btnFinishEl.classList.remove('btn-disabled-lock');
        btnFinishEl.title = 'Подвести итоги (перенаселение +1 чел., штраф к психике -20%)';
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
          <td class="cell-card">
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
          <td class="cell-actions" style="min-width: 130px; text-align: center; vertical-align: top !important;">
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
        <div class="card-container cursor-pointer" onclick="GameBoard.openCardZoom('${playerId}', '${category.key}')">
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
                <span style="font-size: 9px; color: var(--accent-cyan); margin-left: auto;">🔍 Увеличить</span>
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
        <div class="card-container cursor-pointer" onclick="GameBoard.openCardZoom('${playerId}', '${category.key}')">
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

  detectSpecialAction(text) {
    if (!text) return 'custom';
    const t = text.toLowerCase();
    if (t.includes('+1') || t.includes('увеличит') || t.includes('увеличива') || t.includes('расширение убежищ') || (t.includes('вместимост') && t.includes('+'))) {
      return 'bunker_cap_plus';
    }
    if (t.includes('-1') || (t.includes('вместимост') && (t.includes('-') || t.includes('уменьш')))) {
      return 'bunker_cap_minus';
    }
    if (t.includes('иммунитет') || t.includes('второе дыхание') || t.includes('отмените свое изгнание')) {
      return 'exile_immunity';
    }
    if (t.includes('ликвидаци') || t.includes('сброс угроз') || t.includes('предотвращен') || t.includes('огнезащита бункера')) {
      return 'discard_threat';
    }
    if (t.includes('помилован') || t.includes('верните') || t.includes('возвращен') || t.includes('воскреш')) {
      return 'resurrect_exiled';
    }
    if (t.includes('обмен') || t.includes('поменяться картой') || t.includes('равноценный обмен')) {
      return 'exchange_card';
    }
    if (t.includes('замените') || t.includes('сбросьте свою') || t.includes('второй шанс') || t.includes('перераспредел')) {
      return 'reroll_card';
    }
    return 'custom';
  },

  handleCardClick(playerId, categoryKey, actionType, isSpecial) {
    if (!isSpecial) {
      this.toggleCard(playerId, categoryKey);
      return;
    }

    const state = App.state || {};
    const myPlayer = (state.players || []).find(p => p.id === playerId);
    const card = myPlayer ? myPlayer.cards[categoryKey] : null;
    const cardText = card ? (card.cleanText || card.text) : '';

    const effectiveAction = (actionType && actionType !== 'custom')
      ? actionType
      : (card?.action || this.detectSpecialAction(cardText));

    // Fast direct confirmation for capacity changes and immunity
    if (effectiveAction === 'bunker_cap_plus') {
      if (confirm(`Разыграть спец-карту «${cardText || 'Расширение убежища'}»?\n\nВместимость бункера немедленно увеличится на +1 место для всех!`)) {
        App.sendAction('play_special_action', { actionType: 'bunker_cap_plus' })
          .then(() => {
            App.playSound('start');
            App.showToast('⚡ Вместимость бункера увеличена на +1!');
          })
          .catch(err => App.showToast(`Ошибка: ${err.message}`));
      }
      return;
    }

    if (effectiveAction === 'bunker_cap_minus') {
      if (confirm(`Разыграть спец-карту «${cardText}»?\n\nВместимость бункера уменьшится на -1 место!`)) {
        App.sendAction('play_special_action', { actionType: 'bunker_cap_minus' })
          .then(() => {
            App.playSound('flip');
            App.showToast('⚡ Вместимость бункера уменьшена на -1!');
          })
          .catch(err => App.showToast(`Ошибка: ${err.message}`));
      }
      return;
    }

    if (effectiveAction === 'exile_immunity') {
      if (confirm(`Разыграть спец-карту «${cardText}»?\n\nВы получите иммунитет к изгнанию на следующее голосование!`)) {
        App.sendAction('play_special_action', { actionType: 'exile_immunity' })
          .then(() => {
            App.playSound('flip');
            App.showToast('🛡️ Получен иммунитет к изгнанию!');
          })
          .catch(err => App.showToast(`Ошибка: ${err.message}`));
      }
      return;
    }

    if (!effectiveAction || effectiveAction === 'custom') {
      if (confirm(`Разыграть спец-карту «${cardText}» и открыть ее для всех участников?`)) {
        this.toggleCard(playerId, categoryKey);
      }
      return;
    }

    // Interactive action handler
    this.openSpecialActionModal(playerId, categoryKey, effectiveAction);
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

      case 'vote_plus_one':
        controls.innerHTML = `
          <div style="font-size: 13px; color: var(--text-main); line-height: 1.5;">
            🗳️ <strong>Веское слово:</strong> На следующем голосовании ваш голос автоматически будет считаться за <strong>два (+1 доп. голос)</strong>!
          </div>
        `;
        break;

      case 'vote_exiled_power': {
        const exCount = (state.players || []).filter(p => p.isExiled).length;
        controls.innerHTML = `
          <div style="font-size: 13px; color: var(--text-main); line-height: 1.5;">
            💀 <strong>Голос павших:</strong> Ваш голос в голосовании усилится на число всех изгнанных игроков бункера (сейчас: <strong>+${exCount}</strong> доп. голосов)!
          </div>
        `;
        break;
      }

      case 'steal_inventory':
        controls.innerHTML = `
          <div class="form-group">
            <label>У какого игрока украсть предмет инвентаря:</label>
            <select id="select-special-target" class="form-input">
              ${otherPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Какой инвентарь украсть:</label>
            <select id="select-special-cat" class="form-input">
              <option value="small_inventory">🎒 Малый инвентарь</option>
              <option value="large_inventory">📦 Крупный инвентарь</option>
            </select>
          </div>
          <div style="font-size: 11.5px; color: var(--accent-cyan); line-height: 1.4;">
            💡 Текст украденного предмета будет добавлен в вашу карту, а все его теги и параметры спасения перейдут к вам и бункеру!
          </div>
        `;
        break;

      case 'steal_voter_card': {
        const votes = (state.lastVotingHistory) ? state.lastVotingHistory.votes : {};
        const votersAgainstMe = Object.entries(votes || {})
          .filter(([voterId, targetId]) => targetId === state.myId)
          .map(([voterId]) => voterId);
        const targetVoterPlayers = (state.players || []).filter(p => votersAgainstMe.includes(p.id));

        if (targetVoterPlayers.length === 0) {
          controls.innerHTML = `<div style="font-size: 13px; color: var(--accent-amber);">⚠️ В последнем раунде против вас никто не голосовал (или голосования еще не было). Вы можете приберечь эту карту!</div>`;
        } else {
          controls.innerHTML = `
            <div class="form-group">
              <label>У кого из голосовавших против вас украсть инвентарь:</label>
              <select id="select-special-target" class="form-input">
                ${targetVoterPlayers.map(p => `<option value="${p.id}">🗳️ ${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Какую карту инвентаря украсть:</label>
              <select id="select-special-cat" class="form-input">
                <option value="small_inventory">🎒 Малый инвентарь</option>
                <option value="large_inventory">📦 Крупный инвентарь</option>
              </select>
            </div>
          `;
        }
        break;
      }

      case 'shuffle_category':
        controls.innerHTML = `
          <div class="form-group">
            <label>Какую категорию карт перемешать между всеми выжившими:</label>
            <select id="select-special-cat" class="form-input">
              ${categories.map(c => `<option value="${c.key}">${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
          <div style="font-size: 11.5px; color: var(--accent-amber); line-height: 1.4;">
            🔀 Сервер перемешает карты этой категории у всех не изгнанных участников и раздаст их заново случайным образом!
          </div>
        `;
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
      await App.sendAction('play_special_action', { actionType, params });
      document.getElementById('modal-special-action').classList.add('hidden');
      App.showToast('⚡ Спец-карта успешно разыграна!');
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

  // --- SHOW FINAL RESULTS PAGE ---
  showResultsModal(results) {
    this.showResultsPage(results);
  },

  showResultsPage(results) {
    if (!results) return;

    this.setupRoulette(results);

    const disasterTitle = document.getElementById('results-disaster-title');
    if (disasterTitle) {
      disasterTitle.textContent = `Катастрофа: ${results.disaster || 'Глобальный катаклизм'}`;
    }

    const verdictBox = document.getElementById('results-verdict-box');
    if (verdictBox) {
      const isSuccess = Boolean(results.isSuccess);
      const threshold = results.threshold !== undefined ? results.threshold : (101 - results.percentage);

      const outcomeBadge = isSuccess
        ? `<div class="results-badge-pill success">✅ УСПЕШНО (БУНКЕР ВЫЖИЛ)</div>`
        : `<div class="results-badge-pill danger">❌ ПРОВАЛ (БУНКЕР ПОГИБ)</div>`;

      const rollInfo = (results.diceRoll !== undefined)
        ? `<div class="results-roll-info">🎲 Результат проверки судьбы: <strong>${results.diceRoll}</strong> из 100 (для выживания требовалось ≥ ${threshold} при шансе ${results.percentage}%)</div>`
        : '';

      verdictBox.innerHTML = `
        <div class="results-percentage">${results.percentage}%</div>
        <div class="results-chance-label">Итоговый шанс выживания</div>
        ${outcomeBadge}
        ${rollInfo}
        <div class="results-verdict-text">${results.verdict || ''}</div>
        ${results.epilogue ? `<div class="results-epilogue-box">${results.epilogue}</div>` : ''}
      `;
      verdictBox.className = `results-badge-verdict ${isSuccess ? 'success' : 'danger'}`;

      if (results.teamResources && typeof TagHelper !== 'undefined') {
        const defs = TagHelper.PARAM_DEFINITIONS;
        const chipsHtml = Object.entries(defs).map(([key, def]) => {
          const val = results.teamResources[key] || 0;
          return `
            <span class="card-tag-chip" style="color: ${def.color}; background: ${def.bg}; border: 1px solid ${def.color}40; font-size: 12px; padding: 4px 10px; border-radius: 6px;">
              ${def.icon} ${def.name}: <strong>+${val}</strong>
            </span>
          `;
        }).join('');

        verdictBox.innerHTML += `
          <div class="results-resources-section">
            <div class="results-resources-title">📊 Совокупные ресурсы спасшихся в бункере:</div>
            <div class="results-resources-chips">${chipsHtml}</div>
          </div>
        `;
      }
    }

    const survList = document.getElementById('results-survivors-list');
    if (survList) {
      survList.innerHTML = (results.survivors && results.survivors.length > 0) ? results.survivors.map(s => `
        <div class="survivor-item survivor-item-saved">
          <div class="survivor-header">
            <strong>🛡️ ${s.name}</strong>
          </div>
          <small class="survivor-prof">${s.profession || ''} | ${s.health || ''}</small>
          ${s.traits ? `<small class="survivor-trait">Черта: ${s.traits}</small>` : ''}
        </div>
      `).join('') : '<div style="color: var(--text-dim); font-size: 13px; padding: 12px; text-align: center;">Никто не спасся в бункере</div>';
    }

    const exiledList = document.getElementById('results-exiled-list');
    if (exiledList) {
      exiledList.innerHTML = (results.exiled && results.exiled.length > 0) ? results.exiled.map(e => `
        <div class="survivor-item survivor-item-exiled">
          <div class="survivor-header">
            <strong style="color: var(--accent-red);">💀 ${e.name} (ИЗГНАН)</strong>
          </div>
          <small class="survivor-prof">${e.profession || ''}</small>
        </div>
      `).join('') : '<div style="color: var(--text-dim); font-size: 13px; padding: 12px; text-align: center;">Никто не был изгнан</div>';
    }

    const btnLobby = document.getElementById('btn-results-to-lobby');
    if (btnLobby) {
      if (!App.isHost) {
        btnLobby.textContent = '⏳ Ожидание решения Мастера...';
        btnLobby.disabled = true;
      } else {
        btnLobby.textContent = '🔄 ВЕРНУТЬ ВСЕХ В ЛОББИ';
        btnLobby.disabled = false;
      }
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  GameBoard.init();
});
