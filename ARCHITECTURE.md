# GitHub CLI Auto-Setup Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         GTA CLI (index.js)                      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Commander.js Program Setup                   │ │
│  │                                                           │ │
│  │  1. Initialize program                                   │ │
│  │  2. Register middleware: setupGhMiddleware(program)      │ │
│  │  3. Register commands (add, github, project, etc.)       │ │
│  │  4. Parse arguments                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Middleware (gh-middleware.js)                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              preAction Hook                               │ │
│  │                                                           │ │
│  │  • Check command name                                    │ │
│  │  • Skip if in COMMANDS_SKIP_GH_CHECK                     │ │
│  │  • If in COMMANDS_REQUIRING_GH:                          │ │
│  │    → Call ensureGhSetup()                                │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Core Module (gh-checker.js)                   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Detection       │  │  Installation    │  │  Auth        │ │
│  │                  │  │                  │  │              │ │
│  │ isGhInstalled()  │  │ detectSystem()   │  │ authenticateGh()│
│  │ isGhAuthenticated│  │ installGh()      │  │              │ │
│  │ isGhReady()      │  │                  │  │              │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              ensureGhSetup() - Main Flow                  │ │
│  │                                                           │ │
│  │  1. Check if gh installed → Prompt to install if not     │ │
│  │  2. Check if authenticated → Prompt to auth if not       │ │
│  │  3. Return true if ready, false otherwise                │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    External Dependencies                        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  execa   │  │  @clack  │  │picocolors│  │  Node.js os  │  │
│  │          │  │ /prompts │  │          │  │              │  │
│  │ Process  │  │ User     │  │ Terminal │  │ OS Detection │  │
│  │ Execution│  │ Prompts  │  │ Colors   │  │              │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Flow Diagram: User Runs Command

```
┌─────────────────────────────────────────────────────────────────┐
│                    User runs: gta add                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Middleware: preAction hook triggered               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │ Command = "add" │
                    └─────────────────┘
                              ↓
              ┌───────────────────────────────┐
              │ Is "add" in REQUIRING list?   │
              └───────────────────────────────┘
                      Yes ↓         ↓ No
              ┌──────────────┐     │
              │ ensureGhSetup│     │
              └──────────────┘     │
                      ↓             │
        ┌─────────────────────┐    │
        │ isGhInstalled()?    │    │
        └─────────────────────┘    │
            Yes ↓     ↓ No         │
                │     │             │
                │  ┌──────────────────────────┐
                │  │ ⚠ gh not installed      │
                │  │ Prompt: Install?        │
                │  └──────────────────────────┘
                │     Yes ↓     ↓ No
                │  ┌──────────┐ │
                │  │detectSys │ │
                │  │tem()     │ │
                │  └──────────┘ │
                │       ↓        │
                │  ┌──────────┐ │
                │  │installGh │ │
                │  │()        │ │
                │  └──────────┘ │
                │       ↓        │
                └───────┴────────┘
                        ↓
        ┌─────────────────────────┐
        │ isGhAuthenticated()?    │
        └─────────────────────────┘
            Yes ↓     ↓ No
                │     │
                │  ┌──────────────────────────┐
                │  │ ⚠ Not authenticated     │
                │  │ Prompt: Authenticate?   │
                │  └──────────────────────────┘
                │     Yes ↓     ↓ No
                │  ┌──────────┐ │
                │  │authenticate│
                │  │Gh()      │ │
                │  └──────────┘ │
                │       ↓        │
                └───────┴────────┘
                        ↓
                ┌───────────────┐
                │ Return status │
                └───────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              Execute original command (gta add)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Module Dependencies

```
index.js
  ├── lib/gh-middleware.js
  │     └── lib/gh-checker.js
  │           ├── execa
  │           ├── @clack/prompts
  │           ├── picocolors
  │           └── os (Node.js)
  │
  ├── commands/status.js
  │     └── lib/gh-checker.js
  │
  └── commands/add.js
        └── (uses gh via middleware)
```

## Data Flow: Installation Process

```
┌─────────────────────────────────────────────────────────────────┐
│                      detectSystem()                             │
│                                                                 │
│  Input: None                                                    │
│  Process:                                                       │
│    1. os.platform() → "darwin" | "linux" | "win32"             │
│    2. os.arch() → "x64" | "arm64" | etc.                       │
│    3. Detect Linux distribution (if applicable)                │
│  Output:                                                        │
│    {                                                            │
│      name: "macOS",                                             │
│      installCommand: "brew install gh",                         │
│      packageManager: "Homebrew",                                │
│      requiresHomebrew: true                                     │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      installGh()                                │
│                                                                 │
│  Input: system info from detectSystem()                        │
│  Process:                                                       │
│    1. Check prerequisites (e.g., Homebrew on macOS)            │
│    2. Show spinner: "Installing..."                            │
│    3. Parse installCommand: "brew install gh"                  │
│       → command = "brew"                                        │
│       → args = ["install", "gh"]                               │
│    4. Execute: execa(command, args, {stdio: 'inherit'})        │
│    5. Handle success/failure                                   │
│  Output: true (success) | false (failure)                      │
└─────────────────────────────────────────────────────────────────┘
```

## State Machine: Setup Process

```
                    ┌─────────────┐
                    │   START     │
                    └─────────────┘
                          ↓
                    ┌─────────────┐
                    │  CHECK_GH   │
                    └─────────────┘
                     ↙           ↘
            ┌──────────┐      ┌──────────┐
            │INSTALLED │      │NOT_INST  │
            └──────────┘      └──────────┘
                 ↓                  ↓
                 │            ┌──────────┐
                 │            │PROMPT_   │
                 │            │INSTALL   │
                 │            └──────────┘
                 │              ↙      ↘
                 │      ┌──────┐    ┌──────┐
                 │      │ACCEPT│    │REJECT│
                 │      └──────┘    └──────┘
                 │          ↓           ↓
                 │      ┌──────┐    ┌──────┐
                 │      │INSTAL│    │FAILED│
                 │      │LING  │    └──────┘
                 │      └──────┘        ↓
                 │          ↓           ↓
                 └──────────┴───────────┘
                          ↓
                    ┌─────────────┐
                    │ CHECK_AUTH  │
                    └─────────────┘
                     ↙           ↘
            ┌──────────┐      ┌──────────┐
            │AUTHENTIC │      │NOT_AUTH  │
            │ATED      │      └──────────┘
            └──────────┘            ↓
                 ↓            ┌──────────┐
                 │            │PROMPT_   │
                 │            │AUTH      │
                 │            └──────────┘
                 │              ↙      ↘
                 │      ┌──────┐    ┌──────┐
                 │      │ACCEPT│    │REJECT│
                 │      └──────┘    └──────┘
                 │          ↓           ↓
                 │      ┌──────┐    ┌──────┐
                 │      │AUTH  │    │FAILED│
                 │      │ING   │    └──────┘
                 │      └──────┘        ↓
                 │          ↓           ↓
                 └──────────┴───────────┘
                          ↓
                    ┌─────────────┐
                    │   READY     │
                    └─────────────┘
```

## Component Interaction Timeline

```
Time →

User        Middleware      gh-checker      execa       @clack      System
 │              │               │             │            │           │
 │─ gta add ───→│               │             │            │           │
 │              │               │             │            │           │
 │              │─ preAction ──→│             │            │           │
 │              │               │             │            │           │
 │              │               │─ isGhInstalled() ───────→│           │
 │              │               │             │            │           │
 │              │               │             │←─ gh --version ───────→│
 │              │               │             │            │           │
 │              │               │←─ false ────│            │           │
 │              │               │             │            │           │
 │              │               │─ confirm() ─────────────→│           │
 │              │               │             │            │           │
 │←─────────────────────────────────── Prompt ────────────│           │
 │              │               │             │            │           │
 │─ Yes ───────────────────────────────────────────────────→│          │
 │              │               │             │            │           │
 │              │               │─ detectSystem() ─────────────────────→│
 │              │               │             │            │           │
 │              │               │←─ {macOS, brew...} ──────────────────│
 │              │               │             │            │           │
 │              │               │─ installGh() ───────────→│           │
 │              │               │             │            │           │
 │              │               │             │←─ brew install gh ─────→│
 │              │               │             │            │           │
 │              │               │←─ success ──│            │           │
 │              │               │             │            │           │
 │              │               │─ isGhAuthenticated() ────→│           │
 │              │               │             │            │           │
 │              │               │             │←─ gh auth status ──────→│
 │              │               │             │            │           │
 │              │               │←─ false ────│            │           │
 │              │               │             │            │           │
 │              │               │─ confirm() ─────────────→│           │
 │              │               │             │            │           │
 │←─────────────────────────────────── Prompt ────────────│           │
 │              │               │             │            │           │
 │─ Yes ───────────────────────────────────────────────────→│          │
 │              │               │             │            │           │
 │              │               │─ authenticateGh() ───────→│           │
 │              │               │             │            │           │
 │              │               │             │←─ gh auth login ───────→│
 │              │               │             │            │           │
 │              │               │←─ success ──│            │           │
 │              │               │             │            │           │
 │              │←─ true ───────│             │            │           │
 │              │               │             │            │           │
 │              │─ continue ────→             │            │           │
 │              │               │             │            │           │
 │←─ execute add command ───────│             │            │           │
```

## File Structure

```
gta-node/
├── index.js                    # Entry point + middleware setup
├── lib/
│   ├── gh-checker.js          # Core GitHub CLI module
│   ├── gh-middleware.js       # Commander.js middleware
│   ├── config.js              # Configuration
│   ├── git.js                 # Git operations
│   ├── ai.js                  # AI integration
│   └── logger.js              # Logging
├── commands/
│   ├── add.js                 # Uses gh via middleware
│   ├── github.js              # Uses gh via middleware
│   ├── project.js             # Uses gh via middleware
│   ├── init.js                # Uses gh via middleware
│   └── status.js              # Shows gh status
├── examples/
│   ├── gh-checker-usage.js    # Usage examples
│   └── README.md              # Examples guide
└── docs/
    ├── GITHUB-CLI-SETUP.md    # Technical docs
    ├── IMPLEMENTATION-SUMMARY-HE.md
    ├── CHANGELOG.md
    └── QUICK-SUMMARY.md
```
