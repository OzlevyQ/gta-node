import pc from 'picocolors';
import { intro, outro, select, text, confirm, spinner, note, isCancel } from '@clack/prompts';
import { config } from '../lib/config.js';
import {
  isGitRepo,
  getRepoName,
  getCurrentBranch,
  getRemoteUrl,
  hasChanges,
  getChangeSize,
  getRepoPath,
  commitChanges,
  pushChanges,
  listBranches,
  createBranch,
  switchBranch,
  getLog,
  getUnpushedCommitsCount,
} from '../lib/git.js';
import { remoteToHttps } from '../utils/github.js';
import { generateCommitMessage, summarizeCommits } from '../lib/ai.js';
import { launchAIWorkspace } from './ai-workspace.js';

// Watch mode state
let watchInterval = null;
let watchStartTime = null;
let lastChangeDetected = null;
let lastChangeSize = 0;
let isProcessing = false;
let currentWatchStatus = '';

// Update just the watch status line without clearing screen
function updateWatchStatusLine(message) {
  currentWatchStatus = message;
  // Save cursor position, move to status line, update, restore cursor
  process.stdout.write('\x1b7'); // Save cursor
  process.stdout.write('\x1b[7;1H'); // Move to line 7
  process.stdout.write('\x1b[K'); // Clear line
  process.stdout.write(message);
  process.stdout.write('\x1b8'); // Restore cursor
}

// Background watch loop
async function backgroundWatch() {
  if (isProcessing || !await isGitRepo()) return;

  try {
    const cfg = config.getAll();
    const changes = await hasChanges();

    // No changes - show timer
    if (!changes) {
      if (watchStartTime) {
        const elapsed = Math.floor((Date.now() - watchStartTime) / 1000);
        updateWatchStatusLine(pc.green(`👁️  Watching... ${elapsed}s`));
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
      updateWatchStatusLine(pc.yellow(`📝 Change detected: ${size} lines - waiting for stability...`));
      return;
    }

    const timeSinceLastChange = now - lastChangeDetected;

    // Still within stability period
    if (timeSinceLastChange < 3000) {
      updateWatchStatusLine(pc.blue(`📝 Stabilizing... ${Math.floor(timeSinceLastChange / 1000)}s (${size} lines)`));
      return;
    }

    // Stable! Check threshold
    if (size < cfg.commitThreshold) {
      updateWatchStatusLine(pc.gray(`Below threshold: ${size}/${cfg.commitThreshold} lines`));
      lastChangeDetected = null;
      lastChangeSize = 0;
      return;
    }

    // Process based on mode
    isProcessing = true;

    if (cfg.autoMode === 'confirm') {
      // CONFIRM MODE - Ask user for approval
      stopBackgroundWatch(); // Temporarily stop watch

      await showHeader();
      console.log(pc.cyan(pc.bold('\n━━━ Commit Ready ━━━\n')));
      console.log(pc.white(`  Changes detected: ${pc.yellow(size + ' lines')}`));
      console.log(pc.dim(`  Mode: ${cfg.autoMode}\n`));

      const { execa } = await import('execa');

      const viewDiff = await confirm({
        message: 'View diff before committing?',
        initialValue: false,
      });

      if (viewDiff && !isCancel(viewDiff)) {
        const { stdout } = await execa('git', ['diff', '--color=always']);
        console.log('\n' + stdout + '\n');
      }

      const shouldCommit = await confirm({
        message: 'Commit these changes?',
        initialValue: true,
      });

      if (isCancel(shouldCommit) || !shouldCommit) {
        console.log(pc.yellow('\n✗ Commit cancelled\n'));
        console.log(pc.dim('Press Enter to return to menu...'));
        await text({ message: '' });

        // Reset state and resume watch
        lastChangeDetected = null;
        lastChangeSize = 0;
        isProcessing = false;
        startBackgroundWatch();
        return;
      }

      // User approved - proceed with commit
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      let message;

      if (cfg.aiCommitMessages && cfg.aiProvider !== 'none') {
        const useAI = await confirm({
          message: 'Generate commit message with AI?',
          initialValue: true,
        });

        if (useAI && !isCancel(useAI)) {
          const s = spinner();
          s.start('Generating AI commit message...');
          try {
            message = await generateCommitMessage();
            message = `${timestamp} ${message}`;
            s.stop(pc.green(`✓ Generated: "${message}"`));
          } catch (error) {
            s.stop(pc.yellow('⚠ AI failed, using default'));
            message = `${timestamp} chore: update`;
          }
        } else {
          const customMessage = await text({
            message: 'Commit message:',
            placeholder: 'chore: update',
          });
          message = isCancel(customMessage) ? `${timestamp} chore: update` : customMessage;
        }
      } else {
        const customMessage = await text({
          message: 'Commit message:',
          placeholder: 'chore: update',
        });
        message = isCancel(customMessage) ? `${timestamp} chore: update` : customMessage;
      }

      const result = await commitChanges(message);
      if (result.committed) {
        console.log(pc.green(`\n✓ Committed: ${message}\n`));
      } else {
        console.log(pc.yellow(`\n⚠ ${result.message}\n`));
      }

      console.log(pc.dim('Press Enter to return to menu...'));
      await text({ message: '' });

      // Reset and resume
      watchStartTime = Date.now();
      lastChangeDetected = null;
      lastChangeSize = 0;
      isProcessing = false;
      startBackgroundWatch();

    } else if (cfg.autoMode === 'auto') {
      // AUTO MODE - Commit automatically
      updateWatchStatusLine(pc.cyan(`🚀 Processing ${size} lines...`));

      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      let message;

      if (cfg.aiCommitMessages && cfg.aiProvider !== 'none') {
        try {
          updateWatchStatusLine(pc.magenta(`🤖 Generating AI commit...`));
          message = await generateCommitMessage();
          message = `${timestamp} ${message}`;
        } catch (error) {
          message = `${timestamp} chore(auto): update`;
        }
      } else {
        message = `${timestamp} chore(auto): update`;
      }

      const result = await commitChanges(message);
      if (result.committed) {
        updateWatchStatusLine(pc.green(`✅ Committed: ${message.substring(0, 50)}...`));
        setTimeout(() => {
          watchStartTime = Date.now();
          lastChangeDetected = null;
          lastChangeSize = 0;
        }, 2000);
      }

      isProcessing = false;
    } else {
      // MANUAL MODE - Just notify
      updateWatchStatusLine(pc.yellow(`⚠️ ${size} lines ready (mode: ${cfg.autoMode})`));
      lastChangeDetected = null;
      lastChangeSize = 0;
      isProcessing = false;
    }
  } catch (error) {
    // Silently handle errors in background
    isProcessing = false;
  }
}

// Start background watch
function startBackgroundWatch() {
  if (watchInterval) return;
  watchStartTime = Date.now();
  watchInterval = setInterval(backgroundWatch, 1000);
}

// Stop background watch
function stopBackgroundWatch() {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
}

async function showHeader() {
  console.clear();

  console.log(pc.cyan(pc.bold('╔═══════════════════════════════════════════════════════════════════╗')));
  console.log(pc.cyan(pc.bold('║')) + pc.green(' GTA — Git & Task Automation') + ' '.repeat(36) + pc.cyan('║'));
  console.log(pc.cyan(pc.bold('╚═══════════════════════════════════════════════════════════════════╝')));

  const inRepo = await isGitRepo();
  const cfg = config.getAll();

  if (inRepo) {
    const repoName = await getRepoName();
    const branch = await getCurrentBranch();
    const remoteUrl = await getRemoteUrl();
    const hasUncommitted = await hasChanges();

    console.log(`📁 ${pc.green(repoName)}  🌿 ${pc.green(branch)}  ${hasUncommitted ? pc.yellow('●') : pc.green('✓')}`);
    if (remoteUrl) {
      const httpsUrl = remoteToHttps(remoteUrl);
      console.log(`🌐 ${pc.blue(httpsUrl)}`);
    }
  } else {
    console.log(pc.yellow('⚠️  No repository (use "Init repo" to start)'));
  }

  console.log(pc.dim(`⚙️  ${cfg.autoMode} | ${cfg.commitThreshold} lines | AI: ${cfg.aiProvider}`));
  console.log(currentWatchStatus || pc.dim('Watch: inactive'));
  console.log();
}

async function mainMenu() {
  while (true) {
    await showHeader();

    const choice = await select({
      message: pc.cyan(pc.bold('MAIN MENU')),
      options: [
        { value: 'git', label: '🔀 Git — commit, branches, switch, log' },
        { value: 'project', label: '📦 Project — create new project' },
        { value: 'github', label: '🌐 GitHub — connect/create remote' },
        { value: 'automation', label: '⚙️  Automation — mode, threshold, watch' },
        { value: 'ai', label: '🤖 AI — provider, model configuration' },
        { value: 'ai-workspace', label: '✨ USE AI — claude, codex, copilot, gemini' },
        { value: 'config', label: '⚙️  Config — view and edit settings' },
        { value: 'status', label: '📊 Status — detailed status view' },
        { value: 'web', label: '🌐 Web — open web interface' },
        { value: 'exit', label: '❌ Exit GTA' },
      ],
    });

    if (choice === 'exit') {
      outro(pc.green('Goodbye! 👋'));
      break;
    }

    switch (choice) {
      case 'git':
        await gitMenu();
        break;
      case 'project':
        await projectMenu();
        break;
      case 'github':
        await githubMenu();
        break;
      case 'automation':
        await automationMenu();
        break;
      case 'ai':
        await aiMenu();
        break;
      case 'ai-workspace':
        await aiWorkspaceMenu();
        break;
      case 'config':
        await configMenu();
        break;
      case 'status':
        await statusMenu();
        break;
      case 'web':
        await webMenu();
        break;
    }
  }
}


async function gitMenu() {
  while (true) {
    await showHeader();

    const choice = await select({
      message: pc.cyan(pc.bold('🔀 GIT OPERATIONS')),
      options: [
        { value: 'commit', label: '💾 Commit now' },
        { value: 'branches', label: '📋 Branch list' },
        { value: 'create-branch', label: '🌿 Create branch' },
        { value: 'switch', label: '🔀 Switch branch/ref' },
        { value: 'log', label: '📜 Show log' },
        { value: 'back', label: '⬅️  Back to main menu' },
      ],
    });

    if (choice === 'back') break;

    switch (choice) {
      case 'commit': {
        const message = await text({
          message: 'Commit message (optional):',
          placeholder: 'Leave empty for auto-generated message',
        });

        const s = spinner();
        s.start('Creating commit...');

        try {
          const finalMessage = message || `chore(auto): update ${new Date().toISOString()}`;
          const result = await commitChanges(finalMessage);

          if (result.committed) {
            s.stop(pc.green(`✓ Committed: ${finalMessage}`));

            if (config.get('pushOnCommit')) {
              s.start('Pushing to remote...');
              const pushResult = await pushChanges(await getCurrentBranch());

              if (pushResult.success) {
                s.stop(pc.green('✓ Pushed successfully'));
              } else {
                s.stop(pc.yellow('⚠ Push failed'));
              }
            }
          } else {
            s.stop(pc.yellow(result.message));
          }
        } catch (error) {
          s.stop(pc.red('✗ Commit failed'));
          console.error(pc.red(error.message));
        }

        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'branches': {
        const branches = await listBranches();
        console.log('\n' + branches + '\n');
        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'create-branch': {
        const name = await text({
          message: 'Branch name:',
          validate: (value) => {
            if (!value) return 'Branch name cannot be empty';
          },
        });

        const s = spinner();
        s.start('Creating branch...');

        try {
          await createBranch(name);
          s.stop(pc.green(`✓ Created and switched to branch: ${name}`));
        } catch (error) {
          s.stop(pc.red('✗ Failed to create branch'));
          console.error(pc.red(error.message));
        }

        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'switch': {
        const ref = await text({
          message: 'Branch/ref (or "prev"/"next"):',
          validate: (value) => {
            if (!value) return 'Reference cannot be empty';
          },
        });

        const s = spinner();
        s.start('Switching...');

        try {
          await switchBranch(ref);
          s.stop(pc.green(`✓ Switched to ${ref}`));
        } catch (error) {
          s.stop(pc.red('✗ Failed to switch'));
          console.error(pc.red(error.message));
        }

        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'log': {
        const log = await getLog(10);
        console.log('\n' + log + '\n');
        await text({ message: 'Press Enter to continue...' });
        break;
      }
    }
  }
}

async function githubMenu() {
  while (true) {
    await showHeader();

    const choice = await select({
      message: pc.cyan(pc.bold('🌐 GITHUB')),
      options: [
        { value: 'connect', label: '🔗 Connect/Create remote' },
        { value: 'set-url', label: '🌐 Set remote URL' },
        { value: 'back', label: '⬅️  Back' },
      ],
    });

    if (choice === 'back') break;

    switch (choice) {
      case 'set-url': {
        const url = await text({
          message: 'Remote URL:',
          placeholder: 'https://github.com/user/repo.git',
          validate: (value) => {
            if (!value) return 'URL cannot be empty';
            if (!value.includes('github.com')) return 'Must be a GitHub URL';
          },
        });

        const s = spinner();
        s.start('Setting remote URL...');

        try {
          const { setRemoteUrl } = await import('../lib/git.js');
          await setRemoteUrl(url);
          s.stop(pc.green('✓ Remote URL set successfully'));
        } catch (error) {
          s.stop(pc.red('✗ Failed to set remote'));
          console.error(pc.red(error.message));
        }

        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'connect': {
        console.log(pc.yellow('\n💡 Use "gh" CLI or set URL manually\n'));
        await text({ message: 'Press Enter to continue...' });
        break;
      }
    }
  }
}

async function automationMenu() {
  while (true) {
    await showHeader();

    const cfg = config.getAll();

    const choice = await select({
      message: pc.cyan(pc.bold('⚙️  AUTOMATION')),
      options: [
        { value: 'mode', label: `🎚️  Mode (current: ${cfg.autoMode})` },
        { value: 'threshold', label: `📏 Threshold (current: ${cfg.commitThreshold})` },
        { value: 'push', label: `⬆️  Push on commit (current: ${cfg.pushOnCommit})` },
        { value: 'ai-commits', label: `🤖 AI commits (current: ${cfg.aiCommitMessages})` },
        { value: 'back', label: '⬅️  Back' },
      ],
    });

    if (choice === 'back') break;

    switch (choice) {
      case 'mode': {
        const mode = await select({
          message: 'Select automation mode:',
          options: [
            { value: 'manual', label: 'Manual - no auto-commits' },
            { value: 'confirm', label: 'Confirm - prompt before commit' },
            { value: 'auto', label: 'Auto - auto-commit when threshold reached' },
          ],
        });

        config.set('autoMode', mode);
        console.log(pc.green(`✓ Mode set to: ${mode}`));
        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'threshold': {
        const threshold = await text({
          message: 'Minimum changed lines:',
          placeholder: '20',
          validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1) return 'Must be a positive number';
          },
        });

        config.set('commitThreshold', parseInt(threshold));
        console.log(pc.green(`✓ Threshold set to: ${threshold}`));
        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'push': {
        const current = config.get('pushOnCommit');
        config.set('pushOnCommit', !current);
        console.log(pc.green(`✓ Push on commit: ${!current}`));
        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'ai-commits': {
        const current = config.get('aiCommitMessages');
        config.set('aiCommitMessages', !current);
        console.log(pc.green(`✓ AI commit messages: ${!current}`));
        await text({ message: 'Press Enter to continue...' });
        break;
      }
    }
  }
}

async function aiMenu() {
  while (true) {
    await showHeader();

    const cfg = config.getAll();

    const choice = await select({
      message: pc.cyan(pc.bold('🤖 AI PROVIDER')),
      options: [
        { value: 'provider', label: `🔧 Provider (current: ${cfg.aiProvider})` },
        { value: 'model', label: `🎯 Model (current: ${cfg.aiModel || 'not set'})` },
        { value: 'back', label: '⬅️  Back' },
      ],
    });

    if (choice === 'back') break;

    switch (choice) {
      case 'provider': {
        const provider = await select({
          message: 'Select AI provider:',
          options: [
            { value: 'gemini', label: 'Google Gemini' },
            { value: 'openai', label: 'OpenAI (ChatGPT)' },
            { value: 'anthropic', label: 'Anthropic (Claude)' },
            { value: 'ollama', label: 'Ollama (local)' },
            { value: 'none', label: 'None (disable AI)' },
          ],
        });

        config.set('aiProvider', provider);
        console.log(pc.green(`✓ AI provider set to: ${provider}`));
        await text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'model': {
        const model = await text({
          message: 'Model name:',
          placeholder: 'gemini-pro, gpt-4, claude-3-opus, etc.',
        });

        if (model) {
          config.set('aiModel', model);
          console.log(pc.green(`✓ Model set to: ${model}`));
        }
        await text({ message: 'Press Enter to continue...' });
        break;
      }
    }
  }
}

async function configMenu() {
  await showHeader();
  const cfg = config.getAll();

  console.log(pc.cyan('\n━━━ Current Configuration ━━━\n'));
  for (const [key, value] of Object.entries(cfg)) {
    console.log(`  ${pc.blue(key.padEnd(20))} ${pc.green(String(value))}`);
  }
  console.log();

  await text({ message: 'Press Enter to continue...' });
}

async function statusMenu() {
  await showHeader();
  await text({ message: 'Press Enter to continue...' });
}

async function projectMenu() {
  await showHeader();

  const projectName = await text({
    message: 'Project name:',
    placeholder: 'my-awesome-project',
    validate: (value) => {
      if (!value) return 'Project name is required';
      if (!/^[a-z0-9-_]+$/i.test(value)) return 'Use only letters, numbers, hyphens, and underscores';
    },
  });

  const createInNewDir = await confirm({
    message: 'Create in new directory?',
    initialValue: true,
  });

  const description = await text({
    message: 'Project description (optional):',
    placeholder: 'A brief description of your project',
  });

  const createPackageJson = await confirm({
    message: 'Create package.json?',
    initialValue: true,
  });

  const initGit = await confirm({
    message: 'Initialize git repository?',
    initialValue: true,
  });

  let createGithub = false;
  let isPrivate = false;

  if (initGit) {
    createGithub = await confirm({
      message: 'Create GitHub repository?',
      initialValue: false,
    });

    if (createGithub) {
      isPrivate = await confirm({
        message: 'Make repository private?',
        initialValue: false,
      });
    }
  }

  console.log();

  // Import project creation functions
  const { mkdir, writeFile } = await import('fs/promises');
  const { join } = await import('path');
  const { execa } = await import('execa');

  let projectPath = createInNewDir ? join(process.cwd(), projectName) : process.cwd();

  // Create project directory if needed
  if (createInNewDir) {
    const s = spinner();
    s.start(`Creating directory: ${projectName}`);
    try {
      await mkdir(projectPath, { recursive: true });
      s.stop(pc.green(`✓ Created ${projectPath}`));
    } catch (error) {
      s.stop(pc.red('✗ Failed to create directory'));
      console.error(pc.red(error.message));
      await text({ message: 'Press Enter to continue...' });
      return;
    }
  }

  // Create README.md
  const s1 = spinner();
  s1.start('Creating project files...');

  const readme = `# ${projectName}

${description || 'A new project'}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run the project
npm start
\`\`\`

## License

MIT
`;

  await writeFile(join(projectPath, 'README.md'), readme);

  // Create .gitignore
  const gitignore = `node_modules/
*.log
.DS_Store
.env
.env.local
dist/
build/
coverage/
.vscode/
.idea/
`;

  await writeFile(join(projectPath, '.gitignore'), gitignore);

  // Create package.json if requested
  if (createPackageJson) {
    const packageJson = {
      name: projectName,
      version: '1.0.0',
      description: description || '',
      main: 'index.js',
      type: 'module',
      scripts: {
        start: 'node index.js',
        dev: 'node --watch index.js',
        test: 'echo "Error: no test specified" && exit 1'
      },
      keywords: [],
      author: '',
      license: 'MIT'
    };

    await writeFile(
      join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  s1.stop(pc.green('✓ Project files created'));

  // Initialize git
  if (initGit) {
    const s2 = spinner();
    s2.start('Initializing git repository...');

    try {
      await execa('git', ['init'], { cwd: projectPath });
      await execa('git', ['add', '.'], { cwd: projectPath });
      await execa('git', ['commit', '-m', 'Initial commit'], { cwd: projectPath });
      s2.stop(pc.green('✓ Git repository initialized'));
    } catch (error) {
      s2.stop(pc.red('✗ Failed to initialize git'));
      console.error(pc.red(error.message));
    }
  }

  // Create GitHub repository
  if (createGithub) {
    const s3 = spinner();
    s3.start('Creating GitHub repository...');

    try {
      await execa('which', ['gh']);

      const visibility = isPrivate ? '--private' : '--public';

      await execa('gh', [
        'repo',
        'create',
        projectName,
        visibility,
        '--source',
        projectPath,
        '--remote',
        'origin',
        ...(description ? ['--description', description] : []),
        '--push'
      ], { cwd: projectPath, shell: true });

      s3.stop(pc.green('✓ GitHub repository created and pushed'));

      const { stdout: remoteUrl } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd: projectPath });
      const httpsUrl = remoteUrl.replace('git@github.com:', 'https://github.com/').replace('.git', '');
      console.log(pc.blue(`   ${httpsUrl}`));
    } catch (error) {
      if (error.message.includes('which')) {
        s3.stop(pc.yellow('⚠ GitHub CLI (gh) not installed'));
        console.log(pc.yellow('   Install with: brew install gh'));
      } else {
        s3.stop(pc.red('✗ Failed to create GitHub repository'));
        console.error(pc.red(error.message));
      }
    }
  }

  console.log();
  console.log(pc.green(`✓ Project "${projectName}" created successfully!`));

  if (createInNewDir) {
    console.log();
    console.log(pc.cyan('Next steps:'));
    console.log(`  ${pc.dim('cd')} ${projectName}`);
    if (createPackageJson) {
      console.log(`  ${pc.dim('npm install')}`);
    }
    console.log(`  ${pc.dim('gta status')}`);
  }

  console.log();
  await text({ message: 'Press Enter to continue...' });
}

async function webMenu() {
  await showHeader();

  console.log(pc.cyan(pc.bold('\n🌐 Web Interface\n')));
  console.log(pc.white('Launch a web interface to manage GTA from your browser.'));
  console.log(pc.dim('The interface provides a visual dashboard with real-time updates.\n'));

  const port = await text({
    message: 'Port to run on:',
    placeholder: '3000',
    initialValue: '3000',
    validate: (value) => {
      const num = parseInt(value);
      if (isNaN(num) || num < 1024 || num > 65535) {
        return 'Port must be between 1024 and 65535';
      }
    },
  });

  if (isCancel(port)) {
    return;
  }

  console.log();
  console.log(pc.green(`✓ Starting web server on port ${port}...`));
  console.log(pc.cyan(`  Opening http://localhost:${port} in your browser...`));
  console.log(pc.yellow('\n  Press Ctrl-C to stop the server and return to menu\n'));

  // Import and start web server
  const { exec } = await import('child_process');
  const { execa } = await import('execa');

  // Open browser
  const url = `http://localhost:${port}`;
  const command = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';

  setTimeout(() => {
    exec(`${command} ${url}`, (error) => {
      if (error) {
        console.log(pc.yellow(`  Couldn't open browser automatically`));
        console.log(pc.cyan(`  Open manually: ${url}`));
      }
    });
  }, 1000);

  // Start server using gta web command in background
  try {
    const webProcess = execa('gta', ['web', '-p', port, '--no-open'], {
      stdio: 'inherit',
    });

    // Wait for Ctrl-C
    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        webProcess.kill();
        resolve();
      });
    });
  } catch (error) {
    console.log(pc.red('\n✗ Failed to start web server'));
    console.log(pc.dim(`  ${error.message}`));
  }

  console.log();
  await text({ message: 'Press Enter to continue...' });
}

async function aiWorkspaceMenu() {
  // Stop background watch while in AI workspace
  const wasWatching = !!watchInterval;
  if (wasWatching) {
    stopBackgroundWatch();
  }

  await showHeader();

  const choice = await select({
    message: pc.cyan(pc.bold('✨ USE AI — Select AI CLI')),
    options: [
      { value: 'claude', label: '🤖 Claude Code — Anthropic Claude CLI' },
      { value: 'codex', label: '💻 Codex — OpenAI Codex CLI' },
      { value: 'copilot', label: '🚀 GitHub Copilot — GitHub Copilot CLI' },
      { value: 'gemini', label: '🔮 Gemini — Google Gemini CLI' },
      { value: 'back', label: '⬅️  Back to main menu' },
    ],
  });

  if (choice === 'back') {
    // Resume watching if it was active
    if (wasWatching) {
      startBackgroundWatch();
    }
    return;
  }

  // Clear screen before launching workspace
  console.clear();

  // Launch AI workspace with selected AI
  await launchAIWorkspace(choice);

  // Resume watching after workspace exits
  if (wasWatching) {
    startBackgroundWatch();
  }
}

export function tuiCommand(program) {
  program
    .command('tui')
    .alias('run')
    .description('Launch interactive TUI with live watch status')
    .action(async () => {
      // Acquire lock
      const { acquireLock, releaseLock } = await import('../lib/lock.js');
      const lock = acquireLock('tui');

      if (!lock.acquired) {
        console.log(pc.red(`\n❌ GTA is already running in this repository!`));
        console.log(pc.dim(`   PID: ${lock.pid}`));
        console.log(pc.dim(`   To ignore, delete .gta/tui.lock`));
        process.exit(1);
      }

      intro(pc.bgCyan(pc.black(' GTA Interactive Mode ')));

      // Start background watch
      startBackgroundWatch();

      // Handle exit
      process.on('SIGINT', () => {
        stopBackgroundWatch();
        releaseLock('tui');
        process.exit(0);
      });

      try {
        await mainMenu();
      } finally {
        stopBackgroundWatch();
        releaseLock('tui');
      }
    });
}
