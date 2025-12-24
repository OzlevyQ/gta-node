/**
 * GTA Web Interface - Complete Application Logic
 * Pure vanilla JavaScript with real-time SSE logging
 */

// State management
let currentData = {};
let sseConnection = null;
let watchActive = false;

// =============================================================================
// API Functions
// =============================================================================

async function fetchAPI(endpoint) {
  const res = await fetch(`/api${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

async function postAPI(endpoint, data = {}) {
  const res = await fetch(`/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

// =============================================================================
// Real-Time Logging via SSE
// =============================================================================

function connectSSE() {
  if (sseConnection) return;

  sseConnection = new EventSource('/api/logs/stream');

  sseConnection.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'log') {
      addLogEntry(data.log);
    } else if (data.type === 'push_request') {
      showPushModal(data.unpushedCount, data.summary);
    } else if (data.type === 'watch_status') {
      updateWatchStatus(data);
    } else if (data.type === 'recommendations') {
      showRecommendations(data.warnings);
    }
  };

  sseConnection.onerror = () => {
    console.error('SSE connection error');
    sseConnection.close();
    sseConnection = null;
    // Retry after 5 seconds
    setTimeout(connectSSE, 5000);
  };
}

function updateWatchStatus(data) {
  const container = document.getElementById('activity-log');
  if (!container) return;

  // Find or create watch status element
  let statusEl = document.getElementById('watch-status-display');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'watch-status-display';
    statusEl.className = 'watch-status';
    container.insertBefore(statusEl, container.firstChild);
  }

  if (data.status === 'watching') {
    statusEl.innerHTML = `
      <span class="watch-icon">👁️</span>
      <span class="watch-message">Watching... ${data.elapsed}s</span>
    `;
    statusEl.className = 'watch-status watching';
  } else if (data.status === 'change_detected') {
    statusEl.innerHTML = `
      <span class="watch-icon">📝</span>
      <span class="watch-message">Changes detected (${data.size} lines) - waiting for stability...</span>
    `;
    statusEl.className = 'watch-status detecting';
  } else if (data.status === 'unstable') {
    statusEl.innerHTML = `
      <span class="watch-icon">⏳</span>
      <span class="watch-message">Stabilizing... ${data.elapsed}s (${data.size} lines)</span>
    `;
    statusEl.className = 'watch-status unstable';
  }
}

function showRecommendations(warnings) {
  // Create notification
  const notification = document.createElement('div');
  notification.className = 'notification warning';
  notification.innerHTML = `
    <div class="notification-header">
      <span class="notification-icon">⚠️</span>
      <span class="notification-title">${warnings.length} Recommendation(s)</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
    <div class="notification-body">
      ${warnings.map(w => `<div class="notification-item">${escapeHtml(w)}</div>`).join('')}
    </div>
  `;

  // Add to body
  let notifContainer = document.getElementById('notifications');
  if (!notifContainer) {
    notifContainer = document.createElement('div');
    notifContainer.id = 'notifications';
    notifContainer.className = 'notifications-container';
    document.body.appendChild(notifContainer);
  }

  notifContainer.appendChild(notification);

  // Auto remove after 10 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

function addLogEntry(log) {
  const container = document.getElementById('activity-log');
  const fullContainer = document.getElementById('full-activity-log');

  const time = new Date(log.timestamp).toLocaleTimeString();
  const entry = `
    <div class="log-entry">
      <span class="log-time">${time}</span>
      <span class="log-type ${log.type}">${log.type.toUpperCase()}</span>
      <span class="log-message">${escapeHtml(log.message)}</span>
    </div>
  `;

  if (container) {
    container.insertAdjacentHTML('afterbegin', entry);
    // Keep only last 50 entries in sidebar
    while (container.children.length > 50) {
      container.removeChild(container.lastChild);
    }
  }

  if (fullContainer) {
    fullContainer.insertAdjacentHTML('afterbegin', entry);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =============================================================================
// Watch Mode Control
// =============================================================================

async function toggleWatch() {
  const btn = document.getElementById('watch-toggle');
  const text = document.getElementById('watch-text');

  try {
    if (watchActive) {
      await postAPI('/watch/stop');
      watchActive = false;
      btn.classList.remove('active');
      text.textContent = 'Start Watch';
    } else {
      await postAPI('/watch/start');
      watchActive = true;
      btn.classList.add('active');
      text.textContent = 'Stop Watch';
    }
  } catch (error) {
    console.error('Watch toggle error:', error);
    alert(`Failed to ${watchActive ? 'stop' : 'start'} watch mode: ${error.message}`);
  }
}

async function loadWatchStatus() {
  try {
    const status = await fetchAPI('/watch/status');
    watchActive = status.active;
    const btn = document.getElementById('watch-toggle');
    const text = document.getElementById('watch-text');

    if (watchActive) {
      btn.classList.add('active');
      text.textContent = 'Stop Watch';
    } else {
      btn.classList.remove('active');
      text.textContent = 'Start Watch';
    }
  } catch (error) {
    console.error('Failed to load watch status:', error);
  }
}

// =============================================================================
// Page Navigation
// =============================================================================

function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.content').forEach(el => {
    el.classList.add('hidden');
  });

  // Remove active from all nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected page
  const page = document.getElementById(`${pageName}-page`);
  if (page) {
    page.classList.remove('hidden');
  }

  // Activate nav button
  const navBtn = document.querySelector(`[data-page="${pageName}"]`);
  if (navBtn) {
    navBtn.classList.add('active');
  }

  // Load page-specific data
  if (pageName === 'config') {
    loadConfigForm();
  } else if (pageName === 'git') {
    loadGitPage();
  } else if (pageName === 'activity') {
    loadFullActivityLog();
  }
}

// =============================================================================
// Dashboard Page
// =============================================================================

async function loadDashboard() {
  try {
    const data = await fetchAPI('/status');
    currentData = data;

    updateRepoInfo(data.repo);
    updateAutomationInfo(data.config);
    updateCommitsLog(data.repo.log);

  } catch (error) {
    console.error('Failed to load dashboard:', error);
    showError('Failed to load dashboard data');
  }
}

function updateRepoInfo(repo) {
  const container = document.getElementById('repo-info');

  const statusBadge = repo.hasChanges
    ? '<span class="badge badge-warning">Changes</span>'
    : '<span class="badge badge-success">Clean</span>';

  container.innerHTML = `
    <div class="info-row">
      <span class="info-label">Repository</span>
      <span class="info-value">${escapeHtml(repo.name)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Branch</span>
      <span class="info-value">${escapeHtml(repo.branch)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Remote</span>
      <span class="info-value">${escapeHtml(repo.remote || 'None')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Status</span>
      <span class="info-value">${statusBadge}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Changed Lines</span>
      <span class="info-value">${repo.changeSize}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Unpushed Commits</span>
      <span class="info-value">${repo.unpushedCount}</span>
    </div>
  `;
}

function updateAutomationInfo(config) {
  const container = document.getElementById('automation-info');

  const aiCommitBadge = config.aiCommitMessages
    ? '<span class="badge badge-success">Enabled</span>'
    : '<span class="badge badge-info">Disabled</span>';

  container.innerHTML = `
    <div class="info-row">
      <span class="info-label">Mode</span>
      <span class="info-value">${escapeHtml(config.autoMode)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Threshold</span>
      <span class="info-value">${config.commitThreshold} lines</span>
    </div>
    <div class="info-row">
      <span class="info-label">AI Provider</span>
      <span class="info-value">${escapeHtml(config.aiProvider)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">AI Commits</span>
      <span class="info-value">${aiCommitBadge}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Summary Trigger</span>
      <span class="info-value">${config.commitsBeforeSummary} commits</span>
    </div>
  `;
}

function updateCommitsLog(logText) {
  const container = document.getElementById('commits-log');

  if (!logText || logText.trim() === '') {
    container.innerHTML = '<div class="commit-line">No recent commits</div>';
    return;
  }

  const lines = logText.trim().split('\n');
  container.innerHTML = lines
    .map(line => {
      // Extract commit hash and message
      const match = line.match(/^\*\s+(\w+)\s+(.+)$/);
      if (match) {
        const hash = match[1];
        const message = match[2];

        // Try to extract timestamp from message (HH:MM:SS format)
        const timeMatch = message.match(/^(\d{2}:\d{2}:\d{2})\s*(.+)$/);
        if (timeMatch) {
          return `<div class="commit-line"><span class="commit-time">${timeMatch[1]}</span> ${escapeHtml(timeMatch[2])}</div>`;
        }

        return `<div class="commit-line">${escapeHtml(line)}</div>`;
      }
      return `<div class="commit-line">${escapeHtml(line)}</div>`;
    })
    .join('');
}

// Quick actions
async function quickCommit() {
  if (!currentData.repo?.hasChanges) {
    alert('No changes to commit');
    return;
  }

  const btn = document.getElementById('quick-commit-btn');
  btn.disabled = true;
  btn.textContent = 'Committing...';

  try {
    const result = await postAPI('/commit');
    await loadDashboard();
    showSuccess(`Committed: ${result.message}`);
  } catch (error) {
    showError(`Commit failed: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Commit Changes';
  }
}

async function quickPush() {
  if (!currentData.repo?.unpushedCount || currentData.repo.unpushedCount === 0) {
    alert('No commits to push');
    return;
  }

  const btn = document.getElementById('quick-push-btn');
  btn.disabled = true;
  btn.textContent = 'Pushing...';

  try {
    await postAPI('/push');
    await loadDashboard();
    showSuccess(`Pushed ${currentData.repo.unpushedCount} commits`);
  } catch (error) {
    showError(`Push failed: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Push';
  }
}

async function refreshDashboard() {
  await loadDashboard();
}

async function clearActivityLog() {
  try {
    await postAPI('/logs/clear');
    document.getElementById('activity-log').innerHTML = '';
    showSuccess('Activity log cleared');
  } catch (error) {
    showError('Failed to clear log');
  }
}

// =============================================================================
// Git Operations Page
// =============================================================================

async function loadGitPage() {
  try {
    const data = await fetchAPI('/status');
    currentData = data;

    // Update current branch
    document.getElementById('current-branch').textContent = data.repo.branch;

    // Update git status
    const statusText = data.repo.hasChanges
      ? `${data.repo.changeSize} lines changed`
      : 'Working tree clean';
    document.getElementById('git-status').textContent = statusText;
    document.getElementById('git-changes').textContent = data.repo.changeSize;
    document.getElementById('git-unpushed').textContent = data.repo.unpushedCount;

    // Load branches
    const branches = await fetchAPI('/branches');
    const select = document.getElementById('branch-select');
    select.innerHTML = branches
      .map(branch => {
        const selected = branch === data.repo.branch ? ' selected' : '';
        return `<option${selected}>${escapeHtml(branch)}</option>`;
      })
      .join('');

    // Load remote URL
    document.getElementById('remote-url').value = data.repo.remote || '';

  } catch (error) {
    console.error('Failed to load git page:', error);
    showError('Failed to load git operations data');
  }
}

async function switchBranch() {
  const select = document.getElementById('branch-select');
  const branch = select.value;

  if (!branch) return;

  const btn = document.getElementById('switch-branch-btn');
  btn.disabled = true;
  btn.textContent = 'Switching...';

  try {
    await postAPI('/branch/switch', { branch });
    await loadGitPage();
    await loadDashboard();
    showSuccess(`Switched to branch: ${branch}`);
  } catch (error) {
    showError(`Failed to switch branch: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Switch Branch';
  }
}

async function createBranch() {
  const input = document.getElementById('new-branch-name');
  const name = input.value.trim();

  if (!name) {
    alert('Please enter a branch name');
    return;
  }

  const btn = document.getElementById('create-branch-btn');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    await postAPI('/branch/create', { name });
    input.value = '';
    await loadGitPage();
    showSuccess(`Created branch: ${name}`);
  } catch (error) {
    showError(`Failed to create branch: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Branch';
  }
}

async function generateCommit() {
  if (!currentData.repo?.hasChanges) {
    alert('No changes to commit');
    return;
  }

  const btn = document.getElementById('generate-commit-btn');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const result = await postAPI('/commit/generate');
    await loadGitPage();
    await loadDashboard();
    showSuccess(`AI committed: ${result.message}`);
  } catch (error) {
    showError(`AI commit failed: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI Commit';
  }
}

async function manualCommit() {
  if (!currentData.repo?.hasChanges) {
    alert('No changes to commit');
    return;
  }

  const message = prompt('Enter commit message:');
  if (!message || message.trim() === '') return;

  const btn = document.getElementById('manual-commit-btn');
  btn.disabled = true;
  btn.textContent = 'Committing...';

  try {
    await postAPI('/commit', { message: message.trim() });
    await loadGitPage();
    await loadDashboard();
    showSuccess(`Committed: ${message}`);
  } catch (error) {
    showError(`Commit failed: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Manual Commit';
  }
}

async function pushChanges() {
  if (!currentData.repo?.unpushedCount || currentData.repo.unpushedCount === 0) {
    alert('No commits to push');
    return;
  }

  const btn = document.getElementById('push-btn');
  btn.disabled = true;
  btn.textContent = 'Pushing...';

  try {
    await postAPI('/push');
    await loadGitPage();
    await loadDashboard();
    showSuccess(`Pushed ${currentData.repo.unpushedCount} commits`);
  } catch (error) {
    showError(`Push failed: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Push';
  }
}

async function setRemote() {
  const input = document.getElementById('remote-url');
  const url = input.value.trim();

  if (!url) {
    alert('Please enter a remote URL');
    return;
  }

  const btn = document.getElementById('set-remote-btn');
  btn.disabled = true;
  btn.textContent = 'Setting...';

  try {
    await postAPI('/remote/set', { url });
    await loadGitPage();
    await loadDashboard();
    showSuccess('Remote URL updated');
  } catch (error) {
    showError(`Failed to set remote: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Set Remote';
  }
}

// =============================================================================
// Configuration Page
// =============================================================================

async function loadConfigForm() {
  try {
    const config = await fetchAPI('/config');

    document.getElementById('config-autoMode').value = config.autoMode;
    document.getElementById('config-commitThreshold').value = config.commitThreshold;
    document.getElementById('config-aiProvider').value = config.aiProvider;
    document.getElementById('config-aiModel').value = config.aiModel;
    document.getElementById('config-aiCommitMessages').value = String(config.aiCommitMessages);
    document.getElementById('config-commitsBeforeSummary').value = config.commitsBeforeSummary;
    document.getElementById('config-autoSummaryAndPush').value = String(config.autoSummaryAndPush);
    document.getElementById('config-defaultBranch').value = config.defaultBranch;

  } catch (error) {
    console.error('Failed to load config:', error);
    showError('Failed to load configuration');
  }
}

async function saveConfig() {
  const btn = document.getElementById('save-config-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const updates = {
      autoMode: document.getElementById('config-autoMode').value,
      commitThreshold: parseInt(document.getElementById('config-commitThreshold').value),
      aiProvider: document.getElementById('config-aiProvider').value,
      aiModel: document.getElementById('config-aiModel').value,
      aiCommitMessages: document.getElementById('config-aiCommitMessages').value === 'true',
      commitsBeforeSummary: parseInt(document.getElementById('config-commitsBeforeSummary').value),
      autoSummaryAndPush: document.getElementById('config-autoSummaryAndPush').value === 'true',
      defaultBranch: document.getElementById('config-defaultBranch').value,
    };

    // Send each config update
    for (const [key, value] of Object.entries(updates)) {
      await postAPI('/config', { key, value });
    }

    await loadDashboard();
    showSuccess('Configuration saved');

  } catch (error) {
    showError(`Failed to save config: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

// =============================================================================
// Activity Log Page
// =============================================================================

async function loadFullActivityLog() {
  try {
    const logs = await fetchAPI('/logs');
    const container = document.getElementById('full-activity-log');

    if (logs.length === 0) {
      container.innerHTML = '<div class="log-entry"><span class="log-message">No activity logged yet</span></div>';
      return;
    }

    container.innerHTML = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `
        <div class="log-entry">
          <span class="log-time">${time}</span>
          <span class="log-type ${log.type}">${log.type.toUpperCase()}</span>
          <span class="log-message">${escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Failed to load activity log:', error);
  }
}

async function clearFullActivityLog() {
  try {
    await postAPI('/logs/clear');
    document.getElementById('full-activity-log').innerHTML = '';
    document.getElementById('activity-log').innerHTML = '';
    showSuccess('Activity log cleared');
  } catch (error) {
    showError('Failed to clear log');
  }
}

// =============================================================================
// Push Modal
// =============================================================================

function showPushModal(unpushedCount, summary) {
  const modal = document.getElementById('push-modal');
  const summaryEl = document.getElementById('push-summary');
  const commitsEl = document.getElementById('push-commits');

  summaryEl.textContent = `You have ${unpushedCount} unpushed commits. AI-generated summary:`;
  commitsEl.innerHTML = `<div class="commit-line">${escapeHtml(summary)}</div>`;

  modal.classList.remove('hidden');
}

function hidePushModal() {
  document.getElementById('push-modal').classList.add('hidden');
}

async function confirmPush() {
  hidePushModal();

  try {
    await postAPI('/push');
    await loadDashboard();
    await loadGitPage();
    showSuccess('Changes pushed successfully');
  } catch (error) {
    showError(`Push failed: ${error.message}`);
  }
}

// =============================================================================
// Notifications
// =============================================================================

function showSuccess(message) {
  // Could implement toast notifications here
  console.log('SUCCESS:', message);
}

function showError(message) {
  // Could implement toast notifications here
  console.error('ERROR:', message);
  alert(message);
}

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Connect SSE for real-time logs
  connectSSE();

  // Setup navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = e.target.dataset.page;
      showPage(page);
    });
  });

  // Setup watch toggle
  document.getElementById('watch-toggle').addEventListener('click', toggleWatch);

  // Dashboard page buttons
  document.getElementById('refresh-btn').addEventListener('click', refreshDashboard);
  document.getElementById('quick-commit-btn').addEventListener('click', quickCommit);
  document.getElementById('quick-push-btn').addEventListener('click', quickPush);
  document.getElementById('clear-log-btn').addEventListener('click', clearActivityLog);

  // Git operations page buttons
  document.getElementById('switch-branch-btn').addEventListener('click', switchBranch);
  document.getElementById('create-branch-btn').addEventListener('click', createBranch);
  document.getElementById('generate-commit-btn').addEventListener('click', generateCommit);
  document.getElementById('manual-commit-btn').addEventListener('click', manualCommit);
  document.getElementById('push-btn').addEventListener('click', pushChanges);
  document.getElementById('set-remote-btn').addEventListener('click', setRemote);

  // Configuration page buttons
  document.getElementById('save-config-btn').addEventListener('click', saveConfig);

  // Activity log page buttons
  document.getElementById('clear-activity-btn').addEventListener('click', clearFullActivityLog);

  // Push modal buttons
  document.getElementById('push-cancel').addEventListener('click', hidePushModal);
  document.getElementById('push-confirm').addEventListener('click', confirmPush);

  // Load initial data
  await loadWatchStatus();
  await loadDashboard();

  // Auto-refresh dashboard every 10 seconds
  setInterval(loadDashboard, 10000);
});
