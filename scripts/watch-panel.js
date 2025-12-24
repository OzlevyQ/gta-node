#!/usr/bin/env node

import pc from 'picocolors';
import { config } from '../lib/config.js';
import { hasChanges, getChangeSize } from '../lib/git.js';
import readline from 'readline';

let lastChangeDetected = null;
let lastChangeSize = 0;
let lines = [];

function drawScreen() {
  // Clear console and redraw everything
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);

  // Print all lines
  lines.forEach(line => {
    process.stdout.write(line + '\n');
  });
}

async function updateStatus() {
  try {
    // Ensure we're in a git repo, otherwise show error
    const cfg = config.getAll();

    let changes = false;
    try {
      changes = await hasChanges();
    } catch (error) {
      // Not a git repo or git error - show static panel
      changes = false;
    }

    // Build display lines array
    lines = [];

    lines.push(pc.green(pc.bold('╔══════════════════════════════╗')));
    lines.push(pc.green(pc.bold('║   GTA - WATCH STATUS PANEL   ║')));
    lines.push(pc.green(pc.bold('╚══════════════════════════════╝')));
    lines.push('');

    // Config section
    lines.push(pc.bold('CONFIG:'));
    lines.push(pc.dim('  Mode: ' + pc.cyan(cfg.autoMode)));
    lines.push(pc.dim('  Threshold: ' + pc.cyan(cfg.commitThreshold) + ' lines'));
    lines.push(pc.dim('  AI: ' + pc.cyan(cfg.aiProvider)));
    lines.push('');
    lines.push(pc.dim('─'.repeat(30)));
    lines.push('');

    // Watch status
    lines.push(pc.bold('STATUS:'));

    if (!changes) {
      lines.push(pc.green('  👁️  Watching...'));
      lines.push(pc.dim('  No changes detected'));
      lastChangeDetected = null;
      lastChangeSize = 0;
    } else {
      const size = await getChangeSize();
      const now = Date.now();

      if (!lastChangeDetected || size !== lastChangeSize) {
        lastChangeDetected = now;
        lastChangeSize = size;
        lines.push(pc.yellow('  📝 ' + size + ' lines changed'));
        lines.push(pc.dim('  Waiting for stability...'));
      } else {
        const timeSinceLastChange = now - lastChangeDetected;

        if (timeSinceLastChange < 3000) {
          const elapsed = Math.floor(timeSinceLastChange / 1000);
          lines.push(pc.blue('  ⏳ Stabilizing ' + elapsed + 's'));
          lines.push(pc.dim('  ' + size + ' lines'));
        } else if (size < cfg.commitThreshold) {
          lines.push(pc.gray('  Below threshold'));
          lines.push(pc.dim('  ' + size + '/' + cfg.commitThreshold + ' lines'));
          lastChangeDetected = null;
          lastChangeSize = 0;
        } else if (cfg.autoMode === 'auto') {
          lines.push(pc.cyan('  🚀 Processing...'));
          lines.push(pc.dim('  ' + size + ' lines'));
          lines.push(pc.magenta('  🤖 Generating message...'));
        } else {
          lines.push(pc.yellow('  ⚠️  ' + size + ' lines ready'));
          lines.push(pc.dim('  Manual commit needed'));
        }
      }
    }

    lines.push('');
    lines.push(pc.dim('─'.repeat(30)));
    lines.push('');
    lines.push(pc.dim('Last update:'));
    lines.push(pc.dim(new Date().toLocaleTimeString()));
    lines.push('');
    lines.push(pc.dim('Press Ctrl+C to exit'));

    // Redraw screen with new content
    drawScreen();
  } catch (error) {
    lines = [pc.red('Error: ' + error.message)];
    drawScreen();
  }
}

// Initial draw
console.clear();
updateStatus();

// Update every second
setInterval(updateStatus, 1000);

// Clean exit
process.on('SIGINT', () => {
  console.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.clear();
  process.exit(0);
});
