import { config } from './lib/config.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { execa } from 'execa';
import pc from 'picocolors';

async function testEnterpriseFeatures() {
    console.log(pc.cyan('🧪 Testing Enterprise Features\n'));

    const testDir = join(process.cwd(), 'test_enterprise_env');
    const gtaDir = join(testDir, '.gta');

    try {
        // Setup
        await mkdir(gtaDir, { recursive: true });

        // 1. Test Config Override
        console.log('Test 1: Local Config Override');
        const localConfig = {
            aiCommitPrompt: 'CUSTOM_PROMPT_TEST',
            commitThreshold: 999
        };
        await writeFile(join(gtaDir, 'config.json'), JSON.stringify(localConfig));

        // We need to run this in a separate process or ensure config reloads.
        // Since config is a singleton initialized on module load, we might need to spawn a process to test it properly against the CLI
        // But for unit testing the class, we can just instantiate it if we exported the class, but we exported an instance.
        // Let's test via CLI command `gta config show` inside the dir.

        const { stdout } = await execa('node', ['../index.js', 'config', 'show'], { cwd: testDir });

        if (stdout.includes('CUSTOM_PROMPT_TEST') && stdout.includes('999')) {
            console.log(pc.green('✓ Local config loaded successfully'));
        } else {
            console.log(pc.red('✗ Local config failed to load'));
            console.log(stdout);
        }

        // 2. Test Commands Registration
        console.log('\nTest 2: Command Registration');
        const { stdout: helpOut } = await execa('node', ['index.js', '--help']);

        const missedCommands = [];
        if (!helpOut.includes('clone')) missedCommands.push('clone');
        if (!helpOut.includes('start')) missedCommands.push('start');
        if (!helpOut.includes('sync')) missedCommands.push('sync');
        if (!helpOut.includes('pr')) missedCommands.push('pr');

        if (missedCommands.length === 0) {
            console.log(pc.green('✓ All new commands (clone, start, sync, pr) are registered'));
        } else {
            console.log(pc.red(`✗ Missing commands: ${missedCommands.join(', ')}`));
        }

    } catch (e) {
        console.error(pc.red('Test failed:'), e);
    } finally {
        // Cleanup
        await rm(testDir, { recursive: true, force: true });
    }
}

testEnterpriseFeatures();
