# GTA 2.0 - Git & Task Automation CLI

Modern Node.js version of GTA built with **Commander.js**, **Clack**, and **Gemini AI**.

## Features

- 🎨 Beautiful, modern CLI interface with **Clack prompts**
- 🌐 **Web Interface** - Full-featured web dashboard with real-time updates
- ⚡ Fast and lightweight
- 🔄 Auto-commit and push automation
- 🤖 **AI-powered commit messages with Gemini**
- 📝 **Smart commit summaries** - Groups commits and asks before pushing
- 🌐 GitHub integration with automatic repository creation
- 🔧 **Auto GitHub CLI Setup** - Automatically detects, installs, and configures GitHub CLI
- 🚀 **Instant project initialization** - `gta add` sets up everything automatically
- 📦 Easy global installation
- 💻 Pure HTML & JavaScript - No frameworks, lightweight and fast


## Installation

### From Source

```bash
cd gta-node
npm install
npm link
```

### Verify Installation

```bash
gta --version
gta --help
```

## Quick Start

### Setup Gemini AI (Recommended)

GTA uses Gemini AI by default for intelligent commit messages and summaries:

```bash
# Install Gemini CLI
npm install -g @google/generative-ai-cli

# Authenticate (first time only)
gemini auth login

# Verify it works
gta status  # Should show "AI Provider: gemini"
```

### GitHub CLI Auto-Setup

GTA automatically checks for GitHub CLI (`gh`) when you run commands that need it. If it's not installed or not authenticated, GTA will guide you through the setup:

**What happens automatically:**
1. 🔍 **Detection**: Checks if `gh` is installed
2. 💻 **OS Detection**: Identifies your operating system (macOS, Linux, Windows)
3. 📦 **Installation**: Offers to install `gh` using the appropriate package manager:
   - **macOS**: `brew install gh` (requires Homebrew)
   - **Linux**: Distribution-specific command (apt, dnf, pacman)
   - **Windows**: `winget install --id GitHub.cli`
4. 🔐 **Authentication**: Guides you through `gh auth login` if not authenticated

**Example workflow:**
```bash
# First time running a GitHub command
gta add

# GTA automatically checks:
# ⚠ GitHub CLI (gh) is not installed
# GitHub CLI is required for repository operations
# 
# ❯ Would you like to install GitHub CLI now? (y/n)
# 
# [After installation]
# ⚠ You are not authenticated with GitHub
# Authentication is required to create and manage repositories
# 
# ❯ Would you like to authenticate with GitHub now? (y/n)
```

**Manual setup:**
```bash
# Check GitHub CLI status
gta status  # Shows installation and authentication status

# Manual installation (if needed)
# macOS:
brew install gh

# Manual authentication
gh auth login
```

### Basic Usage

```bash
# Add current folder to GitHub (AI-powered)
cd your-project/
gta add

# Interactive mode
gta tui

# Start auto-commit watcher
gta watch

# Show status
gta status
```

### How It Works

1. **Auto-commit**: When changes exceed threshold (default: 20 lines), GTA creates a commit with AI-generated message
2. **Smart summaries**: After 3 commits (configurable), Gemini summarizes all changes
3. **Confirm before push**: You review the summary and decide whether to push

## Commands

### Interactive Mode

```bash
gta tui     # Launch interactive TUI
gta run     # Alias for 'gta tui'
```

### Quick Project Setup

```bash
# Add current folder to GitHub (recommended!)
cd your-project/
gta add                     # AI generates description & README
gta add --private           # Create private repo
gta add --no-ai             # Skip AI generation
```

What `gta add` does:
- 🤖 AI generates project description and README
- 📁 Creates .gitignore
- 🔧 Initializes git repository
- 🤖 AI generates initial commit message
- 🌐 Creates GitHub repository
- 🚀 Pushes everything automatically

### Project Scaffolding (Advanced)

```bash
gta project                 # Interactive project creation
gta project --name my-app   # Create with specific name
```

Creates new projects with:
- README.md and .gitignore
- Optional package.json
- Git initialization
- GitHub repository creation (requires gh CLI)

### Repository Management

```bash
gta init                    # Initialize git repository
gta status                  # Show complete status and configuration
gta status --all            # Show extended information
```

### Configuration

```bash
gta config show             # Show all configuration
gta config get <key>        # Get specific value
gta config set <key> <val>  # Set configuration value
gta config edit             # Edit config file
gta config reset            # Reset to defaults
```

### Git Operations

```bash
gta git switch <ref>        # Switch branch/commit
gta git branch              # Branch operations
```

### Automation & Watching

```bash
gta watch                   # Watch for changes and auto-commit
gta watch --once            # Check once and exit
gta watch --interval 5      # Custom check interval (seconds)
```

**How watch mode works:**
1. Monitors for changes every 3 seconds (customizable)
2. When changes exceed threshold (20 lines), creates commit with AI-generated message
3. After 3 commits, Gemini generates a summary
4. Asks you: "Push 3 commits to remote?" with the summary
5. You decide whether to push based on the summary

**Example workflow:**
```bash
cd my-project/
gta watch

# ... you code ...
# ✓ Committed: feat(auth): implement JWT token validation
# ✓ Committed: fix(api): handle edge case in user lookup
# ✓ Committed: refactor(auth): extract token helper functions
#
# ━━━ 3 Unpushed Commits ━━━
# 📝 Summary: Added JWT authentication with proper error handling
#             and refactored token utilities for reusability
# ❯ Push 3 commits to remote? (y/n)
```

### Web Interface

Launch a full-featured web dashboard:

```bash
gta web                     # Launch web interface on port 3000
gta web -p 8080             # Use custom port
gta web --no-open           # Don't open browser automatically
```

**Features:**
- 📊 Real-time dashboard with repository status
- 💾 Quick commit and push buttons
- 📜 Recent commits log viewer
- ⚙️ Configuration viewer
- 👤 Profile page with personal settings
- 🔄 Auto-refresh every 5 seconds
- 🎨 Modern, responsive design
- 🚀 Pure HTML & JavaScript - no frameworks

**Access from TUI:**
```bash
gta tui
# Select: 🌐 Web — open web interface
```

### Other Commands

```bash
gta github connect          # Connect to GitHub
gta ai set-provider <name>  # Set AI provider
```

## Configuration

Configuration is stored in: `~/.config/gta/config.json`

### Core Settings

- **`autoMode`**: `manual` | `confirm` | `auto` (default: `auto`)
  - Controls automatic commit behavior

- **`commitThreshold`**: number (default: `20`)
  - Minimum lines changed before creating commit

- **`aiProvider`**: `gemini` | `openai` | `anthropic` | `ollama` | `none` (default: `gemini`)
  - AI provider for commit messages and summaries

- **`aiModel`**: string (default: `gemini-2.0-flash-exp`)
  - Specific AI model to use

### AI Settings

- **`aiCommitMessages`**: boolean (default: `true`)
  - Generate commit messages with AI

- **`aiCommitStyle`**: string (default: `conventional`)
  - Commit message style (conventional commits format)

- **`aiCommitMaxChars`**: number (default: `72`)
  - Maximum commit message length

### Smart Push Settings

- **`commitsBeforeSummary`**: number 2-10 (default: `3`)
  - How many commits before generating summary and asking to push

- **`autoSummaryAndPush`**: boolean (default: `true`)
  - Enable automatic summarization after N commits

### Other Settings

- **`defaultBranch`**: string (default: `main`)
- **`pushOnCommit`**: boolean (default: `false`)
  - Auto-push immediately after each commit (not recommended with smart summaries)

### Configuration Commands

```bash
gta config show                      # View all settings
gta config set autoMode auto         # Enable auto-commit
gta config set commitThreshold 30    # Change threshold
gta config set commitsBeforeSummary 5  # Summarize after 5 commits
gta config set aiProvider gemini     # Set AI provider
```

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Link globally for testing
npm link

# Unlink
npm unlink -g gta-cli
```

## Technology Stack

- **Commander.js** - CLI framework
- **Clack** - Interactive prompts
- **Execa** - Process execution
- **Conf** - Configuration management
- **Picocolors** - Terminal colors
- **Zod** - Schema validation

## License

MIT
