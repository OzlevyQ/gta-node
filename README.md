# 🚀 GTA 2.1 — Git & Task Automation CLI

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg?style=for-the-badge)](https://github.com/OzlevyQ/gta-node)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-orange.svg?style=for-the-badge)](https://nodejs.org/)
[![AI](https://img.shields.io/badge/AI-Powered-purple.svg?style=for-the-badge)](https://ai.google.dev/)

**GTA** is a premium, all-in-one Git automation suite built for developers who want to stay in the flow. It combines a beautiful TUI, a high-performance Web Dashboard, and intelligent AI automation to handle your boilerplate Git tasks effortlessly.

---

## ✨ Features that Wow

*   🎨 **Modern TUI & UI**: Built with Clack prompts for a premium terminal experience.
*   🤖 **AI-Driven Workflow**: Intelligent commit messages and change summaries powered by **Gemini 2.0**.
*   🌐 **Web Dashboard**: A lightweight, real-time web interface to manage your repositories from the browser.
*   📦 **Auto-Setup System**: Intelligent detection and installation of **GitHub CLI** across all platforms.
*   🔄 **Smart Automation**: Auto-commit when you're ready, with threshold-based logic and batched summaries.
*   🚀 **One-Command Setup**: `gta add` turns any folder into a GitHub-connected repository in seconds.
*   💻 **Zero-Bloat**: Built with vanilla technologies. No heavy frameworks, just pure performance.

---

## 📦 Installation

GTA is designed to work seamlessly on **macOS**, **Linux**, and **Windows**.

### 1. Prerequisite: Node.js
Ensure you have **Node.js v18** or newer installed.

### 2. Install GTA from Source
```bash
git clone https://github.com/OzlevyQ/gta-node.git
cd gta-node
npm install
npm link
```

### 3. Optional Enhancements
GTA works best with these tools (though it can install `gh` for you):
*   **GitHub CLI (`gh`)**: For repository automation.
*   **fzf**: For enhanced fuzzy finding in the terminal.

---

## 🌍 Platform Specifics

| Platform | Recommended Setup | Command |
| :--- | :--- | :--- |
| **🍏 macOS** | Homebrew | `brew install node gh fzf` |
| **🐧 Linux** | Native PM | `sudo apt/dnf/pacman -S nodejs gh fzf` |
| **🪟 Windows** | Winget | `winget install OpenJS.NodeJS GitHub.cli` |

---

## 🚦 Quick Start

### 🤖 Step 1: Initialize AI (Gemini)
GTA uses Gemini AI for generating commit messages. It's fast, free, and smart.
```bash
# Install the Google AI CLI
npm install -g @google/generative-ai-cli

# Login to your account
gemini auth login
```

### 🔐 Step 2: Automatic GitHub CLI Setup
Just run any command that interacts with GitHub. GTA will detect if you have `gh` and guide you through a **full visual installation**:

```bash
gta add
```

**What happens next?**
1.  🔍 GTA detects your OS and missing tools.
2.  🛠️ Offers to install `gh` via `brew`, `apt`, `dnf`, `pacman`, or `winget`.
3.  🔄 Shows **real-time installation progress** in your terminal.
4.  🔐 Guides you through the browser-based OAuth login.
5.  ✅ Verifies everything and continues your command.

---

## 🛠️ Core Commands

### 🚀 `gta add` — The Magic Command
The fastest way to take a project online.
*   🤖 AI generates project description & README.
*   📁 Creates `.gitignore`.
*   🔧 Initializes Git.
*   🤖 AI generates the initial commit message.
*   🌐 Creates a GitHub repository (Public/Private).
*   🚀 Pushes everything.

### 📊 `gta status` — The Command Center
Shows "everything" in one view:
*   **Git Status**: Branch, changes, sync state.
*   **Automation**: Mode, thresholds, summaries.
*   **AI**: Provider status and current model.
*   **System**: Tool paths and versions.

### ⌚ `gta watch` — The Invisible Assistant
Monitors your work in the background.
1.  Watches for changes (default: every 3s).
2.  Creates an AI-powered commit after **20 lines** of change.
3.  After **3 commits**, it summarizes everything and asks: *"Push these 3 changes to remote?"*

### 🎮 `gta tui` — The Command Deck
A full-screen interactive interface for everything. Navigate with arrows, manage with ease.

### 🌐 `gta web` — The Global Dashboard
Launches a modern web interface on `localhost:3000`. Perfect for developers who prefer a visual overview.

---

## ⚙️ Configuration

Configuration is stored in `~/.config/gta/config.json`. You can manage it via CLI:

```bash
gta config show          # See everything
gta config set autoMode manual  # Change automation style
gta config set commitThreshold 50 # Be less aggressive with commits
```

| Key | Default | Description |
| :--- | :--- | :--- |
| `autoMode` | `auto` | `manual` \| `confirm` \| `auto` |
| `commitThreshold` | `20` | Lines changed before a commit |
| `commitsBeforeSummary` | `3` | Number of commits before a push prompt |
| `aiProvider` | `gemini` | AI engine used for messages |

---

## 🧪 Testing the Setup Flow

We've built a dedicated tool to test the GitHub CLI setup without affecting your projects:

```bash
node test-gh-setup.js
```

---

## 🛠️ Tech Stack

*   **Commander.js**: Robust CLI framework.
*   **Clack**: Next-gen interactive prompts.
*   **Execa**: High-performance process execution.
*   **Conf + Zod**: Type-safe configuration management.
*   **Vanilla Web**: Lightweight HTML/JS dashboard with zero framework overhead.

---

## 📄 License
GTA 2.1 is open-source software licensed under the **MIT License**.

---

<p align="center">
  Built with ❤️ by the GTA Team. 
  <br>
  <i>"Automate the boring, focus on the code."</i>
</p>
