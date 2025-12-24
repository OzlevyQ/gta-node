import pc from 'picocolors';
import { intro, outro, text, confirm, spinner, isCancel } from '@clack/prompts';
import { readdir, writeFile, access } from 'fs/promises';
import { basename } from 'path';
import { execa } from 'execa';
import { isGitRepo } from '../lib/git.js';
import { generateReadme, generateProjectDescription } from '../lib/ai.js';
import { config } from '../lib/config.js';

async function ensureGhCliAuth() {
  try {
    await execa('gh', ['auth', 'status']);
    return true;
  } catch (error) {
    return false;
  }
}

async function hasGitCommits() {
  try {
    await execa('git', ['rev-parse', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

async function hasGitRemote() {
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin']);
    return !!stdout.trim();
  } catch {
    return false;
  }
}

export function addCommand(program) {
  program
    .command('add')
    .description('Initialize current project, create GitHub repo, and connect automatically')
    .option('--private', 'Create private repository')
    .option('--public', 'Create public repository (default)')
    .option('--no-ai', 'Skip AI-generated content')
    .action(async (options) => {
      intro(pc.bgCyan(pc.black(' GTA Add Project to GitHub ')));

      const cwd = process.cwd();
      const projectName = basename(cwd);

      console.log(pc.cyan(`  Project: ${pc.green(projectName)}`));
      console.log(pc.cyan(`  Path:    ${pc.blue(cwd)}`));
      console.log();

      // Check if gh CLI is available
      try {
        await execa('which', ['gh']);
      } catch {
        console.log(pc.red('✗ GitHub CLI (gh) not installed'));
        console.log(pc.yellow('  Install with: brew install gh'));
        process.exit(1);
      }

      // Check if authenticated
      const isAuth = await ensureGhCliAuth();
      if (!isAuth) {
        console.log(pc.yellow('⚠ Not authenticated with GitHub CLI'));
        console.log(pc.cyan('  Run: gh auth login'));
        process.exit(1);
      }

      // Get existing files
      let files = [];
      try {
        const entries = await readdir(cwd);
        files = entries.filter(f => !f.startsWith('.') && f !== 'node_modules');
      } catch {}

      // Generate description using AI if enabled
      let description = '';
      const useAI = options.ai !== false && config.get('aiProvider') !== 'none';

      if (useAI) {
        const s = spinner();
        s.start('Generating project description with AI...');
        try {
          description = await generateProjectDescription(projectName, files.slice(0, 5));
          s.stop(pc.green(`✓ AI: "${description}"`));
        } catch (error) {
          s.stop(pc.yellow('⚠ AI generation failed, using manual input'));
          console.log(pc.dim(`  ${error.message}`));
        }
      }

      if (!description) {
        description = await text({
          message: 'Project description (optional):',
          placeholder: 'A brief description of your project',
        });

        if (isCancel(description)) {
          console.log(pc.yellow('Operation cancelled'));
          process.exit(0);
        }
      }

      // Determine visibility
      let isPrivate = false;
      if (options.private) {
        isPrivate = true;
      } else if (!options.public) {
        const privateChoice = await confirm({
          message: 'Make repository private?',
          initialValue: false,
        });

        if (isCancel(privateChoice)) {
          console.log(pc.yellow('Operation cancelled'));
          process.exit(0);
        }

        isPrivate = privateChoice;
      }

      console.log();

      // Create README.md if it doesn't exist
      const hasReadme = files.some(f => f.toLowerCase() === 'readme.md');

      if (!hasReadme) {
        const s = spinner();
        s.start('Creating README.md...');

        let readmeContent;
        if (useAI) {
          try {
            readmeContent = await generateReadme(projectName, description);
            s.stop(pc.green('✓ AI-generated README.md'));
          } catch (error) {
            readmeContent = createDefaultReadme(projectName, description);
            s.stop(pc.green('✓ README.md created'));
          }
        } else {
          readmeContent = createDefaultReadme(projectName, description);
          s.stop(pc.green('✓ README.md created'));
        }

        try {
          await writeFile('README.md', readmeContent);
        } catch (error) {
          console.log(pc.red('✗ Failed to create README.md'));
          console.error(pc.red(error.message));
        }
      }

      // Create .gitignore if it doesn't exist
      const hasGitignore = files.some(f => f === '.gitignore');

      if (!hasGitignore) {
        const s = spinner();
        s.start('Creating .gitignore...');

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

        try {
          await writeFile('.gitignore', gitignore);
          s.stop(pc.green('✓ .gitignore created'));
        } catch (error) {
          s.stop(pc.yellow('⚠ Failed to create .gitignore'));
        }
      }

      // CRITICAL: Ensure git repository is initialized with commits
      const isRepo = await isGitRepo();
      const hasCommits = await hasGitCommits();
      const hasRemote = await hasGitRemote();

      if (!isRepo) {
        // Not a git repo - initialize it
        const s = spinner();
        s.start('Initializing git repository...');

        try {
          await execa('git', ['init']);
          s.message('Staging files...');
          await execa('git', ['add', '.']);

          // Generate commit message with AI if enabled
          let commitMsg = 'Initial commit';
          if (useAI) {
            try {
              s.message('Generating commit message with AI...');
              const { generateCommitMessage } = await import('../lib/ai.js');
              commitMsg = await generateCommitMessage();
            } catch (error) {
              // Fallback to default
              console.log(pc.dim(`  Using default commit message`));
            }
          }

          s.message('Creating initial commit...');
          await execa('git', ['commit', '-m', commitMsg]);
          s.stop(pc.green('✓ Git repository initialized'));
        } catch (error) {
          s.stop(pc.red('✗ Failed to initialize git'));
          console.error(pc.red(error.message));
          console.log(pc.yellow('\nDebug info:'));
          console.log(pc.dim(`  Error: ${error.stderr || error.message}`));
          process.exit(1);
        }
      } else if (!hasCommits) {
        // Git repo exists but no commits
        const s = spinner();
        s.start('Creating initial commit...');

        try {
          await execa('git', ['add', '.']);

          let commitMsg = 'Initial commit';
          if (useAI) {
            try {
              s.message('Generating commit message with AI...');
              const { generateCommitMessage } = await import('../lib/ai.js');
              commitMsg = await generateCommitMessage();
            } catch {
              // Fallback
            }
          }

          await execa('git', ['commit', '-m', commitMsg]);
          s.stop(pc.green('✓ Initial commit created'));
        } catch (error) {
          s.stop(pc.red('✗ Failed to create commit'));
          console.error(pc.red(error.message));
          process.exit(1);
        }
      } else {
        // Has git repo and commits - just stage any new files
        try {
          const { stdout: status } = await execa('git', ['status', '--porcelain']);
          if (status.trim()) {
            const s = spinner();
            s.start('Staging new files...');
            await execa('git', ['add', '.']);

            let commitMsg = 'Add project files';
            if (useAI) {
              try {
                s.message('Generating commit message with AI...');
                const { generateCommitMessage } = await import('../lib/ai.js');
                commitMsg = await generateCommitMessage();
              } catch {}
            }

            await execa('git', ['commit', '-m', commitMsg]);
            s.stop(pc.green('✓ Changes committed'));
          }
        } catch {
          // No changes to commit, that's fine
        }
      }

      // Verify git is properly set up before creating GitHub repo
      const finalCheck = await hasGitCommits();
      if (!finalCheck) {
        console.log(pc.red('✗ Git repository not properly initialized'));
        console.log(pc.yellow('  Please check git status and try again'));
        process.exit(1);
      }

      // Check if remote already exists
      let needsManualRemote = false;
      if (hasRemote) {
        const { stdout: existingRemote } = await execa('git', ['remote', 'get-url', 'origin']);
        console.log(pc.yellow('⚠ Repository already has remote:'));
        console.log(pc.blue(`   ${existingRemote.trim()}`));

        const replace = await confirm({
          message: 'Replace with new GitHub repository?',
          initialValue: false,
        });

        if (isCancel(replace) || !replace) {
          console.log(pc.yellow('\nKeeping existing remote. Done!'));
          process.exit(0);
        }

        // Remove existing remote
        await execa('git', ['remote', 'remove', 'origin']);
        needsManualRemote = true; // Flag to add remote manually
      }

      // Create GitHub repository and connect
      const s = spinner();
      s.start('Creating GitHub repository...');

      try {
        const visibility = isPrivate ? '--private' : '--public';

        if (needsManualRemote) {
          // Create repo without --source flag when we removed old remote
          const { stdout: ghOutput } = await execa('gh', [
            'repo',
            'create',
            projectName,
            visibility,
            ...(description ? ['--description', description] : []),
            '--json', 'sshUrl'
          ]);

          const repoInfo = JSON.parse(ghOutput);
          const sshUrl = repoInfo.sshUrl;

          s.message('Adding remote...');
          await execa('git', ['remote', 'add', 'origin', sshUrl]);

          s.message('Pushing to GitHub...');
          const { stdout: branch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
          await execa('git', ['push', '-u', 'origin', branch.trim()]);

        } else {
          // Normal flow - create with --source
          await execa('gh', [
            'repo',
            'create',
            projectName,
            visibility,
            '--source',
            '.',
            '--remote',
            'origin',
            ...(description ? ['--description', description] : [])
          ]);

          s.message('Pushing to GitHub...');
          const { stdout: branch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
          await execa('git', ['push', '-u', 'origin', branch.trim()]);
        }

        s.stop(pc.green('✓ GitHub repository created and pushed'));

        // Get the GitHub URL
        const { stdout: remoteUrl } = await execa('git', ['config', '--get', 'remote.origin.url']);
        const httpsUrl = remoteUrl.replace('git@github.com:', 'https://github.com/').replace('.git', '');

        console.log();
        console.log(pc.blue('   ' + httpsUrl.trim()));
        console.log();
      } catch (error) {
        s.stop(pc.red('✗ Failed to create GitHub repository'));
        console.error(pc.red(error.message));
        console.log(pc.yellow('\nDebug info:'));
        console.log(pc.dim(`  Error: ${error.stderr || error.message}`));

        // Try to show more helpful error
        if (error.message.includes('already exists')) {
          console.log(pc.yellow('\n  Repository might already exist on GitHub'));
          console.log(pc.cyan('  Try: gh repo delete ' + projectName));
        }

        process.exit(1);
      }

      outro(pc.green(`✓ Project "${projectName}" added to GitHub!`));

      console.log();
      console.log(pc.cyan('Next steps:'));
      console.log(`  ${pc.dim('gta status')}      # View project status`);
      console.log(`  ${pc.dim('gta watch')}       # Start auto-commit watcher`);
      console.log();
    });
}

function createDefaultReadme(projectName, description) {
  return `# ${projectName}

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
}
