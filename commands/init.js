import pc from 'picocolors';
import { confirm, spinner } from '@clack/prompts';
import { initGitRepo } from '../lib/git.js';
import { config } from '../lib/config.js';

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
          s.stop(pc.yellow('Repository already initialized'));
        } else {
          s.stop(pc.green('✓ Repository initialized successfully'));
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
