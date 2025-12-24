#!/usr/bin/env node

/**
 * Example: Using the GitHub CLI checker in your own commands
 * 
 * This example shows how to integrate the gh-checker module
 * into custom commands.
 */

import {
    isGhInstalled,
    isGhAuthenticated,
    ensureGhSetup,
    isGhReady,
    detectSystem
} from '../lib/gh-checker.js';
import pc from 'picocolors';

// Example 1: Simple check before running a command
async function example1_simpleCheck() {
    console.log(pc.cyan('\n━━━ Example 1: Simple Check ━━━\n'));

    const ready = await isGhReady();

    if (ready) {
        console.log(pc.green('✓ GitHub CLI is ready!'));
        console.log('You can safely use gh commands');
    } else {
        console.log(pc.yellow('⚠ GitHub CLI is not ready'));
        console.log('Please install and authenticate gh first');
    }
}

// Example 2: Detailed status check
async function example2_detailedCheck() {
    console.log(pc.cyan('\n━━━ Example 2: Detailed Check ━━━\n'));

    const installed = await isGhInstalled();
    console.log(`Installed: ${installed ? pc.green('✓') : pc.red('✗')}`);

    if (installed) {
        const authenticated = await isGhAuthenticated();
        console.log(`Authenticated: ${authenticated ? pc.green('✓') : pc.red('✗')}`);
    }
}

// Example 3: System detection
async function example3_systemDetection() {
    console.log(pc.cyan('\n━━━ Example 3: System Detection ━━━\n'));

    const system = detectSystem();

    console.log(`Operating System: ${pc.blue(system.name)}`);
    console.log(`Package Manager: ${pc.blue(system.packageManager || 'N/A')}`);
    console.log(`Install Command: ${pc.green(system.installCommand || 'N/A')}`);
    console.log(`Requires Homebrew: ${system.requiresHomebrew ? 'Yes' : 'No'}`);
}

// Example 4: Full setup flow with user prompts
async function example4_fullSetup() {
    console.log(pc.cyan('\n━━━ Example 4: Full Setup Flow ━━━\n'));

    const ready = await ensureGhSetup();

    if (ready) {
        console.log(pc.green('\n✓ Setup complete! GitHub CLI is ready to use.'));
        // Now you can safely use gh commands
        return true;
    } else {
        console.log(pc.yellow('\n⚠ Setup incomplete. Some features may not work.'));
        return false;
    }
}

// Example 5: Custom command that requires GitHub CLI
async function example5_customCommand() {
    console.log(pc.cyan('\n━━━ Example 5: Custom Command ━━━\n'));

    // Check if gh is ready before proceeding
    if (!await isGhReady()) {
        console.log(pc.yellow('This command requires GitHub CLI.'));

        // Offer to set it up
        const setupSuccess = await ensureGhSetup();

        if (!setupSuccess) {
            console.log(pc.red('Cannot proceed without GitHub CLI'));
            return;
        }
    }

    // Now safe to use gh commands
    console.log(pc.green('✓ GitHub CLI is ready'));
    console.log('Proceeding with command...');

    // Your command logic here
    // For example: create a repository, list issues, etc.
}

// Example 6: Graceful degradation
async function example6_gracefulDegradation() {
    console.log(pc.cyan('\n━━━ Example 6: Graceful Degradation ━━━\n'));

    const ready = await isGhReady();

    if (ready) {
        console.log(pc.green('✓ Using GitHub CLI for enhanced features'));
        // Use gh commands for better UX
    } else {
        console.log(pc.yellow('⚠ GitHub CLI not available'));
        console.log('Falling back to basic git operations');
        // Use basic git commands instead
    }
}

// Main function to run all examples
async function main() {
    console.log(pc.bold(pc.cyan('\n╔═══════════════════════════════════════════════════════════╗')));
    console.log(pc.bold(pc.cyan('║         GitHub CLI Checker - Usage Examples              ║')));
    console.log(pc.bold(pc.cyan('╚═══════════════════════════════════════════════════════════╝')));

    // Run examples
    await example1_simpleCheck();
    await example2_detailedCheck();
    await example3_systemDetection();

    // Uncomment to test interactive examples:
    // await example4_fullSetup();
    // await example5_customCommand();
    // await example6_gracefulDegradation();

    console.log(pc.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    console.log(pc.dim('Tip: Uncomment interactive examples in main() to test them\n'));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export {
    example1_simpleCheck,
    example2_detailedCheck,
    example3_systemDetection,
    example4_fullSetup,
    example5_customCommand,
    example6_gracefulDegradation,
};
