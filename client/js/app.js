// --- GLOBAL APP STATE & NETWORKING (MULTI-ROOM ENGINE) ---
const App = {
  playerName: localStorage.getItem('bunker_player_name') || sessionStorage.getItem('bunker_player_name') || '',
  playerId: localStorage.getItem('bunker_player_id') || sessionStorage.getItem('bunker_player_id') || '',
  roomId: '',
  isHost: false,
  soundEnabled: true,
  state: null,
  eventSource: null,
  audioCtx: null,

  generateNewCreateCode() {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const createCodeInput = document.getElementById('input-create-room-code');
    if (createCodeInput) createCodeInput.value = code;
    return code;
  },

  async checkRoomStatus(roomId) {
    const statusEl = document.getElementById('auth-room-status');
    const passHint = document.getElementById('auth-password-hint');
    const passInput = document.getElementById('input-room-password');
    if (!statusEl || !roomId) {
      if (statusEl) statusEl.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(`/api/room_info?room=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const info = await res.json();
        if (info.exists) {
          if (info.hasPassword) {
            statusEl.innerHTML = `<span style="color:var(--accent-amber); font-weight:700;">🔒 Бункер #${info.roomId} защищен паролем.</span> <span style="color:var(--text-dim);">(${info.playersCount} выживших)</span>`;
            if (passHint) passHint.innerHTML = '<strong style="color:var(--accent-amber); font-size:11px;">(ТРЕБУЕТСЯ ПАРОЛЬ)</strong>';
            if (passInput) passInput.placeholder = 'Введите пароль бункера...';
          } else {
            statusEl.innerHTML = `<span style="color:var(--accent-green); font-weight:700;">✓ Бункер #${info.roomId} открыт.</span> <span style="color:var(--text-dim);">(${info.playersCount} выживших)</span>`;
            if (passHint) passHint.innerHTML = '<span style="color:var(--text-dim);">(пароль не требуется)</span>';
            if (passInput) passInput.placeholder = 'Без пароля';
          }
          if (info.lockedLobby) {
            statusEl.innerHTML += ` <span style="color:var(--accent-red); font-weight:700;">[Шлюз заперт]</span>`;
          }
        } else {
          statusEl.innerHTML = `<span style="color:var(--accent-cyan); font-weight:600;">Бункер #${roomId} свободен. Войдя, вы создадите его!</span>`;
          if (passHint) passHint.innerHTML = '<span style="color:var(--text-dim);">(необязательно)</span>';
        }
      }
    } catch (e) {}
  },

  setupAuthTabs() {
    const tabJoin = document.getElementById('tab-auth-join');
    const tabCreate = document.getElementById('tab-auth-create');
    const panelJoin = document.getElementById('panel-auth-join');
    const panelCreate = document.getElementById('panel-auth-create');

    const nameJoin = document.getElementById('input-player-name');
    const nameCreate = document.getElementById('input-create-name');

    // Keep name synced
    if (nameJoin && nameCreate) {
      nameJoin.addEventListener('input', () => { nameCreate.value = nameJoin.value; });
      nameCreate.addEventListener('input', () => { nameJoin.value = nameCreate.value; });
    }

    const switchTab = (tab) => {
      if (tab === 'join') {
        if (tabJoin) tabJoin.classList.add('active');
        if (tabCreate) tabCreate.classList.remove('active');
        if (panelJoin) panelJoin.classList.add('active');
        if (panelCreate) panelCreate.classList.remove('active');
        if (nameJoin) nameJoin.focus();
      } else {
        if (tabCreate) tabCreate.classList.add('active');
        if (tabJoin) tabJoin.classList.remove('active');
        if (panelCreate) panelCreate.classList.add('active');
        if (panelJoin) panelJoin.classList.remove('active');
        const codeInput = document.getElementById('input-create-room-code');
        if (codeInput && !codeInput.value) {
          this.generateNewCreateCode();
        }
        if (nameCreate) nameCreate.focus();
      }
      this.playSound('click');
    };

    if (tabJoin) tabJoin.addEventListener('click', () => switchTab('join'));
    if (tabCreate) tabCreate.addEventListener('click', () => switchTab('create'));

    // Dynamic room status check
    const roomInput = document.getElementById('input-room-code');
    if (roomInput) {
      let debounceTimer = null;
      roomInput.addEventListener('input', () => {
        const val = roomInput.value.trim().toUpperCase();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (val) this.checkRoomStatus(val);
        }, 300);
      });
    }

    // Regen create room code button
    const btnRegen = document.getElementById('btn-regen-create-code');
    if (btnRegen) {
      btnRegen.addEventListener('click', () => {
        const code = this.generateNewCreateCode();
        this.playSound('click');
        this.showToast(`Сгенерирован код: ${code}`);
      });
    }
  },

  async init() {
    this.initAudio();

    // Prepare fresh code for create panel
    this.generateNewCreateCode();

    // Resolve room from URL query parameter ?room=... or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.roomId = roomParam.trim().toUpperCase();
      localStorage.setItem('bunker_room_id', this.roomId);
    } else {
      this.roomId = (localStorage.getItem('bunker_room_id') || '').trim().toUpperCase();
    }

    const roomInput = document.getElementById('input-room-code');
    if (roomInput && this.roomId) {
      roomInput.value = this.roomId;
    }

    const authBadge = document.getElementById('auth-room-badge');
    const authBadgeText = document.getElementById('auth-room-badge-text');
    if (authBadge && authBadgeText && roomParam) {
      authBadgeText.textContent = this.roomId;
      authBadge.classList.remove('hidden');
    }

    this.bindGlobalEvents();
    this.setupAuthTabs();

    if (this.playerName) {
      const nameInput = document.getElementById('input-player-name');
      const createNameInput = document.getElementById('input-create-name');
      if (nameInput) nameInput.value = this.playerName;
      if (createNameInput) createNameInput.value = this.playerName;
    }

    if (this.roomId) {
      this.checkRoomStatus(this.roomId);
    }

    // Recover scoped player ID for this room from localStorage if available
    const roomScopedPlayerId = this.roomId ? localStorage.getItem('bunker_player_id_' + this.roomId) : null;
    if (roomScopedPlayerId) {
      this.playerId = roomScopedPlayerId;
    }

    // If session or local storage has player ID, try restoring state for this specific room
    if (this.playerId && this.roomId) {
      try {
        const res = await fetch(`/api/state?playerId=${encodeURIComponent(this.playerId)}&room=${encodeURIComponent(this.roomId)}`, {
          headers: { 'x-room-id': this.roomId }
        });
        if (res.ok) {
          const state = await res.json();
          if (state && state.myId) {
            this.connectEvents();
            this.onStateUpdate(state);
            return;
          }
        }
      } catch (e) {}
      // Clear stale/expired session
      this.playerId = '';
      sessionStorage.removeItem('bunker_player_id');
      localStorage.removeItem('bunker_player_id');
      if (this.roomId) localStorage.removeItem('bunker_player_id_' + this.roomId);
    }

    this.showScreen('screen-auth');
  },

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {}
  },

  playSound(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'flip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'danger') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'timer_alarm') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(0, now + 0.1);
      osc.frequency.setValueAtTime(880, now + 0.15);
      osc.frequency.setValueAtTime(0, now + 0.25);
      osc.frequency.setValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'roulette_tick') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'fanfare') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.12);
      osc.frequency.setValueAtTime(659.25, now + 0.24);
      osc.frequency.setValueAtTime(880, now + 0.36);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    } else if (type === 'fail_horn') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.6);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  },

  showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.setProperty('display', 'none', 'important');
    });
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      target.style.setProperty('display', 'flex', 'important');
    }

    // Header Back to Lobby Button
    const btnBack = document.getElementById('btn-header-back-to-lobby');
    if (btnBack) {
      if (screenId === 'screen-editor') {
        btnBack.classList.remove('hidden');
        btnBack.style.display = 'inline-flex';
      } else {
        btnBack.classList.add('hidden');
        btnBack.style.display = 'none';
      }
    }
  },

  bindGlobalEvents() {
    // Header Back to Lobby Button
    const btnHeaderBack = document.getElementById('btn-header-back-to-lobby');
    if (btnHeaderBack) {
      btnHeaderBack.addEventListener('click', () => {
        this.showScreen('screen-lobby');
        this.playSound('click');
      });
    }

    // Sound Toggle Button
    const btnSound = document.getElementById('btn-sound-toggle');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        btnSound.textContent = this.soundEnabled ? '🔊' : '🔇';
        this.showToast(this.soundEnabled ? 'Звук включен' : 'Звук выключен');
      });
    }

    // Enter / Join Game (Form Submit + Button Click)
    const joinBtn = document.getElementById('btn-join-game');
    const authJoinForm = document.getElementById('form-auth-join') || document.getElementById('form-auth');

    const handleJoin = async () => {
      const nameInput = document.getElementById('input-player-name');
      const name = nameInput ? nameInput.value.trim() : '';

      const roomInput = document.getElementById('input-room-code');
      const enteredCode = roomInput ? roomInput.value.trim().toUpperCase() : '';

      const passInput = document.getElementById('input-room-password');
      const password = passInput ? passInput.value.trim() : '';

      if (!name) {
        this.showToast('⚠️ Пожалуйста, введите ваше имя (никнейм)!');
        if (nameInput) nameInput.focus();
        return;
      }

      if (!enteredCode) {
        this.showToast('⚠️ Введите код бункера (например: 4821)!');
        if (roomInput) roomInput.focus();
        return;
      }

      this.roomId = enteredCode;
      localStorage.setItem('bunker_room_id', this.roomId);

      if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = '⏳ ВХОД В БУНКЕР...';
      }

      this.playerName = name;
      sessionStorage.setItem('bunker_player_name', name);
      localStorage.setItem('bunker_player_name', name);

      try {
        const res = await fetch('/api/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-room-id': this.roomId
          },
          body: JSON.stringify({
            name,
            password,
            roomId: this.roomId,
            playerId: this.playerId || localStorage.getItem('bunker_player_id_' + this.roomId) || localStorage.getItem('bunker_player_id') || null
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка входа');

        this.playerId = data.playerId;
        this.isHost = data.isHost;
        this.roomId = data.roomId || this.roomId;
        sessionStorage.setItem('bunker_player_id', data.playerId);
        localStorage.setItem('bunker_player_id', data.playerId);
        localStorage.setItem('bunker_player_id_' + this.roomId, data.playerId);
        localStorage.setItem('bunker_room_id', this.roomId);

        // Update URL to current room
        try {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('room', this.roomId);
          window.history.replaceState(null, '', newUrl.toString());
        } catch (e) {}

        this.connectEvents();
        this.onStateUpdate(data.state);
        this.showToast(data.isHost ? '👑 Вы вошли как Мастер игры!' : '🚪 Вы вошли в бункер!');
        this.playSound('start');
      } catch (err) {
        if (joinBtn) {
          joinBtn.disabled = false;
          joinBtn.textContent = '🚪 ВОЙТИ В БУНКЕР';
        }
        if (passInput && err.message && err.message.toLowerCase().includes('парол')) {
          passInput.focus();
          passInput.classList.add('input-error');
          setTimeout(() => passInput.classList.remove('input-error'), 2500);
        }
        this.showToast(`❌ ${err.message}`);
      }
    };

    if (authJoinForm) {
      authJoinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleJoin();
      });
    }
    if (joinBtn) {
      joinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleJoin();
      });
    }

    // Create New Room Form Submit + Button Click
    const createBtn = document.getElementById('btn-create-game');
    const authCreateForm = document.getElementById('form-auth-create');

    const handleCreate = async () => {
      const nameInput = document.getElementById('input-create-name');
      const name = nameInput ? nameInput.value.trim() : '';

      const codeInput = document.getElementById('input-create-room-code');
      let code = codeInput ? codeInput.value.trim().toUpperCase() : '';
      if (!code) code = this.generateNewCreateCode();

      const passInput = document.getElementById('input-create-password');
      const password = passInput ? passInput.value.trim() : '';

      if (!name) {
        this.showToast('⚠️ Введите ваше имя Мастера!');
        if (nameInput) nameInput.focus();
        return;
      }

      if (createBtn) {
        createBtn.disabled = true;
        createBtn.textContent = '⏳ СОЗДАНИЕ БУНКЕРА...';
      }

      this.playerName = name;
      sessionStorage.setItem('bunker_player_name', name);
      localStorage.setItem('bunker_player_name', name);

      try {
        // 1. Create Room on server
        const createRes = await fetch('/api/create_room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customRoomId: code, password })
        });
        const createData = await createRes.json();
        const activeRoomId = (createData && createData.roomId) || code;
        this.roomId = activeRoomId;
        localStorage.setItem('bunker_room_id', this.roomId);

        // 2. Join the newly created room as Master
        const joinRes = await fetch('/api/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-room-id': this.roomId
          },
          body: JSON.stringify({
            name,
            password,
            roomId: this.roomId,
            playerId: null
          })
        });
        const joinData = await joinRes.json();
        if (!joinRes.ok) throw new Error(joinData.error || 'Ошибка входа в созданный бункер');

        this.playerId = joinData.playerId;
        this.isHost = joinData.isHost;
        this.roomId = joinData.roomId || this.roomId;
        sessionStorage.setItem('bunker_player_id', joinData.playerId);
        localStorage.setItem('bunker_player_id', joinData.playerId);
        localStorage.setItem('bunker_player_id_' + this.roomId, joinData.playerId);
        localStorage.setItem('bunker_room_id', this.roomId);

        // Update URL
        try {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('room', this.roomId);
          window.history.replaceState(null, '', newUrl.toString());
        } catch (e) {}

        this.connectEvents();
        this.onStateUpdate(joinData.state);
        this.showToast(`👑 Бункер #${this.roomId} создан! Вы Мастер игры.`);
        this.playSound('start');
      } catch (err) {
        if (createBtn) {
          createBtn.disabled = false;
          createBtn.textContent = '🚀 СОЗДАТЬ БУНКЕР (МАСТЕР)';
        }
        this.showToast(`❌ ${err.message}`);
      }
    };

    if (authCreateForm) {
      authCreateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleCreate();
      });
    }
    if (createBtn) {
      createBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleCreate();
      });
    }

    // Header Room Badge Copy
    const headerRoomBadge = document.getElementById('room-code-badge');
    if (headerRoomBadge) {
      headerRoomBadge.addEventListener('click', () => {
        if (!this.roomId) return;
        navigator.clipboard.writeText(this.roomId).then(() => {
          this.showToast(`📋 Код бункера "${this.roomId}" скопирован!`);
          this.playSound('click');
        }).catch(() => {
          this.showToast(`Код бункера: ${this.roomId}`);
        });
      });
    }

    // Invite Modal Open
    const handleOpenInvite = () => {
      this.openInviteModal();
      this.playSound('click');
    };

    const btnInvite = document.getElementById('btn-invite');
    if (btnInvite) btnInvite.addEventListener('click', handleOpenInvite);
    const btnLobbyInvite = document.getElementById('btn-lobby-invite');
    if (btnLobbyInvite) btnLobbyInvite.addEventListener('click', handleOpenInvite);

    // Close modal
    const btnCloseInvite = document.getElementById('btn-close-invite-modal');
    if (btnCloseInvite) {
      btnCloseInvite.addEventListener('click', () => {
        document.getElementById('invite-modal').classList.add('hidden');
        this.playSound('click');
      });
    }

    const inviteModal = document.getElementById('invite-modal');
    if (inviteModal) {
      inviteModal.addEventListener('click', (e) => {
        if (e.target.id === 'invite-modal') {
          inviteModal.classList.add('hidden');
        }
      });
    }

    // Logs Drawer
    const logsDrawer = document.getElementById('logs-drawer');
    const btnToggleLogs = document.getElementById('btn-toggle-logs');
    if (btnToggleLogs && logsDrawer) {
      btnToggleLogs.addEventListener('click', () => {
        logsDrawer.classList.toggle('open');
        this.playSound('click');
      });
    }
    const btnCloseLogs = document.getElementById('btn-close-logs');
    if (btnCloseLogs && logsDrawer) {
      btnCloseLogs.addEventListener('click', () => {
        logsDrawer.classList.remove('open');
        this.playSound('click');
      });
    }

    // Header Claim Host Button
    const btnClaimHeader = document.getElementById('btn-claim-host-header');
    if (btnClaimHeader) {
      btnClaimHeader.addEventListener('click', async () => {
        try {
          await this.sendAction('claim_host');
          this.playSound('start');
          this.showToast('👑 Вы теперь Мастер игры!');
        } catch (e) {
          this.showToast(`Ошибка: ${e.message}`);
        }
      });
    }
  },

  connectEvents() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const sseUrl = `/api/events?playerId=${encodeURIComponent(this.playerId)}&room=${encodeURIComponent(this.roomId || 'BUNKER-101')}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === 'kicked') {
          this.playerId = '';
          sessionStorage.removeItem('bunker_player_id');
          localStorage.removeItem('bunker_player_id');
          if (this.roomId) localStorage.removeItem('bunker_player_id_' + this.roomId);
          if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
          }
          this.showScreen('screen-auth');
          this.showToast('⚠️ Вы были исключены Мастером из шлюза.');
          return;
        }
        this.onStateUpdate(data);
      } catch (e) {
        console.error('Ошибка SSE:', e);
      }
    };

    this.eventSource.onerror = () => {
      console.warn('SSE переподключение...');
    };

    this.startHeartbeat();
  },

  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(async () => {
      if (this.playerId) {
        try {
          const res = await fetch(`/api/state?playerId=${encodeURIComponent(this.playerId)}&room=${encodeURIComponent(this.roomId || 'BUNKER-101')}`, {
            headers: { 'x-room-id': this.roomId || 'BUNKER-101' }
          });
          if (res.ok) {
            const state = await res.json();
            this.onStateUpdate(state);
          }
        } catch (e) {}
      }
    }, 2500);
  },

  onStateUpdate(state) {
    if (this.playerId && !state.myId) {
      // Server restarted or player was removed/invalid
      this.playerId = '';
      sessionStorage.removeItem('bunker_player_id');
      localStorage.removeItem('bunker_player_id');
      if (this.roomId) localStorage.removeItem('bunker_player_id_' + this.roomId);
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.showScreen('screen-auth');
      this.showToast('⚠️ Вы были исключены или сессия была сброшена.');
      return;
    }

    const prevState = this.state;
    this.state = state;
    this.isHost = state.isHost;

    if (state.roomId) {
      this.roomId = state.roomId;
      localStorage.setItem('bunker_room_id', this.roomId);
    }

    const me = (state.players || []).find(p => p.id === state.myId);
    if (me && me.name) {
      this.playerName = me.name;
      sessionStorage.setItem('bunker_player_name', me.name);
    }

    // Header updates
    document.getElementById('btn-invite').classList.remove('hidden');
    document.getElementById('user-profile').classList.remove('hidden');
    document.getElementById('user-display-name').textContent = this.playerName || 'Игрок';

    const roomBadge = document.getElementById('room-code-badge');
    const headerRoomCode = document.getElementById('header-room-code');
    if (roomBadge && headerRoomCode) {
      headerRoomCode.textContent = this.roomId;
      roomBadge.classList.remove('hidden');
    }

    const roleBadge = document.getElementById('user-role-badge');
    const btnClaimHeader = document.getElementById('btn-claim-host-header');
    if (state.isHost) {
      roleBadge.textContent = '👑 Мастер';
      roleBadge.classList.add('master');
      if (btnClaimHeader) btnClaimHeader.classList.add('hidden');
    } else {
      roleBadge.textContent = 'Игрок';
      roleBadge.classList.remove('master');
      if (btnClaimHeader) btnClaimHeader.classList.remove('hidden');
    }

    // Status transition sound
    if (prevState && prevState.status !== state.status) {
      if (state.status === 'playing') this.playSound('start');
    }

    // Custom tags registration from active deck
    if (state.customTags && typeof TagHelper !== 'undefined') {
      TagHelper.registerCustomTags(state.customTags);
    }

    // System Lock Guardian Screen
    const lockModal = document.getElementById('modal-system-lock');
    if (lockModal) {
      if (state.systemLocked) {
        lockModal.classList.remove('hidden');
        const reasonEl = document.getElementById('system-lock-reason');
        if (reasonEl) reasonEl.textContent = state.systemLockReason || 'Сессия приостановлена для проверки лицензии.';
      } else {
        lockModal.classList.add('hidden');
      }
    }

    // Route screen
    const currentActive = document.querySelector('.screen.active');
    const isEditingDeck = currentActive && currentActive.id === 'screen-editor';

    if (state.status === 'lobby') {
      if (!isEditingDeck) {
        this.showScreen('screen-lobby');
      }
      if (typeof Lobby !== 'undefined') Lobby.render(state);
      const btnBackToResults = document.getElementById('btn-back-to-results');
      if (btnBackToResults) btnBackToResults.classList.add('hidden');
    } else if (state.status === 'ugc_building') {
      this.showScreen('screen-ugc');
      if (typeof UgcCreator !== 'undefined') UgcCreator.render(state);
      const btnBackToResults = document.getElementById('btn-back-to-results');
      if (btnBackToResults) btnBackToResults.classList.add('hidden');
    } else if (state.status === 'playing') {
      this.showScreen('screen-game');
      if (typeof GameBoard !== 'undefined') GameBoard.render(state);
      const btnBackToResults = document.getElementById('btn-back-to-results');
      if (btnBackToResults) btnBackToResults.classList.add('hidden');
    } else if (state.status === 'finished') {
      const isViewingTable = currentActive && currentActive.id === 'screen-game';
      const justFinished = prevState && prevState.status !== 'finished';

      if (justFinished || !isViewingTable) {
        this.showScreen('screen-results');
      }

      if (typeof GameBoard !== 'undefined') {
        GameBoard.render(state);
        if (state.results) {
          GameBoard.showResultsPage(state.results);
        }
      }

      const btnBackToResults = document.getElementById('btn-back-to-results');
      if (btnBackToResults) btnBackToResults.classList.remove('hidden');
    }

    // Activity logs
    if (state.logs) {
      const logsList = document.getElementById('logs-list');
      if (logsList) {
        logsList.innerHTML = state.logs.map(log => `
          <div class="log-entry">
            <span class="log-time">[${log.time}]</span>
            <span class="log-text">${log.text}</span>
          </div>
        `).join('');
      }
    }
  },

  getBestInviteUrl() {
    let net = (this.state && this.state.network) || {};
    const publicLink = (net.publicUrl || '').trim();
    if (publicLink) {
      return `${publicLink}/?room=${encodeURIComponent(this.roomId || '')}`;
    }
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.origin}/?room=${encodeURIComponent(this.roomId || '')}`;
    }
    const localLink = (net.localIpUrl || `${window.location.origin}/?room=${encodeURIComponent(this.roomId || '')}`).trim();
    return localLink;
  },

  async openInviteModal() {
    const modal = document.getElementById('invite-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const roomDisplay = document.getElementById('invite-room-code-display');
    if (roomDisplay) {
      roomDisplay.textContent = this.roomId || '';
    }

    const passRow = document.getElementById('invite-room-password-row');
    const passDisplay = document.getElementById('invite-room-password-display');
    const curPass = (this.state && (this.state.currentPassword || (this.state.hasPassword ? 'Задан' : ''))) || '';
    if (passRow && passDisplay) {
      if (curPass) {
        passDisplay.textContent = curPass;
        passRow.classList.remove('hidden');
      } else {
        passRow.classList.add('hidden');
      }
    }

    // Modal Copy Room Code Button
    const btnCopyCodeModal = document.getElementById('btn-copy-room-code-modal');
    if (btnCopyCodeModal) {
      btnCopyCodeModal.onclick = () => {
        if (!this.roomId) return;
        navigator.clipboard.writeText(this.roomId).then(() => {
          this.showToast(`📋 Код бункера "${this.roomId}" скопирован!`);
          this.playSound('click');
        });
      };
    }

    // Modal Full Invite Message Copy Button
    const btnCopyFull = document.getElementById('btn-copy-full-invite');
    if (btnCopyFull) {
      btnCopyFull.onclick = () => {
        const inviteUrl = this.getBestInviteUrl();
        const passText = (this.state && (this.state.currentPassword || (this.state.hasPassword ? '[Уточните у Мастера]' : ''))) || '';
        const text = `☢️ Игра «Бункер»!\n🚪 Код комнаты: ${this.roomId}\n${passText ? '🔒 Пароль: ' + passText + '\n' : '🔓 Вход без пароля\n'}🔗 Ссылка для входа: ${inviteUrl}`;
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('📋 Приглашение скопировано для отправки друзьям!');
          this.playSound('click');
        }).catch(() => {
          this.showToast('📋 Ссылка: ' + inviteUrl);
        });
      };
    }

    let net = (this.state && this.state.network) || {};
    try {
      const res = await fetch(`/api/network?room=${encodeURIComponent(this.roomId || '')}`, {
        headers: { 'x-room-id': this.roomId || '' }
      });
      if (res.ok) net = await res.json();
    } catch (e) {}

    const publicLink = (net.publicUrl || '').trim();
    const radminLink = net.radminIpUrl || '';
    const localLink = (net.localIpUrl || `${window.location.origin}/?room=${encodeURIComponent(this.roomId || '')}`).trim();
    const bestLink = this.getBestInviteUrl();

    const pubInput = document.getElementById('input-public-link');
    const pubGroup = document.getElementById('group-public-link');
    const radInput = document.getElementById('input-radmin-link');
    const locInput = document.getElementById('input-local-link');
    const radGroup = document.getElementById('group-radmin-link');

    if (pubInput) pubInput.value = publicLink ? `${publicLink}/?room=${encodeURIComponent(this.roomId || '')}` : '';
    if (pubGroup) {
      if (publicLink) pubGroup.classList.remove('hidden');
      else pubGroup.classList.add('hidden');
    }

    if (locInput) locInput.value = localLink;
    if (radInput) radInput.value = radminLink ? `${radminLink}/?room=${encodeURIComponent(this.roomId || '')}` : '';

    if (radGroup) {
      if (radminLink) {
        radGroup.classList.remove('hidden');
      } else {
        radGroup.classList.add('hidden');
      }
    }

    // Use active URL for QR Code (distinct per room!)
    const qrLink = (bestLink || localLink).trim();
    const qrContainer = document.getElementById('invite-qrcode');
    if (qrContainer && qrLink) {
      qrContainer.innerHTML = '';
      try {
        if (typeof QRCode !== 'undefined') {
          const correctLevel = (QRCode.CorrectLevel && QRCode.CorrectLevel.M !== undefined) ? QRCode.CorrectLevel.M : 0;
          new QRCode(qrContainer, {
            text: qrLink,
            width: 180,
            height: 180,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: correctLevel
          });
        }
      } catch (e) {
        qrContainer.innerHTML = `<div style="font-size: 11px; color: var(--accent-red); padding: 10px;">Ошибка генерации QR: ${e.message}</div>`;
      }
    }
  },

  copyInputLink(inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.value) return;

    navigator.clipboard.writeText(input.value).then(() => {
      this.showToast('📋 Ссылка скопирована!');
      this.playSound('click');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      this.showToast('📋 Ссылка скопирована!');
    });
  },

  async sendAction(action, payload = {}) {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-room-id': this.roomId || 'BUNKER-101'
        },
        body: JSON.stringify({
          action,
          playerId: this.playerId,
          roomId: this.roomId || 'BUNKER-101',
          payload
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка действия');
      return data;
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
      throw err;
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
