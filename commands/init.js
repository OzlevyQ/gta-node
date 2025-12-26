import pc from 'picocolors';
import { confirm, spinner } from '@clack/prompts';
import { initGitRepo } from '../lib/git.js';
import { config } from '../lib/config.js';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export function initCommand(program) {
  program
    .command('init')
    .description('Initialize a new Git repository')
    .option('--create-remote', 'Create GitHub remote after init')
    .option('--repo <name>', 'Repository name for GitHub')
    .option('--org <org>', 'Organization name')
    .option('--private', 'Create private repository')
    .action(async (options) => {
      const s = spinner();

      s.start('Initializing Git repository...');

      try {
        const result = await initGitRepo(config.get('defaultBranch'));

        if (result.alreadyExists) {
          s.stop(pc.yellow('Git repository already initialized'));
        } else {
          s.stop(pc.green('✓ Git repository initialized successfully'));
        }

        // Project Signature / Local Config
        const createConfig = await confirm({
          message: 'Create project-specific GTA config (.gta/config.json)?',
          initialValue: false
        });

        if (createConfig) {
          const cs = spinner();
          cs.start('Creating project signature...');
          try {
            // Create .gta folder
            await mkdir(join(process.cwd(), '.gta'), { recursive: true });

            // Write current config as baseline
            const currentConfig = config.getAll();
            // Filter out irrelevant global stuff if needed, but keeping all is fine for signature
            await writeFile(
              join(process.cwd(), '.gta', 'config.json'),
              JSON.stringify(currentConfig, null, 2)
            );
            cs.stop(pc.green('✓ Created .gta/config.json'));

            // Add to .gitignore
            // We typically WANT to commit this config if it's a team signature
            // So we do NOT add it to gitignore by default
            console.log(pc.blue('ℹ .gta/config.json created. Commit this to share settings with your team.'));

          } catch (e) {
            cs.stop(pc.red('✗ Failed to create config'));
          }
        }

        if (options.createRemote) {
          // TODO: Implement GitHub remote creation
          console.log(pc.yellow('\nGitHub remote creation will be implemented soon.'));
          console.log(pc.dim('Use: gta github connect --create'));
        }
      } catch (error) {
        s.stop(pc.red('✗ Failed to initialize repository'));
        console.error(pc.red(error.message));
        process.exit(1);
      }
    });
}

