import pc from 'picocolors';
import { config } from '../lib/config.js';
import {
  isGitRepo,
  getRepoName,
  getCurrentBranch,
  getRemoteUrl,
  hasChanges,
  getChangeSize,
  getRepoPath,
} from '../lib/git.js';
import { remoteToHttps } from '../utils/github.js';
import { isGhInstalled, isGhAuthenticated } from '../lib/gh-checker.js';

export function statusCommand(program) {
  program
    .command('status')
    .description('Show complete GTA status and configuration')
    .option('--all', 'Show extended information')
    .action(async (options) => {
      console.log(pc.cyan(pc.bold('\n╔═══════════════════════════════════════════════════════════════════╗')));
      console.log(pc.cyan(pc.bold('║                      GTA COMPLETE STATUS                          ║')));
      console.log(pc.cyan(pc.bold('╚═══════════════════════════════════════════════════════════════════╝\n')));

      // Repository status
      console.log(pc.blue('━━━ GIT REPOSITORY ━━━'));
      const inRepo = await isGitRepo();

      if (!inRepo) {
        console.log(pc.yellow('  ⚠️  No git repository detected'));
        console.log(pc.yellow('  Run "gta init" to initialize\n'));
      } else {
        const repoName = await getRepoName();
        const repoPath = await getRepoPath();
        const branch = await getCurrentBranch();
        const remoteUrl = await getRemoteUrl();
        const hasUncommitted = await hasChanges();

        console.log(`  Repository:    ${pc.green(repoName)}`);
        console.log(`  Path:          ${pc.blue(repoPath.replace(process.env.HOME, '~'))}`);
        console.log(`  Branch:        ${pc.green(branch)}`);

        // Get latest commit
        try {
          const { execa } = await import('execa');
          const { stdout: lastCommit } = await execa('git', ['log', '-1', '--format=%h - %s']);
          console.log(`  Last commit:   ${pc.dim(lastCommit)}`);
        } catch { }

        if (remoteUrl) {
          const httpsUrl = remoteToHttps(remoteUrl);
          console.log(`  Remote:        ${pc.green(remoteUrl)}`);
          console.log(`  GitHub URL:    ${pc.blue(httpsUrl)}`);

          // Check sync status
          try {
            const { execa } = await import('execa');
            await execa('git', ['rev-parse', '@{u}']);
            const { stdout: ahead } = await execa('git', ['rev-list', '--count', '@{u}..HEAD']);
            const { stdout: behind } = await execa('git', ['rev-list', '--count', 'HEAD..@{u}']);

            if (ahead === '0' && behind === '0') {
              console.log(`  Sync:          ${pc.green('✓ up to date')}`);
            } else {
              console.log(`  Sync:          ${pc.yellow(`↑${ahead} ahead, ↓${behind} behind`)}`);
            }
          } catch { }
        } else {
          console.log(`  Remote:        ${pc.yellow('<not configured>')}`);
        }

        // Working directory status
        if (hasUncommitted) {
          const changeSize = await getChangeSize();

          try {
            const { execa } = await import('execa');
            const { stdout: modifiedFiles } = await execa('git', ['diff', '--name-only']);
            const { stdout: untrackedFiles } = await execa('git', ['ls-files', '--others', '--exclude-standard']);

            const modified = modifiedFiles ? modifiedFiles.split('\n').filter(Boolean).length : 0;
            const untracked = untrackedFiles ? untrackedFiles.split('\n').filter(Boolean).length : 0;

            console.log(`  Changes:       ${pc.yellow(`${changeSize} lines`)}`);
            console.log(`  Files:         ${pc.yellow(`${modified} modified, ${untracked} untracked`)}`);
          } catch {
            console.log(`  Changes:       ${pc.yellow(`${changeSize} lines modified`)}`);
          }
        } else {
          console.log(`  Changes:       ${pc.green('✓ working tree clean')}`);
        }

        // Branch count
        try {
          const { execa } = await import('execa');
          const { stdout: branches } = await execa('git', ['branch']);
          const branchCount = branches.split('\n').filter(Boolean).length;
          console.log(`  Branches:      ${pc.blue(`${branchCount} total`)}`);
        } catch { }
      }

      console.log();

      // Automation Configuration
      console.log(pc.blue('━━━ AUTOMATION SETTINGS ━━━'));
      const cfg = config.getAll();

      console.log(`  Mode:               ${pc.green(cfg.autoMode)}`);

      const modeDesc = {
        manual: '↳ No automatic commits',
        confirm: '↳ Prompt before commit',
        auto: '↳ Auto-commit enabled'
      };
      console.log(`                      ${pc.dim(modeDesc[cfg.autoMode])}`);

      console.log(`  Commit threshold:   ${pc.green(cfg.commitThreshold)} lines`);
      console.log(`  Push on commit:     ${pc.green(cfg.pushOnCommit)}`);
      console.log(`  Default branch:     ${pc.green(cfg.defaultBranch)}`);
      console.log();

      // AI Configuration
      console.log(pc.blue('━━━ AI PROVIDER SETTINGS ━━━'));
      console.log(`  Provider:           ${pc.green(cfg.aiProvider)}`);
      console.log(`  Model:              ${pc.green(cfg.aiModel || '<not set>')}`);
      console.log(`  AI commit messages: ${pc.green(cfg.aiCommitMessages)}`);

      if (cfg.aiCommitMessages) {
        console.log(`  Max chars:          ${pc.green(cfg.aiCommitMaxChars)}`);
        console.log(`  Style:              ${pc.green(cfg.aiCommitStyle)}`);
      }

      // Check if CLI is available
      if (cfg.aiProvider !== 'none') {
        const cliMap = {
          gemini: 'gemini',
          openai: 'openai',
          anthropic: 'anthropic',
          ollama: 'ollama'
        };

        const cliName = cliMap[cfg.aiProvider];
        if (cliName) {
          try {
            const { execa } = await import('execa');
            await execa('which', [cliName]);
            console.log(`  CLI Available:      ${pc.green(`✓ ${cliName} installed`)}`);
          } catch {
            console.log(`  CLI Available:      ${pc.yellow(`✗ ${cliName} not found`)}`);
          }
        }
      }

      console.log();

      // System Information
      console.log(pc.blue('━━━ SYSTEM INFO ━━━'));
      console.log(`  GTA Version:   ${pc.blue('2.1.0')}`);
      console.log(`  Config file:   ${pc.blue(config.getPath())}`);

      try {
        const { execa } = await import('execa');
        const { stdout: gitVersion } = await execa('git', ['--version']);
        console.log(`  Git:           ${pc.blue(gitVersion)}`);

        // Enhanced GitHub CLI check
        const ghInstalled = await isGhInstalled();
        if (ghInstalled) {
          const ghAuthenticated = await isGhAuthenticated();
          try {
            const { stdout: ghVersion } = await execa('gh', ['--version']);
            const ghLine = ghVersion.split('\n')[0];

            if (ghAuthenticated) {
              console.log(`  GitHub CLI:    ${pc.green(`✓ ${ghLine}`)}`);
              console.log(`  Auth Status:   ${pc.green('✓ Authenticated')}`);
            } else {
              console.log(`  GitHub CLI:    ${pc.yellow(`✓ ${ghLine}`)}`);
              console.log(`  Auth Status:   ${pc.yellow('✗ Not authenticated')}`);
              console.log(`                 ${pc.dim('Run: gh auth login')}`);
            }
          } catch { }
        } else {
          console.log(`  GitHub CLI:    ${pc.yellow('✗ Not installed')}`);
          console.log(`                 ${pc.dim('Install: https://cli.github.com/')}`);
        }

        try {
          const { stdout: fzfVersion } = await execa('fzf', ['--version']);
          console.log(`  fzf:           ${pc.green('✓ installed (enhanced UI)')}`);
        } catch {
          console.log(`  fzf:           ${pc.dim('○ not installed')}`);
        }
      } catch { }

      console.log();
    });
}
