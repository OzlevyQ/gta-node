#GTA Node.js - Claude Code Reference

This document helps Claude Code understand the GTA (Git & Task Automation) Node.js codebase architecture and implementation patterns.

## Project Overview

GTA is a modern CLI tool for Git automation and task management, completely rewritten in Node.js using 2025 best practices. It provides both interactive TUI and command-line interfaces for common Git workflows, project scaffolding, and automation.

**Key Technologies:**
- **Commander.js** - CLI command framework with automatic help generation
- **Clack (@clack/prompts)** - Modern interactive prompts (intro, outro, select, text, confirm, spinner)
- **Execa** - Process execution wrapper for running git commands
- **Conf** - JSON-based configuration management with schema validation
- **Picocolors** - Minimal terminal colors library
- **Zod** - Runtime schema validation

## Architecture

### Entry Point
`/Users/mymac/Code/gg/gta-node/index.js` - Main CLI entry point
- Creates Commander program
- Registers all commands from `/commands` directory
- Handles version and help flags
- Parses command-line arguments

### Directory Structure
```
gta-node/
├── index.js              # Main entry point + middleware setup
├── package.json          # NPM package config, dependencies, bin field
├── commands/             # Command implementations
│   ├── init.js          # Git repository initialization
│   ├── status.js        # Complete status display (enhanced with gh status)
│   ├── config.js        # Configuration management
│   ├── git.js           # Git operations (switch, branch)
│   ├── github.js        # GitHub remote operations
│   ├── ai.js            # AI provider configuration
│   ├── watch.js         # Auto-commit watcher
│   ├── tui.js           # Interactive TUI interface
│   ├── project.js       # Project scaffolding
│   ├── add.js           # Quick project setup (git + GitHub)
│   └── web.js           # Web interface
├── lib/                  # Core library modules
│   ├── config.js        # Configuration management (Conf + Zod)
│   ├── git.js           # Git operation wrappers
│   ├── gh-checker.js    # ⭐ NEW: GitHub CLI detection & setup
│   ├── gh-middleware.js # ⭐ NEW: Commander.js middleware for gh checking
│   ├── ai.js            # AI provider integration
│   └── logger.js        # Logging utilities
├── utils/                # Utility functions
│   └── github.js        # GitHub URL conversion
├── examples/             # Code examples
│   ├── gh-checker-usage.js  # GitHub CLI checker examples
│   └── README.md        # Examples guide
├── web/                  # Web interface files
│   ├── index.html       # Main web UI
│   ├── dashboard.html   # Dashboard page
│   ├── commits.html     # Commits page
│   └── config.html      # Config page
└── test-gh-setup.js     # Test script for GitHub CLI setup
```

### Configuration System

**Location:** `~/.config/gta/config.json`

**Implementation:** `/Users/mymac/Code/gg/gta-node/lib/config.js`

Uses dual schema approach:
1. **Conf schema** (JSON Schema format) - for Conf library validation
2. **Zod schema** - for runtime type validation and TypeScript-like checks

**Available Settings:**
```javascript
{
  autoMode: 'manual' | 'confirm' | 'auto',    // Automation mode
  commitThreshold: number,                     // Min lines for auto-commit
  aiProvider: 'openai' | 'ollama' | 'anthropic' | 'gemini' | 'none',
  aiModel: string,                             // AI model name
  defaultBranch: string,                       // Default branch name
  pushOnCommit: boolean,                       // Auto-push after commit
  aiCommitMessages: boolean,                   // Use AI for commit messages
  aiCommitMaxChars: number,                    // Max commit message length
  aiCommitStyle: string                        // Commit message style
}
```

**Key Functions:**
- `config.get(key)` - Get single value
- `config.set(key, value)` - Set single value
- `config.getAll()` - Get all settings
- `config.reset()` - Reset to defaults
- `config.getPath()` - Get config file path

### Git Operations

**Implementation:** `/Users/mymac/Code/gg/gta-node/lib/git.js`

All Git operations use `execa` for process execution. Each function is async and handles errors.

**Key Functions:**
- `isGitRepo()` - Check if current directory is a git repository
- `ensureGitRepo()` - Throw error if not in git repo
- `getRepoName()` - Get repository name from remote URL or directory
- `getCurrentBranch()` - Get current branch name
- `getRemoteUrl()` - Get remote origin URL
- `hasChanges()` - Check for uncommitted changes
- `getChangeSize()` - Count changed lines (insertions + deletions)
- `commitChanges(message)` - Stage all and commit with message
- `pushChanges(branch)` - Push to remote branch
- `listBranches()` - List all branches with current highlighted
- `createBranch(name)` - Create and switch to new branch
- `switchBranch(ref)` - Switch to branch or commit
- `getLog(count)` - Get formatted commit log
- `setRemoteUrl(url)` - Set remote origin URL

**Pattern:** All functions return promises and include error handling. Most functions check for git repo existence first.

### GitHub CLI Auto-Setup System ⭐ NEW

**Implementation:** `/Users/mymac/Code/gg/gta-node/lib/gh-checker.js` + `/Users/mymac/Code/gg/gta-node/lib/gh-middleware.js`

**Architecture:**
- **Middleware Pattern**: Uses Commander.js `preAction` hook to check GitHub CLI before command execution
- **Blacklist Approach**: All commands check for gh by default, except those explicitly skipped
- **Visual Flow**: Complete visibility of installation and authentication process
- **Cross-Platform**: Supports macOS (Homebrew), Linux (apt/dnf/pacman), Windows (winget)

**Key Components:**

1. **gh-checker.js** - Core detection and setup module
   - `isGhInstalled()` - Check if gh is installed
   - `isGhAuthenticated()` - Check if user is authenticated
   - `detectSystem()` - Detect OS and appropriate installation method
   - `installGh()` - Install GitHub CLI with full visibility
   - `authenticateGh()` - Guide through authentication with full visibility
   - `ensureGhSetup()` - Main setup flow with step-by-step progress
   - `isGhReady()` - Quick check without prompts

2. **gh-middleware.js** - Commander.js middleware
   - Hooks into `preAction` to check before command execution
   - `COMMANDS_SKIP_GH_CHECK` - List of commands that don't need gh
   - All other commands automatically check gh (blacklist approach)

**Visual Flow Features:**
- Step-by-step progress (Step 1/2, Step 2/2)
- Real-time output from package managers during installation
- Full authentication flow with browser instructions
- Verification after each step
- Beautiful success summary with visual borders
- System information display (OS, package manager, install command)

**Commands That Skip gh Check:**
- `config` - Configuration management
- `status` - Status display (shows gh status but doesn't require it)
- `watch` - File watcher (git only)
- `git` - Git operations
- `ai` - AI settings
- `tui` - Interactive UI
- `web` - Web interface

**All Other Commands** automatically check for GitHub CLI before execution.

**Pattern:** 
```javascript
// Middleware checks gh before command runs
program.hook('preAction', async (thisCommand) => {
  if (!COMMANDS_SKIP_GH_CHECK.includes(thisCommand.name())) {
    await ensureGhSetup(); // Shows full visual flow if needed
  }
});
```

**Testing:** Use `node test-gh-setup.js` to test the full setup flow independently.



## Commands

### Interactive TUI (`commands/tui.js`)

**Usage:** `gta tui` or `gta run`

**Architecture:**
- `showHeader()` - Persistent header showing repo info, branch, status, and config
- `mainMenu()` - Main menu loop with options for all features
- Sub-menus: `gitMenu()`, `projectMenu()`, `githubMenu()`, `automationMenu()`, `aiMenu()`, `configMenu()`, `statusMenu()`, `webMenu()`

### Web Interface (`commands/web.js`)

**Usage:** `gta web [-p <port>] [--no-open]`

**Architecture:**
- Pure Node.js HTTP server (no Express)
- Single HTML file with embedded CSS and JavaScript
- RESTful API endpoints for all operations
- Real-time auto-refresh (5 seconds)

**Key Features:**
- Dashboard page with repo info, automation status, and quick actions
- Commits page with AI-powered commit generation
- Config page showing all settings
- Profile page with personal information
- Pure vanilla JavaScript - no frameworks
- Responsive design with gradient background
- Modern UI with cards, buttons, and modals

**API Endpoints:**
- `GET /api/status` - Get complete status (repo + config)
- `POST /api/commit` - Create commit (with AI if enabled)
- `POST /api/commit/generate` - Force AI commit message generation
- `POST /api/push` - Push commits to remote

**Implementation Details:**
- Uses `createServer` from `http` module
- Serves single HTML page with embedded styles and scripts
- JSON API for all operations
- Opens browser automatically on start (unless `--no-open`)
- Handles Ctrl-C gracefully

**Pattern:** Each menu function:
1. Calls `showHeader()` to show current state
2. Uses Clack `select()` or `text()` for user input
3. Performs operations with `spinner()` for feedback
4. Uses `await text({ message: 'Press Enter...' })` to pause before returning
5. Returns to previous menu or continues loop

**Key Design Choice:** Header is shown at top of every screen to provide context. Uses box-drawing characters for professional appearance. Compact single-line display for repo info.

### Status Command (`commands/status.js`)

**Usage:** `gta status [--all]`

Displays comprehensive information in sections:
1. **Git Repository** - Name, path, branch, last commit, remote, sync status, changes, file counts, branch count
2. **Automation Settings** - Mode (with description), threshold, push setting, default branch
3. **AI Provider Settings** - Provider, model, commit messages enabled, CLI availability
4. **System Info** - GTA version, config path, git version, GitHub CLI, fzf

**Pattern:** Uses box-drawing for section headers. Shows all relevant information in a single view. Checks for CLI tool availability using `execa('which', [tool])`.

### Watch Command (`commands/watch.js`)

**Usage:** `gta watch [--once] [--interval <seconds>]`

**Implementation:**
- `watchOnce()` - Single check cycle
  1. Check for changes with `hasChanges()`
  2. Get change size with `getChangeSize()`
  3. Compare against `commitThreshold`
  4. Handle based on `autoMode`:
     - `manual` - Log and skip
     - `confirm` - Skip in watch mode (no interactive prompts)
     - `auto` - Auto-commit and optionally push

- Main command:
  1. Validate git repo
  2. Display config info
  3. Run once if `--once` flag
  4. Otherwise, run immediately then set interval
  5. Handle SIGINT (Ctrl-C) for graceful exit

**Pattern:** Non-blocking loop with `setInterval()`. Clean shutdown with `clearInterval()` on SIGINT.

### Project Command (`commands/project.js`)

**Usage:** `gta project [--name <name>] [--path <path>] [--no-interactive]`

**Features:**
- Interactive prompts for project setup
- Creates README.md with project name and description
- Creates .gitignore with common patterns
- Optional package.json creation
- Git initialization with initial commit
- GitHub repository creation using `gh` CLI
- Public/private repository option

**Implementation:**
- `createProjectFiles()` - Create README, .gitignore, package.json
- `initGitRepo()` - Initialize git and make initial commit
- `createGithubRepo()` - Create remote repository and push

**Pattern:** Uses Clack prompts for interactive mode. Supports non-interactive mode with CLI flags. Validates project name format. Shows next steps after completion.

### Other Commands

- **init** (`commands/init.js`) - Initialize git repo, set remote, configure settings
- **config** (`commands/config.js`) - Manage configuration with subcommands
- **git** (`commands/git.js`) - Git operations (switch, branch)
- **github** (`commands/github.js`) - GitHub remote operations
- **ai** (`commands/ai.js`) - AI provider configuration

## Development Patterns

### Error Handling
All async operations use try/catch blocks. Spinners show `✓` for success, `✗` for failure, `⚠` for warnings.

### User Feedback
- Use Clack `spinner()` for long operations
- Show progress with `spinner.message()`
- Use color coding: green for success, red for errors, yellow for warnings, blue for info
- Include helpful next steps after operations

### Command Registration
All commands follow the pattern:
```javascript
export function commandName(program) {
  program
    .command('name')
    .description('Description')
    .option('--flag', 'Flag description')
    .action(async (options) => {
      // Implementation
    });
}
```

### ESM Modules
The project uses `"type": "module"` in package.json. All imports use ESM syntax:
```javascript
import { execa } from 'execa';
import pc from 'picocolors';
```

### Global Installation
The `bin` field in package.json makes `gta` available globally:
```json
{
  "bin": {
    "gta": "./index.js"
  }
}
```

Install globally: `npm link` (development) or `npm install -g gta-cli` (production)

## Key Implementation Details

### Compact UI Design
The user requested minimal whitespace to fit standard terminal size:
- Single-line repo status with emojis
- Compact config display on header
- No excessive blank lines
- Box-drawing characters for visual separation

### Complete Status Display
Status command shows "everything" - all repository details, config, and system info in one view. This was a specific user requirement.

### TUI Integration
The TUI provides access to all functionality through interactive menus. Each menu option shows current values (e.g., "Mode (current: auto)") to provide context.

### GitHub CLI Integration
Uses `gh` CLI for repository creation. Checks for availability with `execa('which', ['gh'])` and provides installation instructions if missing.

### Watch Mode Behavior
In watch mode, `confirm` mode skips prompts (logged as skipped) to avoid blocking. Only `auto` mode performs actual commits.

## Common Tasks

### Adding a New Command
1. Create file in `/commands/` directory
2. Export function that receives `program` parameter
3. Register command with `.command()`, `.description()`, `.action()`
4. Import and call in `index.js`
5. Add to TUI menu if applicable

### Adding Configuration Option
1. Add to `confSchema` in `lib/config.js` (JSON Schema format)
2. Add to `configSchema` (Zod schema) for validation
3. Add default value
4. Document in README.md

### Testing Changes
```bash
npm link           # Install globally in dev mode
gta --help        # Verify command shows up
gta tui           # Test TUI integration
```

## Non-Obvious Implementation Choices

1. **Dual Schema System**: Uses both JSON Schema (for Conf) and Zod (for validation) because Conf doesn't support Zod directly but we want strong typing.

2. **Header Pattern in TUI**: `showHeader()` is called at start of every menu to maintain context. This was a key user requirement for "application-like" experience.

3. **Watch Mode Confirm Skip**: In watch mode, `confirm` mode doesn't prompt because it would block the watcher. It logs and skips instead.

4. **Execa for All Git**: Even simple git commands use `execa` for consistent error handling and cross-platform compatibility.

5. **GitHub URL Conversion**: Converts SSH URLs to HTTPS for display using `remoteToHttps()` utility function.

6. **Process CWD in Commands**: Most commands operate in `process.cwd()` to work in any directory, not hardcoded paths.

## Future Enhancements

- AI-powered commit message generation (infrastructure in place)
- More sophisticated change detection (file-level, not just line count)
- Branch management workflows (merge, rebase, PR creation)
- Integration with other Git hosting platforms (GitLab, Bitbucket)
- Plugin system for custom commands

## Debugging Tips

1. **Config issues**: Check `~/.config/gta/config.json` and compare with schema
2. **Git operations failing**: Ensure in a git repository, check `git status` manually
3. **Command not found**: Run `npm link` again or check `which gta`
4. **TUI menu loops**: Check that `while (true)` loops have proper `break` conditions
5. **GitHub operations**: Verify `gh` CLI is installed and authenticated with `gh auth status`
