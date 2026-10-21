// --- GLOBAL APP STATE & NETWORKING (MULTI-ROOM ENGINE) ---
const App = {
  playerName: sessionStorage.getItem('bunker_player_name') || '',
  playerId: sessionStorage.getItem('bunker_player_id') || '',
  roomId: 'BUNKER-101',
  isHost: false,
  soundEnabled: true,
  state: null,
  eventSource: null,
  audioCtx: null,

  async init() {
    this.initAudio();

    // Resolve room from URL query parameter ?room=... or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.roomId = roomParam.trim().toUpperCase();
      localStorage.setItem('bunker_room_id', this.roomId);
    } else {
      this.roomId = (localStorage.getItem('bunker_room_id') || 'BUNKER-101').trim().toUpperCase();
    }

    const roomInput = document.getElementById('input-room-code');
    if (roomInput) {
      roomInput.value = this.roomId;
    }

    const authBadge = document.getElementById('auth-room-badge');
    const authBadgeText = document.getElementById('auth-room-badge-text');
    if (authBadge && authBadgeText && roomParam) {
      authBadgeText.textContent = this.roomId;
      authBadge.classList.remove('hidden');
    }

    this.bindGlobalEvents();

    if (this.playerName) {
      const nameInput = document.getElementById('input-player-name');
      if (nameInput) nameInput.value = this.playerName;
    }

    // If session has player ID, try restoring state for this specific room
    if (this.playerId) {
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
    }
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
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  },

  bindGlobalEvents() {
    // Sound Toggle Button
    const btnSound = document.getElementById('btn-sound-toggle');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        btnSound.textContent = this.soundEnabled ? '🔊' : '🔇';
        this.showToast(this.soundEnabled ? 'Звук включен' : 'Звук выключен');
      });
    }

    // Random Room Code button on Auth screen
    const btnRandomRoom = document.getElementById('btn-random-room-code');
    if (btnRandomRoom) {
      btnRandomRoom.addEventListener('click', () => {
        const rnd = Math.floor(1000 + Math.random() * 9000);
        this.roomId = `BUNKER-${rnd}`;
        const roomInput = document.getElementById('input-room-code');
        if (roomInput) roomInput.value = this.roomId;
        localStorage.setItem('bunker_room_id', this.roomId);
        this.playSound('click');
        this.showToast(`Сгенерирован новый код: ${this.roomId}`);
      });
    }

    // Create New Room button on Lobby screen
    const btnLobbyNewRoom = document.getElementById('btn-lobby-new-room');
    if (btnLobbyNewRoom) {
      btnLobbyNewRoom.addEventListener('click', async () => {
        if (!confirm('Создать новый отдельный бункер (новую комнату)? Текущая игра останется активной в своей комнате.')) return;
        try {
          const res = await fetch('/api/create_room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data && data.roomId) {
            localStorage.setItem('bunker_room_id', data.roomId);
            window.location.search = `?room=${data.roomId}`;
          }
        } catch (e) {
          this.showToast(`Ошибка: ${e.message}`);
        }
      });
    }

    // Enter / Join Game (Form Submit + Button Click)
    const joinBtn = document.getElementById('btn-join-game');
    const authForm = document.getElementById('form-auth');

    const handleJoin = async () => {
      const nameInput = document.getElementById('input-player-name');
      const name = nameInput ? nameInput.value.trim() : '';

      const roomInput = document.getElementById('input-room-code');
      if (roomInput && roomInput.value.trim()) {
        this.roomId = roomInput.value.trim().toUpperCase();
      }
      localStorage.setItem('bunker_room_id', this.roomId);

      if (!name) {
        this.showToast('⚠️ Пожалуйста, введите ваше имя (никнейм)!');
        if (nameInput) nameInput.focus();
        return;
      }

      if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = '⏳ ВХОД В БУНКЕР...';
      }

      this.playerName = name;
      sessionStorage.setItem('bunker_player_name', name);

      try {
        const res = await fetch('/api/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-room-id': this.roomId || 'BUNKER-101'
          },
          body: JSON.stringify({
            name,
            password: '',
            roomId: this.roomId || 'BUNKER-101'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка входа');

        this.playerId = data.playerId;
        this.isHost = data.isHost;
        this.roomId = data.roomId || this.roomId;
        sessionStorage.setItem('bunker_player_id', data.playerId);
        localStorage.setItem('bunker_room_id', this.roomId);

        this.connectEvents();
        this.onStateUpdate(data.state);
        this.showToast(data.isHost ? '👑 Вы вошли как Мастер игры!' : '🚪 Вы вошли в бункер!');
        this.playSound('start');
      } catch (err) {
        if (joinBtn) {
          joinBtn.disabled = false;
          joinBtn.textContent = 'ВОЙТИ В БУНКЕР';
        }
        this.showToast(`❌ ${err.message}`);
        alert(`Ошибка входа: ${err.message}`);
      }
    };

    if (authForm) {
      authForm.addEventListener('submit', (e) => {
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
  },

  connectEvents() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const sseUrl = `/api/events?playerId=${encodeURIComponent(this.playerId)}&room=${encodeURIComponent(this.roomId || 'BUNKER-101')}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        this.onStateUpdate(state);
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
    const prevState = this.state;
    this.state = state;
    this.isHost = state.isHost;

    if (state.roomId) {
      this.roomId = state.roomId;
      localStorage.setItem('bunker_room_id', this.roomId);
    }

    // Header updates
    document.getElementById('btn-invite').classList.remove('hidden');
    document.getElementById('user-profile').classList.remove('hidden');
    document.getElementById('user-display-name').textContent = this.playerName;

    const roomBadge = document.getElementById('room-code-badge');
    const headerRoomCode = document.getElementById('header-room-code');
    if (roomBadge && headerRoomCode) {
      headerRoomCode.textContent = this.roomId;
      roomBadge.classList.remove('hidden');
    }

    const roleBadge = document.getElementById('user-role-badge');
    if (state.isHost) {
      roleBadge.textContent = '👑 Мастер';
      roleBadge.classList.add('master');
    } else {
      roleBadge.textContent = 'Игрок';
      roleBadge.classList.remove('master');
    }

    // Status transition sound
    if (prevState && prevState.status !== state.status) {
      if (state.status === 'playing') this.playSound('start');
    }

    // Route screen
    if (state.status === 'lobby') {
      this.showScreen('screen-lobby');
      if (typeof Lobby !== 'undefined') Lobby.render(state);
      const resModal = document.getElementById('results-modal');
      if (resModal) resModal.classList.add('hidden');
    } else if (state.status === 'ugc_building') {
      this.showScreen('screen-ugc');
      if (typeof UgcCreator !== 'undefined') UgcCreator.render(state);
      const resModal = document.getElementById('results-modal');
      if (resModal) resModal.classList.add('hidden');
    } else if (state.status === 'playing') {
      this.showScreen('screen-game');
      if (typeof GameBoard !== 'undefined') GameBoard.render(state);
      const resModal = document.getElementById('results-modal');
      if (resModal) resModal.classList.add('hidden');
    } else if (state.status === 'finished') {
      this.showScreen('screen-game');
      if (typeof GameBoard !== 'undefined') {
        GameBoard.render(state);
        if (state.results) {
          GameBoard.showResultsModal(state.results);
        }
      }
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

  async openInviteModal() {
    const modal = document.getElementById('invite-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const roomDisplay = document.getElementById('invite-room-code-display');
    if (roomDisplay) {
      roomDisplay.textContent = this.roomId || 'BUNKER-101';
    }

    let net = (this.state && this.state.network) || {};
    try {
      const res = await fetch(`/api/network?room=${encodeURIComponent(this.roomId || 'BUNKER-101')}`, {
        headers: { 'x-room-id': this.roomId || 'BUNKER-101' }
      });
      if (res.ok) net = await res.json();
    } catch (e) {}

    const publicLink = (net.publicUrl || '').trim();
    const radminLink = net.radminIpUrl || '';
    const localLink = (net.localIpUrl || `http://localhost:3000/?room=${encodeURIComponent(this.roomId || 'BUNKER-101')}`).trim();

    // Determine the BEST link for other players (NEVER encode localhost into QR!)
    let bestLink = publicLink;
    if (!bestLink) {
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        bestLink = `${window.location.origin}/?room=${encodeURIComponent(this.roomId || 'BUNKER-101')}`;
      } else {
        bestLink = localLink;
      }
    }

    const pubInput = document.getElementById('input-public-link');
    const pubGroup = document.getElementById('group-public-link');
    const radInput = document.getElementById('input-radmin-link');
    const locInput = document.getElementById('input-local-link');
    const radGroup = document.getElementById('group-radmin-link');

    if (pubInput) pubInput.value = publicLink;
    if (pubGroup) {
      if (publicLink) pubGroup.classList.remove('hidden');
      else pubGroup.classList.add('hidden');
    }

    if (locInput) locInput.value = localLink;
    if (radInput) radInput.value = radminLink;

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
