/**
 * Global activity logger for tracking all GTA operations
 */

class ActivityLogger {
  constructor() {
    this.logs = [];
    this.listeners = new Set();
    this.maxLogs = 1000;
  }

  log(type, message, data = {}) {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type, // info, success, warning, error, git, ai, github
      message,
      data,
    };

    this.logs.unshift(entry);

    // Keep only max logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Listener error:', err);
      }
    });

    return entry;
  }

  info(message, data) {
    return this.log('info', message, data);
  }

  success(message, data) {
    return this.log('success', message, data);
  }

  warning(message, data) {
    return this.log('warning', message, data);
  }

  error(message, data) {
    return this.log('error', message, data);
  }

  git(message, data) {
    return this.log('git', message, data);
  }

  ai(message, data) {
    return this.log('ai', message, data);
  }

  github(message, data) {
    return this.log('github', message, data);
  }

  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  getLogs(limit = 100) {
    return this.logs.slice(0, limit);
  }

  clear() {
    this.logs = [];
    this.log('info', 'Activity log cleared');
  }
}

export const activityLogger = new ActivityLogger();
