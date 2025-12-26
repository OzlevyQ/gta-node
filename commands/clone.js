import pc from 'picocolors';
import { intro, outro, text, select, confirm, spinner } from '@clack/prompts';
import { execa } from 'execa';
import { existsSync } from 'fs';
import { join } from 'path';

export function cloneCommand(program) {
    program
        .command('clone')
        .argument('<repo>', 'Repository to clone (URL or owner/repo)')
        .description('Clone a repository and set up the environment')
        .action(async (repo) => {
            intro(pc.bgCyan(pc.black(' GTA Clone ')));

            const s = spinner();
            s.start(`Cloning ${repo}...`);

            let targetDir = '';

            try {
                // Try gh repo clone first
                try {
                    // Check if gh is available
                    await execa('which', ['gh']);
                    await execa('gh', ['repo', 'clone', repo], { stdio: 'inherit' });
                } catch (e) {
                    // Fallback to git clone if gh fails or not present
                    await execa('git', ['clone', repo], { stdio: 'inherit' });
                }

                // Determine directory name
                // Simple heuristic: last part of URL/path without .git
                const repoName = repo.split('/').pop().replace('.git', '');
                targetDir = join(process.cwd(), repoName);

                s.stop(pc.green(`✓ Cloned into ${repoName}`));

            } catch (error) {
                s.stop(pc.red('✗ Clone failed'));
                console.error(pc.red(error.message));
                process.exit(1);
            }

            // Post-clone Actions
            if (existsSync(targetDir)) {
                console.log(pc.dim(`\nWorking directory: ${targetDir}\n`));

                // Check for local config
                if (existsSync(join(targetDir, '.gta', 'config.json'))) {
                    console.log(pc.blue('ℹ Found repository-specific GTA config (.gta/config.json)'));
                }

                const runInstall = await confirm({
                    message: 'Run npm/pnpm/yarn install?',
                    initialValue: true,
                });

                if (runInstall) {
                    const spin = spinner();
                    spin.start('Installing dependencies...');
                    try {
                        // simple detection
                        let cmd = 'npm';
                        let args = ['install'];
                        if (existsSync(join(targetDir, 'pnpm-lock.yaml'))) {
                            cmd = 'pnpm';
                        } else if (existsSync(join(targetDir, 'yarn.lock'))) {
                            cmd = 'yarn';
                        }

                        await execa(cmd, args, { cwd: targetDir, stdio: 'inherit' });
                        spin.stop(pc.green('✓ Dependencies installed'));
                    } catch (e) {
                        spin.stop(pc.red('✗ Install failed'));
                    }
                }

                const openEditor = await confirm({
                    message: 'Open in VS Code?',
                    initialValue: true,
                });

                if (openEditor) {
                    try {
                        await execa('code', ['.'], { cwd: targetDir });
                        console.log(pc.green('✓ Opened VS Code'));
                    } catch (e) {
                        console.log(pc.yellow('⚠ Could not find "code" command'));
                    }
                }
            }

            outro(pc.green('You are ready to go! 🚀'));
        });
}
