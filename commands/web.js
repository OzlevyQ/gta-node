import pc from 'picocolors';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import * as net from 'net';
import { execa } from 'execa';
import {
  isGitRepo,
  getCurrentBranch,
  getRemoteUrl,
  hasChanges,
  getChangeSize,
  commitChanges,
  pushChanges,
  getRepoName,
  getUnpushedCommitsCount,
  getUnpushedCommits,
  getLog,
  listBranches,
  createBranch,
  switchBranch,
  setRemoteUrl,
} from '../lib/git.js';
import { config } from '../lib/config.js';
import { generateCommitMessage, summarizeCommits } from '../lib/ai.js';
import { activityLogger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webDir = join(__dirname, '..', 'web');

// Active SSE clients
const sseClients = new Set();

// Cloudflared process
let cloudflaredProcess = null;
let tunnelUrl = null;

// Find available port
async function findAvailablePort(startPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(startPort, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });

    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// Start cloudflared tunnel
async function startCloudflaredTunnel(port) {
  // Pre-check if cloudflared exists
  try {
    await execa('which', ['cloudflared']);
  } catch {
    console.log(pc.yellow('\n  ⚠️  cloudflared not found'));
    console.log(pc.dim('  Install with: brew install cloudflared'));
    console.log(pc.dim('  Or visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/\n'));
    return;
  }

  try {
    console.log(pc.dim('  Starting cloudflared tunnel...'));

    // We don't await this because it's a long-running process
    cloudflaredProcess = execa('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);

    // Catch unhandled rejections (failed start) to prevent crash
    cloudflaredProcess.catch(err => {
      if (!err.killed && !err.message.includes('SIGTERM')) {
        activityLogger.error('Cloudflared exited unexpectedly', { error: err.message });
      }
    });

    // Listen to output to catch the tunnel URL
    const parseOutput = (data) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !tunnelUrl) {
        tunnelUrl = match[0];
        console.log(pc.green(`\n  ✓ Cloudflare Tunnel running!`));
        console.log(pc.cyan(`  Public: ${tunnelUrl}`));
        console.log();
        activityLogger.success(`Cloudflare tunnel started: ${tunnelUrl}`);
      }
    };

    cloudflaredProcess.stdout.on('data', parseOutput);

    // Cloudflared often interprets "info" logs as stderr
    cloudflaredProcess.stderr.on('data', (data) => {
      const output = data.toString();

      // Parse for URL in stderr too
      parseOutput(data);

      // Only show actual errors, not info messages
      if (output.includes('ERR') || output.includes('error')) {
        // console.error(pc.red(`  Cloudflared: ${output.trim()}`));
      }
    });

  } catch (error) {
    console.log(pc.yellow(`  ⚠️  Could not start cloudflared tunnel`));
    console.log(pc.dim(`  ${error.message}`));
  }
}

// Stop cloudflared tunnel
function stopCloudflaredTunnel() {
  if (cloudflaredProcess) {
    cloudflaredProcess.kill();
    cloudflaredProcess = null;
    tunnelUrl = null;
  }
}

// Watch mode state
let watchInterval = null;
let isWatchMode = false;
let watchStartTime = null;
let lastChangeDetected = null;
let lastChangeSize = 0;
let isProcessing = false;

// Send SSE message to all clients
function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  });
}

// Setup activity logger to broadcast
activityLogger.addListener((entry) => {
  broadcastSSE({ type: 'log', log: entry });
});

// Smart watch mode with stability detection
async function smartWatch() {
  if (isProcessing) return;

  try {
    const cfg = config.getAll();
    const changes = await hasChanges();

    // No changes - broadcast running timer
    if (!changes) {
      if (watchStartTime) {
        const elapsed = Math.floor((Date.now() - watchStartTime) / 1000);
        broadcastSSE({
          type: 'watch_status',
          status: 'watching',
          elapsed,
          message: `Watching... (${elapsed}s)`
        });
      }
      lastChangeDetected = null;
      lastChangeSize = 0;
      return;
    }

    // Changes detected
    const size = await getChangeSize();
    const now = Date.now();

    // First detection or size changed (new changes)
    if (!lastChangeDetected || size !== lastChangeSize) {
      lastChangeDetected = now;
      lastChangeSize = size;
      activityLogger.info(`📝 Change detected: ${size} lines`);
      broadcastSSE({
        type: 'watch_status',
        status: 'change_detected',
        size,
        message: 'Waiting for stability...'
      });
      return;
    }

    // Check if stable (no new changes for 3 seconds)
    const stabilityPeriod = 3000;
    const timeSinceLastChange = now - lastChangeDetected;

    if (timeSinceLastChange < stabilityPeriod) {
      // Still stabilizing
      broadcastSSE({
        type: 'watch_status',
        status: 'unstable',
        size,
        elapsed: Math.floor(timeSinceLastChange / 1000),
        message: `Stabilizing... ${Math.floor(timeSinceLastChange / 1000)}s`
      });
      return;
    }

    // Stable! Check threshold
    if (size < cfg.commitThreshold) {
      activityLogger.info(`Below threshold: ${size}/${cfg.commitThreshold} lines`);
      lastChangeDetected = null;
      lastChangeSize = 0;
      return;
    }

    // Process commit
    isProcessing = true;
    activityLogger.git(`🚀 Processing ${size} lines...`);

    // Check for sensitive files
    const warnings = await checkSensitiveFiles();
    if (warnings.length > 0) {
      broadcastSSE({
        type: 'recommendations',
        warnings,
        message: `⚠️ ${warnings.length} recommendation(s)`
      });
    }

    // Process based on mode
    if (cfg.autoMode === 'confirm') {
      // CONFIRM MODE - Request approval via web UI
      activityLogger.info(`📋 Awaiting confirmation for ${size} lines...`);

      broadcastSSE({
        type: 'commit_request',
        size,
        warnings,
        message: `${size} lines ready - awaiting confirmation`
      });

      // Don't auto-commit - wait for user action
      lastChangeDetected = null;
      lastChangeSize = 0;
      isProcessing = false;

    } else if (cfg.autoMode === 'auto') {
      let message;
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

      if (cfg.aiCommitMessages && cfg.aiProvider !== 'none') {
        try {
          activityLogger.ai('🤖 Generating commit message...');
          message = await generateCommitMessage();
          message = `${timestamp} ${message}`;
          activityLogger.ai(`Generated: "${message}"`);
        } catch (error) {
          activityLogger.warning('AI failed, using fallback');
          message = `${timestamp} chore(auto): update`;
        }
      } else {
        message = `${timestamp} chore(auto): update`;
      }

      const result = await commitChanges(message);
      if (result.committed) {
        activityLogger.success(`✅ Committed: ${message}`);

        // Check for summary
        const unpushedCount = await getUnpushedCommitsCount();
        if (cfg.autoSummaryAndPush && unpushedCount >= cfg.commitsBeforeSummary) {
          activityLogger.info(`📦 ${unpushedCount} commits - creating summary...`);

          try {
            const summary = await summarizeCommits(unpushedCount);
            activityLogger.ai(`Summary ready`);

            broadcastSSE({
              type: 'push_request',
              unpushedCount,
              summary,
              commits: await getUnpushedCommits(),
            });
          } catch (error) {
            activityLogger.error('Summary failed', { error: error.message });
          }
        }
      }

      lastChangeDetected = null;
      lastChangeSize = 0;
      isProcessing = false;
      watchStartTime = Date.now();

    } else {
      // MANUAL MODE - Just notify
      activityLogger.info(`⚠️ ${size} lines ready (mode: manual)`);
      lastChangeDetected = null;
      lastChangeSize = 0;
      isProcessing = false;
    }

  } catch (error) {
    activityLogger.error('Watch error', { error: error.message });
    isProcessing = false;
    lastChangeDetected = null;
  }
}

// Check for sensitive files
async function checkSensitiveFiles() {
  const warnings = [];
  const sensitivePatterns = ['.env', 'credentials', 'secrets', 'password', 'private', '.pem', '.key'];

  try {
    const { stdout } = await execa('git', ['diff', '--cached', '--name-only']);
    const files = stdout.split('\n').filter(Boolean);

    for (const file of files) {
      const lower = file.toLowerCase();
      for (const pattern of sensitivePatterns) {
        if (lower.includes(pattern)) {
          warnings.push(`Sensitive file detected: ${file}`);
          break;
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return warnings;
}

// Start watch mode
function startWatchMode() {
  if (watchInterval) return;

  isWatchMode = true;
  watchStartTime = Date.now();
  lastChangeDetected = null;
  isProcessing = false;

  activityLogger.success('👁️  Watch mode started');

  watchInterval = setInterval(async () => {
    await smartWatch();
  }, 1000); // Check every second
}

// Stop watch mode
function stopWatchMode() {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
    isWatchMode = false;
    watchStartTime = null;
    lastChangeDetected = null;
    isProcessing = false;
    activityLogger.info('Watch mode stopped');
  }
}

// Parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Serve static files
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = readFileSync(join(webDir, 'index.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    if (url.pathname === '/styles.css') {
      const css = readFileSync(join(webDir, 'styles.css'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(css);
      return;
    }

    if (url.pathname === '/app.js') {
      const js = readFileSync(join(webDir, 'app.js'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(js);
      return;
    }

    // SSE endpoint for real-time logs
    if (url.pathname === '/api/logs/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      sseClients.add(res);

      // Send existing logs
      const logs = activityLogger.getLogs(50);
      res.write(`data: ${JSON.stringify({ type: 'history', logs })}\n\n`);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // API endpoints
    if (url.pathname === '/api/status') {
      const isRepo = await isGitRepo();
      if (!isRepo) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not a git repository' }));
        return;
      }

      const [
        repoName,
        branch,
        remote,
        changes,
        changeSize,
        unpushedCount,
        log,
        branches,
      ] = await Promise.all([
        getRepoName(),
        getCurrentBranch(),
        getRemoteUrl(),
        hasChanges(),
        getChangeSize(),
        getUnpushedCommitsCount(),
        getLog(10),
        listBranches(),
      ]);

      const cfg = config.getAll();

      const data = {
        repo: {
          name: repoName,
          branch,
          remote,
          hasChanges: changes,
          changeSize,
          unpushedCount,
          log,
          branches,
        },
        config: cfg,
        watchMode: isWatchMode,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (url.pathname === '/api/logs' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const logs = activityLogger.getLogs(limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(logs));
      return;
    }

    if (url.pathname === '/api/logs/clear' && req.method === 'POST') {
      activityLogger.clear();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url.pathname === '/api/tunnel' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tunnelUrl: tunnelUrl || null,
        hasTunnel: !!tunnelUrl
      }));
      return;
    }

    if (url.pathname === '/api/commit' && req.method === 'POST') {
      const isRepo = await isGitRepo();
      if (!isRepo) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not a git repository' }));
        return;
      }

      activityLogger.git('Creating commit...');

      const cfg = config.getAll();
      let message;

      if (cfg.aiCommitMessages && cfg.aiProvider !== 'none') {
        try {
          activityLogger.ai('Generating commit message with AI...');
          message = await generateCommitMessage();
          activityLogger.ai(`Generated: "${message}"`);
        } catch (error) {
          activityLogger.warning('AI generation failed, using fallback');
          message = `chore: update ${new Date().toISOString().split('T')[0]}`;
        }
      } else {
        message = `chore: update ${new Date().toISOString().split('T')[0]}`;
      }

      const result = await commitChanges(message);

      if (result.committed) {
        activityLogger.success(`✓ Committed: ${message}`);
      } else {
        activityLogger.info('No changes to commit');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/commit/generate' && req.method === 'POST') {
      activityLogger.ai('Generating AI commit message...');
      const message = await generateCommitMessage();
      activityLogger.ai(`Generated: "${message}"`);

      const result = await commitChanges(message);
      if (result.committed) {
        activityLogger.success(`✓ Committed with AI: ${message}`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/push' && req.method === 'POST') {
      activityLogger.git('Pushing to remote...');
      const branch = await getCurrentBranch();
      const result = await pushChanges(branch);

      if (result.success) {
        activityLogger.success(`✓ Pushed to ${branch}`);
      } else {
        activityLogger.error('Push failed', { error: result.error });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/branches' && req.method === 'GET') {
      const branches = await listBranches();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(branches));
      return;
    }

    if (url.pathname === '/api/branch/create' && req.method === 'POST') {
      const body = await parseBody(req);
      const { name } = body;

      if (!name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Branch name required' }));
        return;
      }

      activityLogger.git(`Creating branch: ${name}`);
      await createBranch(name);
      activityLogger.success(`✓ Created and switched to ${name}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, branch: name }));
      return;
    }

    if (url.pathname === '/api/branch/switch' && req.method === 'POST') {
      const body = await parseBody(req);
      const { ref } = body;

      if (!ref) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Branch ref required' }));
        return;
      }

      activityLogger.git(`Switching to: ${ref}`);
      await switchBranch(ref);
      activityLogger.success(`✓ Switched to ${ref}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ref }));
      return;
    }

    if (url.pathname === '/api/config' && req.method === 'GET') {
      const cfg = config.getAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cfg));
      return;
    }

    if (url.pathname === '/api/config' && req.method === 'POST') {
      const body = await parseBody(req);
      const { key, value } = body;

      if (!key) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Key required' }));
        return;
      }

      activityLogger.info(`Config update: ${key} = ${value}`);
      config.set(key, value);
      activityLogger.success(`✓ Updated ${key}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, key, value }));
      return;
    }

    if (url.pathname === '/api/watch/start' && req.method === 'POST') {
      startWatchMode();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, watching: true }));
      return;
    }

    if (url.pathname === '/api/watch/stop' && req.method === 'POST') {
      stopWatchMode();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, watching: false }));
      return;
    }

    if (url.pathname === '/api/watch/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ watching: isWatchMode }));
      return;
    }

    if (url.pathname === '/api/remote/set' && req.method === 'POST') {
      const body = await parseBody(req);
      const { url: remoteUrl } = body;

      if (!remoteUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Remote URL required' }));
        return;
      }

      activityLogger.github(`Setting remote: ${remoteUrl}`);
      await setRemoteUrl(remoteUrl);
      activityLogger.success(`✓ Remote set to ${remoteUrl}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, url: remoteUrl }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (error) {
    activityLogger.error('API Error', { error: error.message, path: url.pathname });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

export function webCommand(program) {
  program
    .command('web')
    .description('Launch web interface for GTA with full automation')
    .option('-p, --port <port>', 'Port to run server on (default: auto-detect)')
    .option('--no-open', 'Do not open browser automatically')
    .option('--no-watch', 'Do not start watch mode automatically')
    .option('--no-tunnel', 'Do not start cloudflared tunnel')
    .action(async (options) => {
      // Check for lock
      const { acquireLock, releaseLock } = await import('../lib/lock.js');
      const lock = acquireLock('web', options.force);

      if (!lock.acquired) {
        console.log(pc.red(`\n❌ GTA Web is already running for this repository!`));
        console.log(pc.white(`   PID: ${lock.pid}`));
        console.log(pc.dim(`\n   To stop it, run: kill ${lock.pid}`));
        console.log(pc.dim(`   To ignore this lock, run: gta web --force`));
        process.exit(1);
      }

      // Find available port
      const requestedPort = options.port ? parseInt(options.port) : 3000;
      const port = await findAvailablePort(requestedPort);

      if (port !== requestedPort && options.port) {
        console.log(pc.yellow(`  Port ${requestedPort} is busy, using ${port} instead`));
      }

      const server = createServer(handleRequest);

      server.listen(port, async () => {
        console.log(pc.green(`\n✓ GTA Web Interface running!`));
        console.log(pc.cyan(`  Local:  http://localhost:${port}`));
        console.log(pc.dim(`  Files:  ${webDir}`));
        console.log(pc.dim(`  Repo:   ${process.cwd()}`));

        activityLogger.success(`Web server started on port ${port}`);

        // Start cloudflared tunnel if not disabled
        if (options.tunnel !== false) {
          await startCloudflaredTunnel(port);
        }

        // Start watch mode automatically if in git repo and not disabled
        if (options.watch !== false) {
          const isRepo = await isGitRepo();
          if (isRepo) {
            startWatchMode();
            console.log(pc.green(`  ✓ Watch mode started automatically`));
          }
        }

        console.log(pc.dim(`\n  Press Ctrl-C to stop\n`));

        // Open browser
        if (options.open) {
          // Prefer tunnel URL if available, otherwise local
          const url = tunnelUrl || `http://localhost:${port}`;
          const command = process.platform === 'darwin' ? 'open' :
            process.platform === 'win32' ? 'start' : 'xdg-open';

          // Wait a bit for tunnel URL to be ready
          setTimeout(() => {
            const finalUrl = tunnelUrl || `http://localhost:${port}`;
            exec(`${command} ${finalUrl}`, (error) => {
              if (error) {
                console.log(pc.yellow(`  Couldn't open browser automatically`));
                console.log(pc.cyan(`  Open manually: ${finalUrl}`));
              }
            });
          }, tunnelUrl ? 0 : 2000);
        }
      });

      // Handle shutdown
      process.on('SIGINT', async () => {
        console.log(pc.yellow('\n\nShutting down server...'));
        stopWatchMode();
        stopCloudflaredTunnel();
        releaseLock('web');
        server.close(() => {
          console.log(pc.green('✓ Server stopped'));
          if (tunnelUrl) {
            console.log(pc.dim('✓ Cloudflared tunnel stopped'));
          }
          process.exit(0);
        });
      });
    });
}
