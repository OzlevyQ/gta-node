import pc from 'picocolors';
import { intro, outro, text, select, confirm, spinner } from '@clack/prompts';
import { execa } from 'execa';
import { config } from '../lib/config.js';
import { generateCommitMessage } from '../lib/ai.js'; // reusing AI logic, will need refactor/export for PRs

export function flowCommand(program) {
    // --- GTA START ---
    program
        .command('start')
        .argument('[name]', 'Name of the branch (without prefix)')
        .description('Start a new task/branch with standardized naming')
        .action(async (name) => {
            intro(pc.bgCyan(pc.black(' GTA Start ')));

            const settings = config.get('workflowPrefixes');

            const type = await select({
                message: 'Select task type:',
                options: Object.keys(settings).map(key => ({
                    value: settings[key],
                    label: `${key} (${settings[key]})`
                }))
            });

            if (!name) {
                name = await text({
                    message: 'Enter task name (kebab-case recommended):',
                    placeholder: 'new-login-flow',
                    validate: (val) => {
                        if (!val) return 'Name is required';
                        if (val.includes(' ')) return 'No spaces allowed';
                    }
                });
            }

            const branchName = `${type}${name}`;

            const s = spinner();
            s.start(`Creating branch ${branchName}...`);

            try {
                await execa('git', ['checkout', '-b', branchName]);
                s.stop(pc.green(`✓ Switched to new branch: ${branchName}`));
            } catch (error) {
                s.stop(pc.red('✗ Failed to create branch'));
                console.error(pc.red(error.message));
            }

            outro('Go build something amazing! 🚀');
        });

    // --- GTA SYNC ---
    program
        .command('sync')
        .description('Sync with remote (pull --rebase)')
        .action(async () => {
            intro(pc.bgCyan(pc.black(' GTA Sync ')));
            const s = spinner();
            s.start('Syncing with remote...');
            try {
                await execa('git', ['pull', '--rebase']);
                s.stop(pc.green('✓ Up to date'));
            } catch (e) {
                s.stop(pc.red('✗ Sync failed (conflict?)'));
                console.error(pc.red(e.message));
            }
            outro('Done.');
        });

    // --- GTA PR ---
    program
        .command('pr')
        .description('Create a Pull Request with AI assistance')
        .action(async () => {
            intro(pc.bgCyan(pc.black(' GTA PR ')));

            // 1. Check gh
            try {
                await execa('which', ['gh']);
            } catch {
                console.log(pc.red('GitHub CLI (gh) is required for this command.'));
                return;
            }

            // 2. Push current branch?
            const shouldPush = await confirm({
                message: 'Push current branch before creating PR?',
                initialValue: true
            });

            if (shouldPush) {
                const s = spinner();
                s.start('Pushing...');
                try {
                    // Get current branch
                    const { stdout: branch } = await execa('git', ['branch', '--show-current']);
                    await execa('git', ['push', '-u', 'origin', branch]);
                    s.stop(pc.green('✓ Pushed'));
                } catch (e) {
                    s.stop(pc.red('✗ Push failed'));
                    console.error(e.message);
                    return;
                }
            }

            // 3. Draft PR
            // TODO: In the future, use AI to read diff and generate title/body
            // For now, simple interactive standard gh

            await execa('gh', ['pr', 'create', '--web'], { stdio: 'inherit' });

            outro('PR creation flow started.');
        });
}
