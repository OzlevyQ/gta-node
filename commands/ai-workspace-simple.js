/**
 * AI Workspace - Simple approach with bottom status bar
 * No tmux, just AI CLI with compact status line at bottom
 */

import { spawn } from 'child_process';
import pc from 'picocolors';
import { config } from '../lib/config.js';
import { hasChanges, getChangeSize } from '../lib/git.js';

let watchInterval = null;
let lastChangeDetected = null;
let lastChangeSize = 0;

// Update status bar at bottom of screen
async function updateStatusBar() {
  try {
    const cfg = config.getAll();
    let changes = false;

    try {
      changes = await hasChanges();
    } catch (e) {
      // Ignore git errors
    }

    let statusText = '';

    if (!changes) {
      statusText = pc.green('👁️  Watching...');
      lastChangeDetected = null;
      lastChangeSize = 0;
    } else {
      const size = await getChangeSize();
      const now = Date.now();

      if (!lastChangeDetected || size !== lastChangeSize) {
        lastChangeDetected = now;
        lastChangeSize = size;
        statusText = pc.yellow(`📝 ${size} lines - stabilizing...`);
      } else {
        const timeSinceLastChange = now - lastChangeDetected;

        if (timeSinceLastChange < 3000) {
          const elapsed = Math.floor(timeSinceLastChange / 1000);
          statusText = pc.blue(`⏳ Stabilizing ${elapsed}s (${size} lines)`);
        } else if (size < cfg.commitThreshold) {
          statusText = pc.gray(`Below threshold: ${size}/${cfg.commitThreshold}`);
          lastChangeDetected = null;
          lastChangeSize = 0;
        } else if (cfg.autoMode === 'auto') {
          statusText = pc.cyan(`🚀 Processing ${size} lines...`);
        } else {
          statusText = pc.yellow(`⚠️  ${size} lines ready`);
        }
      }
    }

    // Write status to last line
    const configText = pc.dim(`Mode: ${cfg.autoMode} | Threshold: ${cfg.commitThreshold} | AI: ${cfg.aiProvider}`);

    // Save cursor, move to bottom, write status, restore cursor
    process.stdout.write('\x1b[s'); // Save cursor
    process.stdout.write(`\x1b[${process.stdout.rows || 24};1H`); // Move to last row
    process.stdout.write('\x1b[K'); // Clear line
    process.stdout.write(pc.bgGreen(pc.black(' GTA ')) + ' ' + statusText + '  ' + configText);
    process.stdout.write('\x1b[u'); // Restore cursor
  } catch (error) {
    // Silent
  }
}

// Get AI CLI command
function getAICommand(aiType) {
  const commands = {
    'claude': 'claude',
    'codex': 'codex',
    'copilot': 'github-copilot-cli',
    'gemini': 'gemini'
  };

  return commands[aiType] || commands['gemini'];
}

// Launch AI workspace
export async function launchAIWorkspace(aiType) {
  const cliCommand = getAICommand(aiType);

  console.clear();
  console.log(pc.cyan('╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(pc.cyan('║') + pc.green(` AI WORKSPACE - ${aiType.toUpperCase()}`) + ' '.repeat(Math.max(0, 63 - aiType.length - 16)) + pc.cyan('║'));
  console.log(pc.cyan('╚═══════════════════════════════════════════════════════════════════╝'));
  console.log();
  console.log(pc.dim('  Status bar will appear at the bottom of your screen.'));
  console.log(pc.dim('  Press Ctrl+D or type "exit" to return to menu.'));
  console.log();

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.clear();

  // Start status bar updates
  updateStatusBar();
  watchInterval = setInterval(updateStatusBar, 1000);

  return new Promise((resolve) => {
    const cliProcess = spawn(cliCommand, [], {
      stdio: 'inherit',
      shell: true
    });

    const cleanup = () => {
      if (watchInterval) {
        clearInterval(watchInterval);
        watchInterval = null;
      }
    };

    cliProcess.on('exit', (code) => {
      cleanup();
      console.log();
      console.log(pc.green('✓ Returned from AI workspace'));
      console.log();
      resolve(code || 0);
    });

    cliProcess.on('error', (error) => {
      cleanup();
      console.log();
      console.log(pc.red(`❌ Failed to launch ${aiType.toUpperCase()}`));
      console.log(pc.yellow(`   Error: ${error.message}`));
      console.log();
      resolve(1);
    });

    // Cleanup on interrupt
    process.on('SIGINT', () => {
      cleanup();
      if (cliProcess) {
        cliProcess.kill();
      }
    });
  });
}
