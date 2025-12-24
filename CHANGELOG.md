# Changelog

All notable changes to GTA CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-12-24

### Added

#### GitHub CLI Auto-Setup System
- **Automatic Detection**: GTA now automatically detects if GitHub CLI (`gh`) is installed before running commands that require it
- **Smart Installation**: Offers to install `gh` using the appropriate package manager for your OS:
  - macOS: `brew install gh` (with Homebrew detection)
  - Linux: Distribution-specific commands (apt, dnf, pacman)
  - Windows: `winget install --id GitHub.cli`
- **Enhanced Visual Flow**: Complete visibility of installation and authentication process
  - Step-by-step progress indicators (Step 1/2, Step 2/2)
  - Real-time output from package managers during installation
  - Full authentication flow with browser instructions
  - Verification after each step
  - Beautiful success summary with visual borders
- **Authentication Flow**: Guides users through GitHub authentication if not already logged in
- **Enhanced Status Display**: `gta status` now shows detailed GitHub CLI installation and authentication status
- **Cross-Platform Support**: Works seamlessly on macOS, Linux, and Windows

#### New Modules
- `lib/gh-checker.js`: Core GitHub CLI detection and setup functionality
  - `isGhInstalled()`: Check if gh is installed
  - `isGhAuthenticated()`: Check authentication status
  - `detectSystem()`: Detect OS and installation method
  - `installGh()`: Install GitHub CLI
  - `authenticateGh()`: Guide through authentication
  - `ensureGhSetup()`: Complete setup flow
  - `isGhReady()`: Quick check without prompts

- `lib/gh-middleware.js`: Commander.js middleware for automatic gh checking
  - Hooks into `preAction` to check before command execution
  - **Blacklist approach**: All commands check gh by default, except those explicitly skipped
  - Only need to maintain a skip list for commands that don't need gh

#### Documentation
- `GITHUB-CLI-SETUP.md`: Comprehensive technical documentation
  - Architecture overview
  - API reference
  - Usage examples
  - Troubleshooting guide
  
- `examples/gh-checker-usage.js`: Runnable code examples
  - 6 different usage patterns
  - Demonstrates all API functions
  
- `IMPLEMENTATION-SUMMARY-HE.md`: Hebrew implementation summary
  - Complete feature description
  - Technical details
  - Testing guide

### Changed

#### Enhanced Commands
- **All commands**: Now check for GitHub CLI by default (except config, status, watch, git, ai, tui, web)
- **`gta status`**: Displays GitHub CLI installation and authentication status with actionable messages
- **`gta add`**: Automatically checks for GitHub CLI before attempting to create repository
- **`gta github`**: Ensures gh is available before GitHub operations
- **`gta project`**: Validates gh setup before project scaffolding
- **`gta init`**: Checks gh when creating remote repositories
- **Any new command**: Automatically gets gh checking without code changes

#### Updated Documentation
- `README.md`: Added GitHub CLI Auto-Setup feature to features list and quick start guide
- Enhanced quick start section with automatic setup workflow examples

### Technical Details

#### Dependencies
- No new dependencies added (uses existing: execa, @clack/prompts, picocolors)

#### Architecture
- Middleware pattern using Commander.js hooks
- Modular design with separation of concerns
- Async/await throughout for better error handling
- Cross-platform OS detection

#### Performance
- Fast checks (< 100ms)
- Lazy loading of modules
- No blocking operations
- Efficient caching of system information

### Migration Guide

No breaking changes. The new feature works automatically:

1. Update to version 2.1.0
2. Run any command that requires GitHub CLI (e.g., `gta add`)
3. Follow the prompts if gh is not installed/authenticated

Existing workflows continue to work without modification.

### Known Issues

None at this time.

### Future Enhancements

Planned for future releases:
- Silent mode for CI/CD environments
- Version checking for minimum gh version
- Auto-update suggestions for old gh versions
- Enterprise GitHub support
- Authentication status caching

---

## [2.0.0] - Previous Release

### Features
- Modern Node.js CLI with Commander.js
- Beautiful Clack prompts interface
- AI-powered commit messages with Gemini
- Smart commit summaries
- Web interface
- Auto-commit and watch mode
- GitHub integration
- Project scaffolding

---

## How to Update

```bash
cd /Users/mymac/code/gg/gta-node
git pull
npm install
npm link
```

Verify the update:
```bash
gta --version  # Should show 2.1.0
gta status     # Should show GitHub CLI status
```
