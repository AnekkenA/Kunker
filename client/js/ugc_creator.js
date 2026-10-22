// --- UGC CARD CREATOR (MODE 2: С НУЛЯ) ---
const UgcCreator = {
  categories: [],
  hasSubmitted: false,
  lastFocusedInput: null,

  categoryExamples: {
    profession: 'Военный хирург (#Медицина[5], #Психика[2])',
    health: 'Иммунитет к радиации (#Медицина[4])',
    biology: 'Мужчина, 32 года, атлет (#Защита[2])',
    hobby: 'Кулинария и консервация (#Еда[4])',
    traits: 'Хладнокровие в стрессе (#Психика[4])',
    facts: 'Знает схему пожарных гидрантов бункера (#Пожаротушение[3])',
    small_inventory: 'Огнетушитель углекислотный (#Пожаротушение[4])',
    large_inventory: 'Компактная гидропонная ферма (#Еда[5], #Инженерия[2])',
    special_cards: '«Огнезащита бункера»: защита от угрозы пожара (#Пожаротушение[5])'
  },

  samplePresets: {
    disasters: [
      {
        title: 'Глобальный ядерный конфликт и радиоактивные осадки',
        goal: 'Продержаться в герметичном бункере 3 года до снижения фона радиации на поверхности.'
      },
      {
        title: 'Смертоносный синтетический вирус «Омега»',
        goal: 'Изолироваться на 5 лет, сохранить стерильность и синтезировать постоянную вакцину.'
      }
    ],
    bunker: [
      {
        title: 'Богатый гидропонный сад',
        description: 'Запас свежих овощей, злаков и зелени на 15 лет с автоматическим поливом.'
      },
      {
        title: 'Медблок с операционной и реанимацией',
        description: 'Запас антибиотиков, обезболивающих и хирургических инструментов на годы изоляции.'
      },
      {
        title: 'Мощный геотермальный генератор',
        description: 'Неисчерпаемый источник электроэнергии глубокого бурения бункера.'
      },
      {
        title: 'Артезианская скважина чистоты',
        description: 'Глубина 400 метров, неограниченный приток кристально чистой питьевой воды.'
      },
      {
        title: 'Автоматическая мастерская и 3D-принтер',
        description: 'Позволяет перерабатывать лом и изготавливать любые детали, инструменты и крепеж.'
      }
    ],
    threats: [
      {
        title: 'Утечка ядовитого фреона из холодильных камер',
        description: 'Поврежден контур охлаждения запасов, требуется химзащита (#Защита[3], #Инженерия[2]).'
      },
      {
        title: 'Короткое замыкание в центральной щитовой',
        description: 'Риск пожара в кабельных каналах убежища (#Пожаротушение[4]).'
      },
      {
        title: 'Вспышка неизвестной лихорадки',
        description: 'Опасность эпидемии в замкнутом пространстве, нужны медикаменты (#Медицина[4]).'
      },
      {
        title: 'Острый психоз и паника взаперти',
        description: 'Высокий риск бунта и срыва изоляции (#Психика[4]).'
      },
      {
        title: 'Поломка глубинного водяного насоса',
        description: 'Угроза обезвоживания бункера, требуется срочный ремонт механиком (#Инженерия[4]).'
      }
    ],
    profession: [
      'Пожарный спасатель (#Пожаротушение[5], #Защита[2])',
      'Врач-хирург (#Медицина[5], #Психика[2])',
      'Агроном-селекционер (#Еда[5], #Наука[2])',
      'Инженер-электрик (#Инженерия[5], #Защита[1])',
      'Психотерапевт (#Психика[5], #Медицина[2])'
    ],
    health: [
      'Идеальное здоровье (#Медицина[2])',
      'Устойчивая психика (#Психика[3])',
      'Аллергия на пыль',
      'Ночное зрение (#Защита[2])',
      'Иммунитет к радиации (#Медицина[4])'
    ],
    biology: [
      'Мужчина, 32 года, атлет (#Защита[2])',
      'Женщина, 26 лет, фертильна (#Медицина[1])',
      'Мужчина, 45 лет, физик (#Наука[3])',
      'Женщина, 35 лет, биолог (#Наука[4], #Еда[2])',
      'Мужчина, 22 года, вынослив (#Инженерия[2])'
    ],
    hobby: [
      'Кулинария и консервация (#Еда[4])',
      'Радиолюбитель и пайка (#Инженерия[3])',
      'Дрессировка собак (#Защита[2])',
      'Йога и медитация (#Психика[3])',
      'Туризм и выживание (#Еда[2], #Пожаротушение[2])'
    ],
    traits: [
      'Хладнокровие в стрессе (#Психика[4])',
      'Лидерские качества (#Психика[2])',
      'Педантичность и порядок (#Инженерия[1])',
      'Осторожность и бдительность (#Защита[2])',
      'Оптимизм (#Психика[2])'
    ],
    facts: [
      'Знает расположение пожарных гидрантов бункера (#Пожаротушение[3])',
      'Умеет настраивать гидропонные фермы (#Еда[4])',
      'Прошел курс первой помощи МЧС (#Медицина[3])',
      'Владеет радиостанцией дальнего действия (#Инженерия[2])',
      'Имеет черный пояс по дзюдо (#Защита[3])'
    ],
    small_inventory: [
      'Огнетушитель углекислотный (#Пожаротушение[4])',
      'Армейская тактическая аптечка (#Медицина[4])',
      'Сухой паек на 14 дней (#Еда[3])',
      'Мультитул и набор радиодеталей (#Инженерия[3])',
      'Шокер и перцовый баллон (#Защита[3])'
    ],
    large_inventory: [
      'Компактная гидропонная установка (#Еда[5], #Инженерия[2])',
      'Дизель-генератор 10 кВт с запасом топлива (#Инженерия[5])',
      'Хирургический набор и стерилизатор (#Медицина[5])',
      'Пожарная мотопомпа и рукав 50м (#Пожаротушение[6])',
      'Система видеонаблюдения и охранные турели (#Защита[5])'
    ],
    special_cards: [
      '«Огнезащита бункера»: Примените для предотвращения угрозы пожара. (#Пожаротушение[5])',
      '«Второе дыхание»: Отмените свое изгнание 1 раз.',
      '«Равноценный обмен»: Поменяйтесь картой багажа или хобби с другим игроком.',
      '«Расширение убежища»: Вместимость бункера увеличивается на +1 место.',
      '«Перераспределение припасов»: Добавьте +4 к провизии. (#Еда[4])'
    ]
  },

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // 1. Autofill button
    const btnAutofill = document.getElementById('btn-ugc-autofill');
    if (btnAutofill) {
      btnAutofill.addEventListener('click', () => {
        this.autofillRandom();
        App.playSound('click');
        App.showToast('🎲 Все поля (Катастрофы, Бункер, Угрозы и Роли) успешно заполнены!');
      });
    }

    // 2. Submit UGC Cards
    const btnSubmit = document.getElementById('btn-ugc-submit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const submissions = this.gatherSubmissions();
        try {
          await App.sendAction('submit_ugc', { submissions });
          this.hasSubmitted = true;
          this.updateSubmitButtonUI(true);
          App.playSound('start');
          App.showToast('✨ Ваши карты (Катастрофы, Бункер, Угрозы и Роли) успешно отправлены в банк!');
        } catch (e) {
          App.showToast(`Ошибка отправки: ${e.message}`);
        }
      });
    }

    // 3. Master Start Game Handlers (Top bar and Bottom bar)
    const handleMasterStart = async () => {
      const themeNameInput = document.getElementById('input-ugc-theme-name');
      const themeName = themeNameInput ? themeNameInput.value.trim() : null;

      const state = App.state || {};
      const unreadyPlayers = (state.players || []).filter(p => !p.ugcReady);
      if (unreadyPlayers.length > 0) {
        const names = unreadyPlayers.map(p => p.name).join(', ');
        if (!confirm(`⚠️ Еще не отправили карты: ${names}.\n\nЗапустить игру прямо сейчас? (Недостающие карты будут дополнены сервером автоматически)`)) {
          return;
        }
      }

      try {
        await App.sendAction('start_ugc_game', {
          saveThemeName: themeName || null
        });
        App.playSound('start');
      } catch (e) {
        App.showToast(`Ошибка запуска игры: ${e.message}`);
      }
    };

    const btnStartTop = document.getElementById('btn-ugc-start-game');
    if (btnStartTop) btnStartTop.addEventListener('click', handleMasterStart);

    const btnStartBottom = document.getElementById('btn-ugc-start-game-bottom');
    if (btnStartBottom) btnStartBottom.addEventListener('click', handleMasterStart);

    // 4. Claim Master Buttons
    const handleClaimMaster = async () => {
      try {
        await App.sendAction('claim_host');
        App.playSound('start');
        App.showToast('👑 Вы назначены Мастером игры! Теперь вам доступна панель управления и запуск игры.');
      } catch (e) {
        App.showToast(`Ошибка: ${e.message}`);
      }
    };

    const btnClaimMaster = document.getElementById('btn-ugc-claim-master');
    if (btnClaimMaster) btnClaimMaster.addEventListener('click', handleClaimMaster);

    const btnClaimBottom = document.getElementById('btn-ugc-claim-bottom');
    if (btnClaimBottom) btnClaimBottom.addEventListener('click', handleClaimMaster);
  },

  updateSubmitButtonUI(isReady) {
    const btnSubmit = document.getElementById('btn-ugc-submit');
    const badge = document.getElementById('ugc-status-badge');
    if (btnSubmit) {
      if (isReady) {
        btnSubmit.innerHTML = '✅ КАРТЫ ОТПРАВЛЕНЫ В БАНК (НАЖМИТЕ ДЛЯ ПОВТОРНОГО СОХРАНЕНИЯ)';
        btnSubmit.classList.remove('btn-primary');
        btnSubmit.classList.add('btn-success');
      } else {
        btnSubmit.innerHTML = '💾 СОХРАНИТЬ И ОТПРАВИТЬ СВОИ КАРТЫ';
        btnSubmit.classList.remove('btn-success');
        btnSubmit.classList.add('btn-primary');
      }
    }
    if (badge) {
      if (isReady) {
        badge.textContent = '✅ Карты в банке';
        badge.style.background = 'var(--accent-green)';
      } else {
        badge.textContent = 'Заполните поля карт';
        badge.style.background = '';
      }
    }
  },

  TAGS_DIRECTORY_INFO: {
    food: {
      desc: 'Запас еды, чистой воды и сухпайков. Защита бункера от голода, засухи и истощения.'
    },
    medicine: {
      desc: 'Лекарства, хирургия, антибиотики и стерильность. Защита от эпидемий, заражений и ран.'
    },
    engineering: {
      desc: 'Ремонт генераторов, проводки, вентиляции и помп. Восстановление систем бункера.'
    },
    defense: {
      desc: 'Броня, оружие, укрепление гермодверей и караул. Защита от рейдеров, мародеров и мутантов.'
    },
    psycho: {
      desc: 'Моральная стойкость, сон и порядок. Предотвращение паники, психоза и бунта выживших.'
    },
    fire: {
      desc: 'Огнетушители, гидранты, песок и негорючие материалы. Спасение бункера от возгораний.'
    },
    science: {
      desc: 'Лаборатории, дезактивация радиации, селекция семян и создание вакцин.'
    }
  },

  renderTagInsertBar() {
    const bar = document.getElementById('ugc-tag-helper-bar');
    if (!bar) return;

    if (!window.TagHelper || !TagHelper.PARAM_DEFINITIONS) return;

    const allDefs = Object.entries(TagHelper.PARAM_DEFINITIONS);

    const quickChipsHtml = allDefs.map(([key, def]) => `
      <button type="button" class="btn-tag-chip" data-tag="#${def.name}[3]" title="Вставить #${def.name}[3] в активное поле" style="border-color: ${def.color}60; color: ${def.color}; background: ${def.bg}; font-size: 12px; padding: 4px 9px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
        + ${def.icon} #${def.name}[3]
      </button>
    `).join('');

    const detailedItemsHtml = allDefs.map(([key, def]) => {
      const info = this.TAGS_DIRECTORY_INFO[key] || {
        desc: def.aliases ? `Ключевые слова: ${def.aliases.join(', ')}` : 'Пользовательский параметр выживания'
      };

      return `
        <div class="ugc-tag-guide-card" style="border-left: 3px solid ${def.color};">
          <div class="ugc-tag-guide-header">
            <div class="ugc-tag-guide-title" style="color: ${def.color};">
              <span>${def.icon}</span>
              <span>#${def.name}</span>
            </div>
            <div class="ugc-tag-quick-buttons">
              <span style="font-size: 10px; color: var(--text-dim); margin-right: 2px;">Баллы:</span>
              <button type="button" class="btn-score-tag" data-tag="#${def.name}[1]">+1</button>
              <button type="button" class="btn-score-tag" data-tag="#${def.name}[2]">+2</button>
              <button type="button" class="btn-score-tag" data-tag="#${def.name}[3]">+3</button>
              <button type="button" class="btn-score-tag" data-tag="#${def.name}[4]">+4</button>
              <button type="button" class="btn-score-tag" data-tag="#${def.name}[5]">+5</button>
            </div>
          </div>
          <div class="ugc-tag-guide-desc">${info.desc}</div>
        </div>
      `;
    }).join('');

    bar.innerHTML = `
      <div class="ugc-tags-directory-panel">
        <div class="ugc-tags-dir-header">
          <div class="ugc-tags-dir-title">
            <span>🏷️</span>
            <strong>Список всех существующих тегов выживания:</strong>
            <span class="ugc-tag-count-badge">${allDefs.length} тегов</span>
          </div>
          <button type="button" id="btn-toggle-ugc-tags-guide" class="btn btn-xs btn-outline">
            📖 Развернуть описание всех тегов
          </button>
        </div>

        <p class="ugc-tags-dir-hint">
          💡 <strong>Как использовать:</strong> кликните в любое поле карты и нажмите кнопку тега. В финале игры теги выживших суммируются и помогают спасти бункер!
        </p>

        <!-- QUICK CHIPS -->
        <div class="quick-tag-insert-bar" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
          ${quickChipsHtml}
        </div>

        <!-- DETAILED EXPANDABLE REFERENCE -->
        <div id="ugc-tags-detailed-reference" class="ugc-tags-detailed-reference hidden">
          <div class="ugc-tags-grid">
            ${detailedItemsHtml}
          </div>
        </div>
      </div>
    `;

    // Bind Toggle Button
    const btnToggle = bar.querySelector('#btn-toggle-ugc-tags-guide');
    const refContainer = bar.querySelector('#ugc-tags-detailed-reference');
    if (btnToggle && refContainer) {
      btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = refContainer.classList.contains('hidden');
        refContainer.classList.toggle('hidden');
        btnToggle.textContent = isHidden ? '🔼 Свернуть справочник тегов' : '📖 Развернуть описание всех тегов';
        if (typeof App !== 'undefined') App.playSound('click');
      });
    }

    // Bind Quick Chips and Detailed Buttons
    bar.querySelectorAll('[data-tag]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = btn.getAttribute('data-tag');
        this.insertTagIntoActiveInput(tag);
      });
    });
  },

  insertTagIntoActiveInput(tag) {
    let input = this.lastFocusedInput;
    if (!input || !document.body.contains(input)) {
      input = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ugc-input')
        ? document.activeElement
        : document.querySelector('.ugc-input');
    }
    if (!input) {
      if (typeof App !== 'undefined') App.showToast('⚠️ Сначала нажмите в поле карты, куда вставить тег!');
      return;
    }

    const val = input.value.trim();
    if (!val) {
      input.value = tag;
    } else if (val.endsWith(')')) {
      input.value = val.slice(0, -1).trim() + `, ${tag})`;
    } else {
      input.value = `${val} (${tag})`;
    }

    input.focus();
    if (typeof App !== 'undefined') {
      App.playSound('click');
      App.showToast(`✅ Вставлен: ${tag}`);
    }
  },

  render(state) {
    this.categories = state.categories || [];
    if (typeof TagHelper !== 'undefined') {
      TagHelper.resetToDefaults();
      if (Array.isArray(state.customTags)) {
        TagHelper.registerCustomTags(state.customTags);
      }
    }
    this.renderTagInsertBar();

    // 1. Render World Section: Bunker Inputs (5 pairs)
    const bunkerContainer = document.getElementById('ugc-bunker-inputs');
    if (bunkerContainer && bunkerContainer.children.length === 0) {
      bunkerContainer.innerHTML = [1, 2, 3, 4, 5].map(i => `
        <div class="ugc-world-card-pair">
          <span class="ugc-card-pair-badge">Отсек ${i}:</span>
          <input type="text" class="form-input ugc-input" data-world="bunker" data-field="title" data-index="${i - 1}" placeholder="Название отсека (например: Автономный медблок)">
          <input type="text" class="form-input ugc-input" data-world="bunker" data-field="desc" data-index="${i - 1}" placeholder="Описание бонуса (например: Запас лекарств на 5 лет)">
        </div>
      `).join('');
    }

    // 2. Render World Section: Threat Inputs (5 pairs)
    const threatsContainer = document.getElementById('ugc-threats-inputs');
    if (threatsContainer && threatsContainer.children.length === 0) {
      threatsContainer.innerHTML = [1, 2, 3, 4, 5].map(i => `
        <div class="ugc-world-card-pair">
          <span class="ugc-card-pair-badge">Угроза ${i}:</span>
          <input type="text" class="form-input ugc-input" data-world="threats" data-field="title" data-index="${i - 1}" placeholder="Название опасности (например: Утечка ядовитого газа)">
          <input type="text" class="form-input ugc-input" data-world="threats" data-field="desc" data-index="${i - 1}" placeholder="Описание угрозы (например: Риск удушья, требуется химзащита)">
        </div>
      `).join('');
    }

    // 3. Render Character Categories Accordion
    const container = document.getElementById('ugc-categories-container');
    if (container) {
      // Re-build if empty or if category count changed
      const currentRenderedKeys = Array.from(container.querySelectorAll('.ugc-category-box[data-cat-key]')).map(el => el.getAttribute('data-cat-key'));
      const activeKeys = this.categories.map(c => c.key);
      const isMismatch = currentRenderedKeys.join(',') !== activeKeys.join(',');

      if (container.children.length === 0 || isMismatch) {
        container.innerHTML = this.categories.map(cat => {
          const example = this.categoryExamples[cat.key] || `${cat.name} (#Параметр[3])`;
          return `
            <div class="ugc-category-box" data-cat-key="${cat.key}">
              <div class="ugc-category-title">
                <span>${cat.icon || '🎴'}</span>
                <span>${cat.name} (5 вариантов)</span>
              </div>
              <div class="ugc-category-hint">
                💡 Формат: Название (#Параметр[сила]) &nbsp;•&nbsp; <em>Пример: ${example}</em>
              </div>
              <div class="ugc-inputs-grid">
                ${[1, 2, 3, 4, 5].map(i => `
                  <input type="text" class="form-input ugc-input" data-cat="${cat.key}" data-index="${i - 1}" placeholder="Вариант ${i}">
                `).join('')}
              </div>
            </div>
          `;
        }).join('');
      }

      // Attach focus listeners
      container.querySelectorAll('.ugc-input').forEach(inp => {
        inp.addEventListener('focus', () => {
          this.lastFocusedInput = inp;
        });
      });
    }

    // Attach focus listeners for world inputs as well
    document.querySelectorAll('.ugc-world-sections-container .ugc-input').forEach(inp => {
      inp.addEventListener('focus', () => {
        this.lastFocusedInput = inp;
      });
    });

    // 4. Update Ready Status for Self
    const myPlayer = (state.players || []).find(p => p.id === state.myId);
    const isSelfReady = myPlayer ? Boolean(myPlayer.ugcReady) : false;
    this.updateSubmitButtonUI(isSelfReady || this.hasSubmitted);

    // 5. Update Master Top Bar vs Player Top Bar
    const masterTopBar = document.getElementById('ugc-master-top-bar');
    const playerTopBar = document.getElementById('ugc-player-top-bar');
    const masterBottomLaunch = document.getElementById('ugc-master-bottom-launch');

    const players = state.players || [];
    const readyPlayers = players.filter(p => p.ugcReady);

    const playerChipsHtml = players.map(p => `
      <span class="ugc-status-chip ${p.ugcReady ? 'ready' : 'writing'}">
        ${p.isHost ? '👑' : '👤'} <strong>${p.name}</strong>: ${p.ugcReady ? '✅ Готов' : '⏳ Пишет...'}
      </span>
    `).join('');

    const playerBottomClaim = document.getElementById('ugc-player-bottom-claim');

    if (state.isHost) {
      if (masterTopBar) masterTopBar.classList.remove('hidden');
      if (playerTopBar) playerTopBar.classList.add('hidden');
      if (masterBottomLaunch) masterBottomLaunch.classList.remove('hidden');
      if (playerBottomClaim) playerBottomClaim.classList.add('hidden');

      const hostStatusText = document.getElementById('ugc-host-status-text');
      if (hostStatusText) {
        hostStatusText.textContent = `Готовность выживших: ${readyPlayers.length} из ${players.length} игроков заполнили карты`;
      }

      const chipsBar = document.getElementById('ugc-players-chips-bar');
      if (chipsBar) chipsBar.innerHTML = playerChipsHtml;
    } else {
      if (masterTopBar) masterTopBar.classList.add('hidden');
      if (playerTopBar) playerTopBar.classList.remove('hidden');
      if (masterBottomLaunch) masterBottomLaunch.classList.add('hidden');
      if (playerBottomClaim) playerBottomClaim.classList.remove('hidden');

      const playerChipsBar = document.getElementById('ugc-player-chips-bar');
      if (playerChipsBar) playerChipsBar.innerHTML = playerChipsHtml;
    }
  },

  gatherSubmissions() {
    const submissions = {
      disasters: [],
      bunker: [],
      threats: []
    };
    const authorName = (window.App && window.App.playerName) ? window.App.playerName : 'Игрок';

    // Disasters (2 variants)
    for (let i = 0; i < 2; i++) {
      const tInp = document.querySelector(`.ugc-input[data-world="disasters"][data-field="title"][data-index="${i}"]`);
      const gInp = document.querySelector(`.ugc-input[data-world="disasters"][data-field="goal"][data-index="${i}"]`);
      const title = tInp ? tInp.value.trim() : '';
      const goal = gInp ? gInp.value.trim() : '';
      if (title) {
        submissions.disasters.push({ title, goal, author: authorName });
      }
    }

    // Bunker (5 variants)
    for (let i = 0; i < 5; i++) {
      const tInp = document.querySelector(`.ugc-input[data-world="bunker"][data-field="title"][data-index="${i}"]`);
      const dInp = document.querySelector(`.ugc-input[data-world="bunker"][data-field="desc"][data-index="${i}"]`);
      const title = tInp ? tInp.value.trim() : '';
      const desc = dInp ? dInp.value.trim() : '';
      if (title) {
        submissions.bunker.push({ title, description: desc, author: authorName });
      }
    }

    // Threats (5 variants)
    for (let i = 0; i < 5; i++) {
      const tInp = document.querySelector(`.ugc-input[data-world="threats"][data-field="title"][data-index="${i}"]`);
      const dInp = document.querySelector(`.ugc-input[data-world="threats"][data-field="desc"][data-index="${i}"]`);
      const title = tInp ? tInp.value.trim() : '';
      const desc = dInp ? dInp.value.trim() : '';
      if (title) {
        submissions.threats.push({ title, description: desc, author: authorName });
      }
    }

    // Character Categories (5 variants each)
    this.categories.forEach(cat => {
      submissions[cat.key] = [];
      const inputs = document.querySelectorAll(`.ugc-input[data-cat="${cat.key}"]`);
      inputs.forEach(input => {
        const val = input.value.trim() || `${cat.name} №1`;
        submissions[cat.key].push({
          text: val,
          author: authorName
        });
      });
    });

    return submissions;
  },

  autofillRandom() {
    // 1. Disasters
    const disasters = this.samplePresets.disasters || [];
    disasters.forEach((d, idx) => {
      const titleInp = document.querySelector(`.ugc-input[data-world="disasters"][data-field="title"][data-index="${idx}"]`);
      const goalInp = document.querySelector(`.ugc-input[data-world="disasters"][data-field="goal"][data-index="${idx}"]`);
      if (titleInp) titleInp.value = d.title;
      if (goalInp) goalInp.value = d.goal;
    });

    // 2. Bunker
    const bunker = this.samplePresets.bunker || [];
    bunker.forEach((b, idx) => {
      const titleInp = document.querySelector(`.ugc-input[data-world="bunker"][data-field="title"][data-index="${idx}"]`);
      const descInp = document.querySelector(`.ugc-input[data-world="bunker"][data-field="desc"][data-index="${idx}"]`);
      if (titleInp) titleInp.value = b.title;
      if (descInp) descInp.value = b.description;
    });

    // 3. Threats
    const threats = this.samplePresets.threats || [];
    threats.forEach((t, idx) => {
      const titleInp = document.querySelector(`.ugc-input[data-world="threats"][data-field="title"][data-index="${idx}"]`);
      const descInp = document.querySelector(`.ugc-input[data-world="threats"][data-field="desc"][data-index="${idx}"]`);
      if (titleInp) titleInp.value = t.title;
      if (descInp) descInp.value = t.description;
    });

    // 4. Character Categories
    this.categories.forEach(cat => {
      const inputs = document.querySelectorAll(`.ugc-input[data-cat="${cat.key}"]`);
      const presets = this.samplePresets[cat.key] || ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4', 'Вариант 5'];
      inputs.forEach((input, idx) => {
        input.value = presets[idx % presets.length];
      });
    });
  }
};

window.addEventListener('DOMContentLoaded', () => {
  UgcCreator.init();
});
