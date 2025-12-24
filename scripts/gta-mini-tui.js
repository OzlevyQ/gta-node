#!/usr/bin/env node

/**
 * GTA Mini TUI - For right pane in AI workspace
 * Full interactive menu with watch status
 */

import pc from 'picocolors';
import { select, text, confirm, spinner, isCancel } from '@clack/prompts';
import { config } from '../lib/config.js';
import {
  hasChanges,
  getChangeSize,
  commitChanges,
  getCurrentBranch,
  pushChanges,
  getRepoName,
  getRemoteUrl
} from '../lib/git.js';
import { generateCommitMessage } from '../lib/ai.js';
import { remoteToHttps } from '../utils/github.js';

let watchInterval = null;
let lastChangeDetected = null;
let lastChangeSize = 0;
let currentWatchStatus = '';

// Update watch status (background)
async function updateWatchStatus() {
  try {
    const cfg = config.getAll();
    let changes = false;

    try {
      changes = await hasChanges();
    } catch (e) {
      return;
    }

    if (!changes) {
      currentWatchStatus = pc.green('👁️  Watching... (no changes)');
      lastChangeDetected = null;
      lastChangeSize = 0;
    } else {
      const size = await getChangeSize();
      const now = Date.now();

      if (!lastChangeDetected || size !== lastChangeSize) {
        lastChangeDetected = now;
        lastChangeSize = size;
        currentWatchStatus = pc.yellow(`📝 ${size} lines - stabilizing...`);
      } else {
        const timeSinceLastChange = now - lastChangeDetected;

        if (timeSinceLastChange < 3000) {
          const elapsed = Math.floor(timeSinceLastChange / 1000);
          currentWatchStatus = pc.blue(`⏳ Stabilizing ${elapsed}s (${size} lines)`);
        } else if (size < cfg.commitThreshold) {
          currentWatchStatus = pc.gray(`Below threshold: ${size}/${cfg.commitThreshold}`);
          lastChangeDetected = null;
          lastChangeSize = 0;
        } else if (cfg.autoMode === 'auto') {
          currentWatchStatus = pc.cyan(`🚀 Processing ${size} lines...`);
        } else {
          currentWatchStatus = pc.yellow(`⚠️  ${size} lines ready`);
        }
      }
    }
  } catch (error) {
    // Silent
  }
}

// Show header
async function showHeader() {
  console.clear();

  console.log(pc.cyan(pc.bold('╔═════════════════════════════╗')));
  console.log(pc.cyan(pc.bold('║')) + pc.green(' GTA — Control Panel') + ' '.repeat(8) + pc.cyan('║'));
  console.log(pc.cyan(pc.bold('╚═════════════════════════════╝')));

  try {
    const repoName = await getRepoName();
    const branch = await getCurrentBranch();
    const remoteUrl = await getRemoteUrl();
    const hasUncommitted = await hasChanges();

    console.log(`📁 ${pc.green(repoName)}`);
    console.log(`🌿 ${pc.green(branch)} ${hasUncommitted ? pc.yellow('●') : pc.green('✓')}`);

    if (remoteUrl) {
      const httpsUrl = remoteToHttps(remoteUrl);
      console.log(`🌐 ${pc.blue(httpsUrl.substring(0, 35))}...`);
    }
  } catch (e) {
    console.log(pc.yellow('⚠️  No repository'));
  }

  const cfg = config.getAll();
  console.log(pc.dim(`⚙️  ${cfg.autoMode} | ${cfg.commitThreshold} | ${cfg.aiProvider}`));
  console.log(currentWatchStatus || pc.dim('Watch: inactive'));
  console.log();
}

// Main menu
async function mainMenu() {
  while (true) {
    await showHeader();

    const choice = await select({
      message: pc.cyan(pc.bold('QUICK ACTIONS')),
      options: [
        { value: 'commit', label: '💾 Commit Now' },
        { value: 'mode', label: '🎚️  Toggle Mode' },
        { value: 'threshold', label: '📏 Set Threshold' },
        { value: 'ai', label: '🤖 Toggle AI' },
        { value: 'config', label: '⚙️  View Config' },
        { value: 'exit', label: '❌ Close Panel' },
      ],
    });

    if (isCancel(choice) || choice === 'exit') {
      console.clear();
      console.log(pc.yellow('\n👋 Panel closed\n'));
      process.exit(0);
    }

    await handleAction(choice);
  }
}

// Handle actions
async function handleAction(action) {
  switch (action) {
    case 'commit': {
      await showHeader();

      const s = spinner();
      s.start('Creating commit...');

      try {
        const cfg = config.getAll();
        let message;

        if (cfg.aiCommitMessages && cfg.aiProvider !== 'none') {
          s.message('Generating AI message...');
          try {
            message = await generateCommitMessage();
          } catch (error) {
            message = `chore: update ${new Date().toLocaleTimeString()}`;
          }
        } else {
          message = `chore: update ${new Date().toLocaleTimeString()}`;
        }

        const result = await commitChanges(message);

        if (result.committed) {
          s.stop(pc.green('✓ Committed!'));
          console.log(pc.dim(`  ${message.substring(0, 40)}...`));

          if (cfg.pushOnCommit) {
            s.start('Pushing...');
            const pushResult = await pushChanges(await getCurrentBranch());
            if (pushResult.success) {
              s.stop(pc.green('✓ Pushed!'));
            } else {
              s.stop(pc.yellow('⚠ Push failed'));
            }
          }
        } else {
          s.stop(pc.yellow(result.message));
        }
      } catch (error) {
        s.stop(pc.red('✗ Failed'));
      }

      await text({ message: 'Press Enter...' });
      break;
    }

    case 'mode': {
      const modes = ['manual', 'confirm', 'auto'];
      const currentMode = config.get('autoMode');
      const currentIndex = modes.indexOf(currentMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];

      config.set('autoMode', nextMode);

      await showHeader();
      console.log(pc.green(`✓ Mode changed to: ${nextMode}`));
      await text({ message: 'Press Enter...' });
      break;
    }

    case 'threshold': {
      await showHeader();

      const threshold = await text({
        message: 'Minimum changed lines:',
        placeholder: '20',
        validate: (value) => {
          const num = parseInt(value);
          if (isNaN(num) || num < 1) return 'Must be positive number';
        },
      });

      if (!isCancel(threshold)) {
        config.set('commitThreshold', parseInt(threshold));
        console.log(pc.green(`✓ Threshold set to: ${threshold}`));
        await text({ message: 'Press Enter...' });
      }
      break;
    }

    case 'ai': {
      const current = config.get('aiCommitMessages');
      config.set('aiCommitMessages', !current);

      await showHeader();
      console.log(pc.green(`✓ AI commits: ${!current ? 'enabled' : 'disabled'}`));
      await text({ message: 'Press Enter...' });
      break;
    }

    case 'config': {
      await showHeader();
      const cfg = config.getAll();

      console.log(pc.cyan('\n══ Configuration ══\n'));
      console.log(`  ${pc.bold('autoMode:')} ${cfg.autoMode}`);
      console.log(`  ${pc.bold('commitThreshold:')} ${cfg.commitThreshold}`);
      console.log(`  ${pc.bold('aiProvider:')} ${cfg.aiProvider}`);
      console.log(`  ${pc.bold('aiCommitMessages:')} ${cfg.aiCommitMessages}`);
      console.log(`  ${pc.bold('pushOnCommit:')} ${cfg.pushOnCommit}`);
      console.log();

      await text({ message: 'Press Enter...' });
      break;
    }
  }
}

// Start watch status updates
watchInterval = setInterval(updateWatchStatus, 1000);

// Cleanup
process.on('SIGINT', () => {
  if (watchInterval) clearInterval(watchInterval);
  console.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (watchInterval) clearInterval(watchInterval);
  console.clear();
  process.exit(0);
});

// Run
mainMenu();
