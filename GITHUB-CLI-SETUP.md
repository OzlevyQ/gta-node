# GitHub CLI Auto-Setup System

## Overview

The GTA CLI now includes an intelligent GitHub CLI (`gh`) setup system that automatically detects, installs, and configures GitHub CLI when needed.

## Architecture

### Components

1. **`lib/gh-checker.js`** - Core GitHub CLI detection and setup module
   - `isGhInstalled()` - Check if gh is installed
   - `isGhAuthenticated()` - Check if user is authenticated
   - `detectSystem()` - Detect OS and appropriate installation method
   - `installGh()` - Install GitHub CLI using system package manager
   - `authenticateGh()` - Guide user through authentication
   - `ensureGhSetup()` - Main setup flow (install + authenticate)
   - `isGhReady()` - Quick check without prompts

2. **`lib/gh-middleware.js`** - Commander.js middleware
   - Hooks into `preAction` to check gh before command execution
   - Configurable list of commands that require gh
   - Configurable list of commands that skip gh check

3. **`index.js`** - Main CLI entry point
   - Registers the middleware with Commander.js program

## How It Works

### Automatic Detection Flow

```
User runs command (e.g., gta add)
         ↓
Middleware checks if command requires gh
         ↓
    Is gh installed?
    ├─ No → Prompt to install
    │       ├─ Detect OS (macOS/Linux/Windows)
    │       ├─ Show appropriate install command
    │       └─ Execute installation
    └─ Yes → Continue
         ↓
    Is gh authenticated?
    ├─ No → Prompt to authenticate
    │       └─ Run: gh auth login --web
    └─ Yes → Continue
         ↓
Execute original command
```

### OS-Specific Installation

#### macOS
- **Package Manager**: Homebrew
- **Command**: `brew install gh`
- **Prerequisite**: Checks for Homebrew installation
- **Fallback**: Directs to https://brew.sh/

#### Linux
- **Auto-detection** of distribution:
  - Debian/Ubuntu: `sudo apt install gh`
  - Fedora/RHEL: `sudo dnf install gh`
  - Arch: `sudo pacman -S github-cli`
- **Fallback**: Links to installation docs

#### Windows
- **Package Manager**: winget
- **Command**: `winget install --id GitHub.cli`

## Configuration

### Strategy: Blacklist Approach

**All commands check for GitHub CLI by default**, except those explicitly in the skip list.

This ensures:
- New commands automatically get gh checking
- No need to maintain a whitelist
- Safer default behavior

### Commands Skipping GitHub CLI Check

Only these commands skip the check:
- `config` - Configuration management
- `status` - Status display (shows gh status but doesn't require it)
- `watch` - File watcher (git only)
- `git` - Git operations (doesn't need gh)
- `ai` - AI settings
- `tui` - Interactive UI
- `web` - Web interface

**All other commands** (including `add`, `github`, `project`, `init`, etc.) will automatically check for GitHub CLI.

### Customizing Middleware

Edit `lib/gh-middleware.js`:

```javascript
// Only need to maintain the skip list
const COMMANDS_SKIP_GH_CHECK = [
  'config',
  'status',
  'watch',
  'git',
  'ai',
  'tui',
  'web',
  // Add any command that should NOT check gh
];

// All other commands automatically check gh
```

## User Experience

### First-Time User

```bash
$ gta add

⚠ GitHub CLI (gh) is not installed
GitHub CLI is required for repository operations

❯ Would you like to install GitHub CLI now? › (y/n)

[User selects Yes]

◆ Installing GitHub CLI using Homebrew...
✓ GitHub CLI installed successfully

⚠ You are not authenticated with GitHub
Authentication is required to create and manage repositories

❯ Would you like to authenticate with GitHub now? › (y/n)

[User selects Yes]

◆ Opening GitHub authentication...
[Browser opens for OAuth flow]
✓ Successfully authenticated with GitHub

[Command continues normally]
```

### Checking Status

```bash
$ gta status

━━━ SYSTEM INFO ━━━
  Git:           git version 2.39.0
  GitHub CLI:    ✓ gh version 2.40.0
  Auth Status:   ✓ Authenticated
  fzf:           ✓ installed (enhanced UI)
```

### If User Declines

```bash
$ gta add

⚠ GitHub CLI (gh) is not installed
GitHub CLI is required for repository operations

❯ Would you like to install GitHub CLI now? › No

⚠ Some features may not work without GitHub CLI
Install later: https://cli.github.com/

[Command may fail or have limited functionality]
```

## API Reference

### `isGhInstalled(): Promise<boolean>`

Checks if GitHub CLI is installed on the system.

```javascript
import { isGhInstalled } from './lib/gh-checker.js';

const installed = await isGhInstalled();
if (!installed) {
  console.log('Please install GitHub CLI');
}
```

### `isGhAuthenticated(): Promise<boolean>`

Checks if the user is authenticated with GitHub CLI.

```javascript
import { isGhAuthenticated } from './lib/gh-checker.js';

const authed = await isGhAuthenticated();
if (!authed) {
  console.log('Please run: gh auth login');
}
```

### `detectSystem(): Object`

Detects the operating system and returns installation information.

```javascript
import { detectSystem } from './lib/gh-checker.js';

const system = detectSystem();
console.log(system.name); // "macOS", "Linux", or "Windows"
console.log(system.installCommand); // "brew install gh"
console.log(system.packageManager); // "Homebrew"
```

### `ensureGhSetup(): Promise<boolean>`

Main setup flow - checks installation and authentication, prompts user if needed.

```javascript
import { ensureGhSetup } from './lib/gh-checker.js';

const ready = await ensureGhSetup();
if (ready) {
  // GitHub CLI is installed and authenticated
  // Proceed with GitHub operations
} else {
  // User declined setup or setup failed
  // Handle gracefully
}
```

### `isGhReady(): Promise<boolean>`

Quick check without user prompts. Returns true only if gh is installed AND authenticated.

```javascript
import { isGhReady } from './lib/gh-checker.js';

if (await isGhReady()) {
  // Safe to use gh commands
}
```

## Testing

### Manual Testing

```bash
# Test with gh installed and authenticated
gta add

# Test with gh not installed
# 1. Temporarily rename gh: sudo mv /usr/local/bin/gh /usr/local/bin/gh.bak
# 2. Run: gta add
# 3. Restore: sudo mv /usr/local/bin/gh.bak /usr/local/bin/gh

# Test with gh installed but not authenticated
gh auth logout
gta add
```

### Status Check

```bash
# Always check status after changes
gta status
```

## Error Handling

The system handles various error scenarios:

1. **Homebrew not installed (macOS)**
   - Detects missing Homebrew
   - Provides installation link
   - Does not attempt brew install

2. **Package manager not available**
   - Falls back to documentation links
   - Provides manual installation instructions

3. **Installation fails**
   - Shows error message
   - Provides manual installation command
   - Allows user to continue or abort

4. **Authentication fails**
   - Shows error message
   - Suggests manual authentication
   - Allows user to retry or continue

## Future Enhancements

Potential improvements:

1. **Silent mode** - Skip prompts in CI/CD environments
2. **Offline detection** - Check network before attempting auth
3. **Version checking** - Ensure minimum gh version
4. **Auto-update** - Suggest updates for old gh versions
5. **Custom auth flows** - Support for enterprise GitHub instances
6. **Caching** - Cache auth status to reduce checks

## Troubleshooting

### "gh not found" after installation

```bash
# Reload shell
exec $SHELL

# Or manually add to PATH
export PATH="/usr/local/bin:$PATH"
```

### Authentication fails

```bash
# Try manual authentication
gh auth login --web

# Check auth status
gh auth status

# Logout and retry
gh auth logout
gh auth login
```

### Installation fails on Linux

```bash
# Check your distribution
cat /etc/os-release

# Install manually following official docs
# https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

## Contributing

When adding new commands:

1. **Default behavior**: New commands automatically check for GitHub CLI
2. **To skip gh check**: Add command name to `COMMANDS_SKIP_GH_CHECK` in `lib/gh-middleware.js`
3. Test the setup flow with and without gh installed
4. Update documentation

## License

MIT
