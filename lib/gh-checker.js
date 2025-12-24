import { execa } from 'execa';
import { confirm, spinner } from '@clack/prompts';
import pc from 'picocolors';
import os from 'os';

/**
 * Check if GitHub CLI (gh) is installed
 */
export async function isGhInstalled() {
    try {
        await execa('gh', ['--version']);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if user is authenticated with GitHub CLI
 */
export async function isGhAuthenticated() {
    try {
        const { stdout } = await execa('gh', ['auth', 'status']);
        return stdout.includes('Logged in');
    } catch {
        return false;
    }
}

/**
 * Detect the operating system and architecture
 */
export function detectSystem() {
    const platform = os.platform();
    const arch = os.arch();

    const systems = {
        darwin: {
            name: 'macOS',
            installCommand: 'brew install gh',
            packageManager: 'Homebrew',
            requiresHomebrew: true,
        },
        linux: {
            name: 'Linux',
            installCommand: getLinuxInstallCommand(),
            packageManager: 'Package Manager',
            requiresHomebrew: false,
        },
        win32: {
            name: 'Windows',
            installCommand: 'winget install --id GitHub.cli',
            packageManager: 'winget',
            requiresHomebrew: false,
        },
    };

    return systems[platform] || {
        name: 'Unknown',
        installCommand: null,
        packageManager: null,
        requiresHomebrew: false,
    };
}

/**
 * Get Linux-specific install command based on distribution
 */
function getLinuxInstallCommand() {
    // Try to detect Linux distribution
    try {
        const fs = require('fs');
        if (fs.existsSync('/etc/debian_version')) {
            return 'sudo apt install gh';
        } else if (fs.existsSync('/etc/redhat-release')) {
            return 'sudo dnf install gh';
        } else if (fs.existsSync('/etc/arch-release')) {
            return 'sudo pacman -S github-cli';
        }
    } catch { }

    return 'See: https://github.com/cli/cli/blob/trunk/docs/install_linux.md';
}

/**
 * Check if Homebrew is installed (for macOS)
 */
async function isHomebrewInstalled() {
    try {
        await execa('brew', ['--version']);
        return true;
    } catch {
        return false;
    }
}

/**
 * Install GitHub CLI with full visibility of the process
 */
export async function installGh() {
    const system = detectSystem();

    console.log(pc.cyan('\n━━━ GitHub CLI Installation ━━━\n'));
    console.log(`${pc.blue('System:')} ${system.name}`);
    console.log(`${pc.blue('Package Manager:')} ${system.packageManager}`);
    console.log(`${pc.blue('Install Command:')} ${pc.dim(system.installCommand)}\n`);

    if (!system.installCommand) {
        console.log(pc.red('✗ Cannot automatically install on this system'));
        console.log(pc.yellow('Please visit: https://cli.github.com/'));
        return false;
    }

    // Check for Homebrew on macOS
    if (system.requiresHomebrew) {
        console.log(pc.dim('Checking for Homebrew...'));
        const hasHomebrew = await isHomebrewInstalled();
        if (!hasHomebrew) {
            console.log(pc.yellow('\n⚠ Homebrew is required to install GitHub CLI on macOS'));
            console.log(pc.cyan('Install Homebrew first: https://brew.sh/'));
            console.log(pc.dim('Then run: brew install gh'));
            return false;
        }
        console.log(pc.green('✓ Homebrew found\n'));
    }

    console.log(pc.cyan('Starting installation...\n'));
    console.log(pc.dim('─'.repeat(60)));

    try {
        const [command, ...args] = system.installCommand.split(' ');

        // Run installation with full output visible to user
        await execa(command, args, {
            stdio: 'inherit',  // Show all output to user
            shell: true
        });

        console.log(pc.dim('─'.repeat(60)));
        console.log(pc.green('\n✓ GitHub CLI installed successfully!\n'));

        // Verify installation
        console.log(pc.dim('Verifying installation...'));
        const { stdout } = await execa('gh', ['--version']);
        console.log(pc.green(`✓ ${stdout.split('\n')[0]}\n`));

        return true;
    } catch (error) {
        console.log(pc.dim('─'.repeat(60)));
        console.log(pc.red('\n✗ Failed to install GitHub CLI\n'));
        console.log(pc.yellow(`Please try installing manually:`));
        console.log(pc.cyan(`  ${system.installCommand}\n`));
        return false;
    }
}

/**
 * Authenticate with GitHub CLI with full visibility
 */
export async function authenticateGh() {
    console.log(pc.cyan('\n━━━ GitHub Authentication ━━━\n'));
    console.log(pc.dim('This will open your browser to authenticate with GitHub.'));
    console.log(pc.dim('Please follow the instructions in your browser.\n'));

    console.log(pc.yellow('Starting authentication process...\n'));
    console.log(pc.dim('─'.repeat(60)));

    try {
        // Use 'gh auth login' with web flow - show full output
        await execa('gh', ['auth', 'login', '--web'], {
            stdio: 'inherit',  // Show all prompts and output to user
            shell: true
        });

        console.log(pc.dim('─'.repeat(60)));
        console.log(pc.green('\n✓ Successfully authenticated with GitHub!\n'));

        // Verify authentication and show user info
        console.log(pc.dim('Verifying authentication...'));
        try {
            const { stdout } = await execa('gh', ['auth', 'status']);
            console.log(pc.green('✓ Authentication verified\n'));

            // Show user info
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.includes('Logged in')) {
                    console.log(pc.blue(`  ${line.trim()}`));
                }
            }
            console.log();
        } catch {
            // Auth status might fail but login succeeded
            console.log(pc.green('✓ Authenticated\n'));
        }

        return true;
    } catch (error) {
        console.log(pc.dim('─'.repeat(60)));
        console.log(pc.red('\n✗ Authentication failed\n'));
        console.log(pc.yellow('Please try again manually:'));
        console.log(pc.cyan('  gh auth login\n'));
        return false;
    }
}

/**
 * Main setup flow for GitHub CLI with full visibility
 * Returns true if setup is complete and user is authenticated
 */
export async function ensureGhSetup() {
    console.log(pc.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
    console.log(pc.cyan('║           GitHub CLI Setup & Configuration            ║'));
    console.log(pc.cyan('╚═══════════════════════════════════════════════════════════╝\n'));

    // Step 1: Check installation
    console.log(pc.blue('Step 1/2:') + ' Checking GitHub CLI installation...');
    const installed = await isGhInstalled();

    if (!installed) {
        console.log(pc.yellow('  ✗ GitHub CLI is not installed'));
        console.log(pc.dim('  GitHub CLI is required for repository operations\n'));

        const shouldInstall = await confirm({
            message: 'Would you like to install GitHub CLI now?',
            initialValue: true,
        });

        if (!shouldInstall) {
            console.log(pc.yellow('\n⚠ Setup cancelled'));
            console.log(pc.dim('Install later: https://cli.github.com/\n'));
            return false;
        }

        const installSuccess = await installGh();
        if (!installSuccess) {
            console.log(pc.red('\n✗ Setup failed - installation unsuccessful\n'));
            return false;
        }
    } else {
        console.log(pc.green('  ✓ GitHub CLI is already installed\n'));
    }

    // Step 2: Check authentication
    console.log(pc.blue('Step 2/2:') + ' Checking GitHub authentication...');
    const authenticated = await isGhAuthenticated();

    if (!authenticated) {
        console.log(pc.yellow('  ✗ Not authenticated with GitHub'));
        console.log(pc.dim('  Authentication is required to create and manage repositories\n'));

        const shouldAuth = await confirm({
            message: 'Would you like to authenticate with GitHub now?',
            initialValue: true,
        });

        if (!shouldAuth) {
            console.log(pc.yellow('\n⚠ Setup incomplete'));
            console.log(pc.dim('Authenticate later: gh auth login\n'));
            return false;
        }

        const authSuccess = await authenticateGh();
        if (!authSuccess) {
            console.log(pc.red('\n✗ Setup failed - authentication unsuccessful\n'));
            return false;
        }
    } else {
        console.log(pc.green('  ✓ Already authenticated with GitHub\n'));
    }

    // Success summary
    console.log(pc.green('╔═══════════════════════════════════════════════════════════╗'));
    console.log(pc.green('║              ✓ Setup Complete!                         ║'));
    console.log(pc.green('╚═══════════════════════════════════════════════════════════╝\n'));
    console.log(pc.dim('GitHub CLI is ready to use for repository operations.\n'));

    return true;
}

/**
 * Quick check - returns true if gh is installed and authenticated
 * Does not prompt user
 */
export async function isGhReady() {
    const installed = await isGhInstalled();
    if (!installed) return false;

    const authenticated = await isGhAuthenticated();
    return authenticated;
}
