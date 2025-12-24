import pc from 'picocolors';
import { intro, outro, text, select, confirm, spinner } from '@clack/prompts';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { execa } from 'execa';

async function createProjectFiles(projectPath, projectName, options) {
  const s = spinner();
  s.start('Creating project files...');

  // Create README.md
  const readme = `# ${projectName}

${options.description || 'A new project'}

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
  if (options.createPackageJson) {
    const packageJson = {
      name: projectName,
      version: '1.0.0',
      description: options.description || '',
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

  s.stop(pc.green('✓ Project files created'));
}

async function initGitRepo(projectPath) {
  const s = spinner();
  s.start('Initializing git repository...');

  try {
    await execa('git', ['init'], { cwd: projectPath });
    await execa('git', ['add', '.'], { cwd: projectPath });
    await execa('git', ['commit', '-m', 'Initial commit'], { cwd: projectPath });
    s.stop(pc.green('✓ Git repository initialized'));
    return true;
  } catch (error) {
    s.stop(pc.red('✗ Failed to initialize git'));
    console.error(pc.red(error.message));
    return false;
  }
}

async function createGithubRepo(projectPath, projectName, options) {
  const s = spinner();
  s.start('Creating GitHub repository...');

  try {
    // Check if gh CLI is available
    await execa('which', ['gh']);

    const visibility = options.private ? '--private' : '--public';
    const description = options.description ? `--description "${options.description}"` : '';

    await execa('gh', [
      'repo',
      'create',
      projectName,
      visibility,
      '--source',
      projectPath,
      '--remote',
      'origin',
      ...(options.description ? ['--description', options.description] : []),
      '--push'
    ], { cwd: projectPath, shell: true });

    s.stop(pc.green('✓ GitHub repository created and pushed'));

    // Get the GitHub URL
    const { stdout: remoteUrl } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd: projectPath });
    const httpsUrl = remoteUrl.replace('git@github.com:', 'https://github.com/').replace('.git', '');
    console.log(pc.blue(`   ${httpsUrl}`));

    return true;
  } catch (error) {
    if (error.message.includes('which')) {
      s.stop(pc.yellow('⚠ GitHub CLI (gh) not installed'));
      console.log(pc.yellow('   Install with: brew install gh'));
    } else {
      s.stop(pc.red('✗ Failed to create GitHub repository'));
      console.error(pc.red(error.message));
    }
    return false;
  }
}

export function projectCommand(program) {
  program
    .command('project')
    .description('Project scaffolding - create new project with git and optional GitHub')
    .option('--name <name>', 'Project name')
    .option('--path <path>', 'Project path (default: current directory)')
    .option('--no-interactive', 'Skip interactive prompts')
    .action(async (options) => {
      intro(pc.bgCyan(pc.black(' GTA Project Scaffolding ')));

      let projectName = options.name;
      let projectPath = options.path || process.cwd();
      let createInNewDir = false;
      let description = '';
      let createPackageJson = false;
      let initGit = true;
      let createGithub = false;
      let isPrivate = false;

      // Interactive prompts
      if (options.interactive !== false) {
        // Project name
        if (!projectName) {
          projectName = await text({
            message: 'Project name:',
            placeholder: 'my-awesome-project',
            validate: (value) => {
              if (!value) return 'Project name is required';
              if (!/^[a-z0-9-_]+$/i.test(value)) return 'Use only letters, numbers, hyphens, and underscores';
            },
          });
        }

        // Create in new directory or use current
        createInNewDir = await confirm({
          message: 'Create in new directory?',
          initialValue: true,
        });

        if (createInNewDir) {
          projectPath = join(process.cwd(), projectName);
        }

        // Description
        description = await text({
          message: 'Project description (optional):',
          placeholder: 'A brief description of your project',
        });

        // Package.json
        createPackageJson = await confirm({
          message: 'Create package.json?',
          initialValue: true,
        });

        // Git initialization
        initGit = await confirm({
          message: 'Initialize git repository?',
          initialValue: true,
        });

        // GitHub creation
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
      }

      console.log();

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
          process.exit(1);
        }
      }

      // Create project files
      await createProjectFiles(projectPath, projectName, {
        description,
        createPackageJson,
      });

      // Initialize git
      if (initGit) {
        await initGitRepo(projectPath);
      }

      // Create GitHub repository
      if (createGithub) {
        await createGithubRepo(projectPath, projectName, {
          description,
          private: isPrivate,
        });
      }

      console.log();
      outro(pc.green(`✓ Project "${projectName}" created successfully!`));

      if (createInNewDir) {
        console.log();
        console.log(pc.cyan('Next steps:'));
        console.log(`  ${pc.dim('cd')} ${projectName}`);
        if (createPackageJson) {
          console.log(`  ${pc.dim('npm install')}`);
        }
        console.log(`  ${pc.dim('gta status')}`);
        console.log();
      }
    });
}
