/**
 * AI Workspace - Split screen with tmux (perfect cleanup)
 * Left: AI CLI (claude, codex, copilot, gemini)
 * Right: Live watch status panel
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import pc from 'picocolors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get AI CLI command
function getAICommand(aiType) {
  const commands = {
    'claude': 'claude',
    'codex': 'codex',
    'copilot': 'github-copilot-cli',
    'gemini': 'gemini'
  };

  return commands[aiType] || commands['gemini'];
}

// Check if tmux is available
async function hasTmux() {
  try {
    await execAsync('which tmux');
    return true;
  } catch {
    return false;
  }
}

// Launch AI workspace with tmux
export async function launchAIWorkspace(aiType) {
  // Check tmux
  if (!await hasTmux()) {
    console.log(pc.red('\n❌ tmux is required for split screen'));
    console.log(pc.yellow('   Install: brew install tmux\n'));
    return 1;
  }

  const cliCommand = getAICommand(aiType);
  const sessionName = `gta-ai-${Date.now()}`;
  const gtaTuiPath = join(__dirname, '..', 'scripts', 'gta-mini-tui.js');

  console.log(pc.cyan('\n🚀 Starting AI Workspace...'));
  console.log();
  console.log(pc.white('  ┌─────────────────────────────────────────────┐'));
  console.log(pc.white('  │  Left (70%):  AI CLI                        │'));
  console.log(pc.white('  │  Right (30%): GTA Control Panel             │'));
  console.log(pc.white('  └─────────────────────────────────────────────┘'));
  console.log();
  console.log(pc.yellow('  Controls:'));
  console.log(pc.dim('    • Ctrl+U - Switch between panes'));
  console.log(pc.dim('    • Ctrl+C - Clean exit to menu (ONE press!)'));
  console.log(pc.dim('    • exit or Ctrl+D - Also exits cleanly'));
  console.log();

  return new Promise((resolve) => {
    // Build tmux command with proper exit handling
    const tmuxCommands = [
      `tmux new-session -d -s ${sessionName} -x $(tput cols) -y $(tput lines)`,
      `tmux send-keys -t ${sessionName}:0.0 '${cliCommand}' C-m`,
      `tmux split-window -t ${sessionName} -h -p 30`,
      `tmux send-keys -t ${sessionName}:0.1 'node ${gtaTuiPath}' C-m`,
      `tmux select-pane -t ${sessionName}:0.0`,
      `tmux bind-key -n C-u select-pane -t ${sessionName}:.+`,
      `tmux bind-key -n C-c kill-session -t ${sessionName}`,
      `tmux attach-session -t ${sessionName}`
    ].join(' && ');

    const tmuxProcess = spawn('bash', ['-c', tmuxCommands], {
      stdio: 'inherit'
    });

    // Cleanup when tmux exits
    tmuxProcess.on('exit', async (code) => {
      // Force kill session if still exists
      try {
        await execAsync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
      } catch (e) {}

      console.log(pc.green('\n✓ Exited AI workspace cleanly\n'));
      resolve(code || 0);
    });

    tmuxProcess.on('error', (error) => {
      console.log(pc.red('\n❌ Failed to start tmux'));
      console.log(pc.yellow(`   Error: ${error.message}\n`));
      resolve(1);
    });

    // Handle process termination
    const cleanup = async () => {
      try {
        await execAsync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
      } catch (e) {}
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}
