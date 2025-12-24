import { ensureGhSetup } from '../lib/gh-checker.js';

/**
 * List of commands that should skip GitHub CLI check
 * All other commands will automatically check for gh
 */
const COMMANDS_SKIP_GH_CHECK = [
    'config',   // Configuration management - doesn't need gh
    'status',   // Status display - shows gh status but doesn't require it
    'watch',    // File watcher - git only
    'git',      // Git operations - doesn't need gh
    'ai',       // AI settings - doesn't need gh
    'tui',      // Interactive UI - doesn't need gh
    'web',      // Web interface - doesn't need gh
];

/**
 * Middleware to check GitHub CLI setup before running commands
 * 
 * Strategy: Check gh for ALL commands except those explicitly skipped.
 * This ensures that any new commands automatically get gh checking
 * without needing to update a whitelist.
 * 
 * @param {Command} program - Commander program instance
 */
export function setupGhMiddleware(program) {
    // Hook into the action handler
    program.hook('preAction', async (thisCommand) => {
        const commandName = thisCommand.name();

        // Skip check for certain commands
        if (COMMANDS_SKIP_GH_CHECK.includes(commandName)) {
            return;
        }

        // For all other commands, ensure GitHub CLI is set up
        await ensureGhSetup();
    });
}
