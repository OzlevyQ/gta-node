import pc from 'picocolors';
import { spinner, confirm, isCancel } from '@clack/prompts';
import { config } from '../lib/config.js';
import {
  ensureGitRepo,
  hasChanges,
  getChangeSize,
  commitChanges,
  pushChanges,
  getCurrentBranch,
  getUnpushedCommitsCount,
  getUnpushedCommits,
} from '../lib/git.js';
import { generateCommitMessage, summarizeCommits } from '../lib/ai.js';

async function watchOnce() {
  const cfg = config.getAll();

  if (!await hasChanges()) {
    return { hadChanges: false };
  }

  const size = await getChangeSize();

  if (size < cfg.commitThreshold) {
    return { hadChanges: true, belowThreshold: true, size };
  }

  // Above threshold - handle based on mode
  switch (cfg.autoMode) {
    case 'manual':
      console.log(pc.yellow(`  Changes detected (${size} lines) - manual mode, no action`));
      return { hadChanges: true, size, action: 'manual' };

    case 'confirm':
      // In watch mode, we skip interactive prompts
      console.log(pc.yellow(`  Changes detected (${size} lines) - confirm mode (skipping in watch)`));
      return { hadChanges: true, size, action: 'skipped' };

    case 'auto': {
      const s = spinner();
      s.start(`Committing ${size} lines...`);

      try {
        // Generate commit message with AI if enabled
        let message;
        if (cfg.aiCommitMessages && cfg.aiProvider !== 'none') {
          try {
            s.message('Generating commit message with AI...');
            message = await generateCommitMessage();
          } catch (error) {
            message = `chore(auto): update ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`;
          }
        } else {
          message = `chore(auto): update ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`;
        }

        const result = await commitChanges(message);

        if (!result.committed) {
          s.stop(pc.yellow('No changes to commit'));
          return { hadChanges: false };
        }

        s.stop(pc.green(`✓ Committed: ${message.slice(0, 60)}${message.length > 60 ? '...' : ''}`));

        // Check if we need to summarize and push
        const unpushedCount = await getUnpushedCommitsCount();

        if (cfg.autoSummaryAndPush && unpushedCount >= cfg.commitsBeforeSummary) {
          return { hadChanges: true, size, action: 'committed', needsSummary: true, unpushedCount };
        }

        return { hadChanges: true, size, action: 'committed', unpushedCount };
      } catch (error) {
        s.stop(pc.red('✗ Auto-commit failed'));
        console.error(pc.red(error.message));
        return { hadChanges: true, size, action: 'error', error };
      }
    }
  }
}

async function handleSummaryAndPush() {
  const cfg = config.getAll();
  const unpushedCount = await getUnpushedCommitsCount();

  if (unpushedCount === 0) {
    return;
  }

  console.log();
  console.log(pc.cyan(`━━━ ${unpushedCount} Unpushed Commits ━━━`));

  // Get unpushed commits
  const unpushedCommits = await getUnpushedCommits();
  unpushedCommits.forEach(commit => {
    console.log(pc.dim(`  ${commit}`));
  });

  // Generate summary with AI
  const s = spinner();
  s.start('Generating summary with AI...');

  let summary;
  try {
    summary = await summarizeCommits(unpushedCount);
    s.stop(pc.green('✓ Summary generated'));
  } catch (error) {
    s.stop(pc.yellow('⚠ AI summary failed, using commit list'));
    summary = `${unpushedCount} commits ready to push`;
  }

  console.log();
  console.log(pc.blue('📝 Summary:'));
  console.log(pc.white(`   ${summary}`));
  console.log();

  // Ask user if they want to push
  const shouldPush = await confirm({
    message: `Push ${unpushedCount} commits to remote?`,
    initialValue: true,
  });

  if (isCancel(shouldPush) || !shouldPush) {
    console.log(pc.yellow('  Skipping push'));
    return;
  }

  // Push commits
  const pushSpinner = spinner();
  pushSpinner.start('Pushing commits...');

  const branch = await getCurrentBranch();
  const pushResult = await pushChanges(branch);

  if (pushResult.success) {
    pushSpinner.stop(pc.green(`✓ Pushed ${unpushedCount} commits`));
  } else {
    pushSpinner.stop(pc.red('✗ Push failed'));
    console.error(pc.red(pushResult.error));
  }

  console.log();
}

export function watchCommand(program) {
  program
    .command('watch')
    .description('Watch for changes and auto-commit/push with AI summaries')
    .option('--once', 'Check once and exit')
    .option('--interval <seconds>', 'Check interval in seconds', '3')
    .action(async (options) => {
      try {
        await ensureGitRepo();
      } catch (error) {
        console.error(pc.red(error.message));
        process.exit(1);
      }

      const cfg = config.getAll();

      console.log(pc.cyan('\n━━━ GTA Watch Mode ━━━'));
      console.log(`  Mode:             ${pc.green(cfg.autoMode)}`);
      console.log(`  Threshold:        ${pc.green(cfg.commitThreshold)} lines`);
      console.log(`  AI Commits:       ${pc.green(cfg.aiCommitMessages ? 'enabled' : 'disabled')}`);
      console.log(`  AI Provider:      ${pc.green(cfg.aiProvider)}`);
      console.log(`  Commits→Summary:  ${pc.green(cfg.commitsBeforeSummary)}`);
      console.log(`  Auto Summary:     ${pc.green(cfg.autoSummaryAndPush ? 'enabled' : 'disabled')}`);
      console.log();

      if (options.once) {
        console.log(pc.dim('Running single check...\n'));
        const result = await watchOnce();

        if (result.needsSummary) {
          await handleSummaryAndPush();
        }

        return;
      }

      const interval = parseInt(options.interval) * 1000;
      console.log(pc.yellow(`Watching for changes (checking every ${options.interval}s, Ctrl-C to stop)...\n`));

      // Run first check immediately
      const firstResult = await watchOnce();
      if (firstResult.needsSummary) {
        await handleSummaryAndPush();
      }

      // Then set interval
      const timer = setInterval(async () => {
        const result = await watchOnce();

        if (result.needsSummary) {
          clearInterval(timer);
          await handleSummaryAndPush();

          // Restart timer after summary
          setInterval(async () => {
            const r = await watchOnce();
            if (r.needsSummary) {
              clearInterval(timer);
              await handleSummaryAndPush();
            }
          }, interval);
        }
      }, interval);

      // Handle Ctrl-C
      process.on('SIGINT', () => {
        clearInterval(timer);
        console.log(pc.yellow('\n\nWatch mode stopped'));
        process.exit(0);
      });
    });
}
