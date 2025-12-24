#!/usr/bin/env node

/**
 * Test script for GitHub CLI setup flow
 * Run: node test-gh-setup.js
 */

import { ensureGhSetup, isGhReady } from './lib/gh-checker.js';
import pc from 'picocolors';

async function main() {
    console.log(pc.bold(pc.cyan('\n🧪 Testing GitHub CLI Setup Flow\n')));

    // Check current status
    console.log(pc.dim('Checking current status...'));
    const ready = await isGhReady();

    if (ready) {
        console.log(pc.green('✓ GitHub CLI is already installed and authenticated!\n'));
        console.log(pc.dim('To test the setup flow, you can:'));
        console.log(pc.dim('  1. Uninstall gh temporarily'));
        console.log(pc.dim('  2. Or logout: gh auth logout\n'));
        return;
    }

    console.log(pc.yellow('GitHub CLI needs setup.\n'));

    // Run the full setup flow
    const success = await ensureGhSetup();

    if (success) {
        console.log(pc.bold(pc.green('🎉 Test completed successfully!\n')));
    } else {
        console.log(pc.bold(pc.red('❌ Test failed or was cancelled.\n')));
    }
}

main().catch(error => {
    console.error(pc.red('\n❌ Error:'), error.message);
    process.exit(1);
});
