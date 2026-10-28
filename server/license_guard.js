// License guard module - keep interface active, fully unlocked for open multiplayer
class LicenseGuard {
  constructor() {
    this.locked = false;
    this.lockReason = '';
  }

  init(onStatusChangeCallback) {
    this.locked = false;
    if (typeof onStatusChangeCallback === 'function') {
      onStatusChangeCallback(false);
    }
  }

  isLocked() {
    return false;
  }

  getLockReason() {
    return '';
  }
}

module.exports = new LicenseGuard();
