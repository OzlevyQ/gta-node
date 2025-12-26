import { execa } from 'execa';
import pc from 'picocolors';

async function diagnoseGit() {
    console.log('1. Checking status...');
    const { stdout: status } = await execa('git', ['status', '--porcelain']);
    console.log(status || '(clean)');

    console.log('\n2. Running git add -A...');
    await execa('git', ['add', '-A']);

    console.log('\n3. Checking cached diff...');
    try {
        const { stdout: diff } = await execa('git', ['diff', '--cached', '--name-only']);
        if (diff) {
            console.log('   Staged files:\n' + diff);
        } else {
            console.log('   No files staged!');
        }
    } catch (e) {
        console.log('Error checking diff:', e.message);
    }

    console.log('\n4. Attempting commit...');
    try {
        await execa('git', ['commit', '-m', 'chore: diagnostic commit']);
        console.log('   Commit success!');
    } catch (e) {
        console.log('   Commit failed:', e.message);
    }
}

diagnoseGit();
