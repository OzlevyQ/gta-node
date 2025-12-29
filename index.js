#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import { intro, outro } from '@clack/prompts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
//םזךקצ
// Middleware 
import { setupGhMiddleware } from './lib/gh-middleware.js';
// Commands
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';
import { gitCommand } from './commands/git.js';
import { githubCommand } from './commands/github.js';
import { aiCommand } from './commands/ai.js';
import { watchCommand } from './commands/watch.js';
import { tuiCommand } from './commands/tui.js';
import { projectCommand } from './commands/project.js';
import { addCommand } from './commands/add.js';
import { cloneCommand } from './commands/clone.js';
import { flowCommand } from './commands/flow.js';
import { webCommand } from './commands/web.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('gta')
  .description(pc.cyan('GTA - Git & Task Automation CLI'))
  .version(packageJson.version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help information');

// Setup GitHub CLI middleware
setupGhMiddleware(program);


// Register commands
initCommand(program);
statusCommand(program);
configCommand(program);
gitCommand(program);
githubCommand(program);
aiCommand(program);
watchCommand(program);
tuiCommand(program);
projectCommand(program);
addCommand(program);
cloneCommand(program);
flowCommand(program);
webCommand(program);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
