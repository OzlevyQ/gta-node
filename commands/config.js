import pc from 'picocolors';
import { select, text } from '@clack/prompts';
import { config } from '../lib/config.js';

export function configCommand(program) {
  const configCmd = program
    .command('config')
    .description('Manage GTA configuration');

  configCmd
    .command('show')
    .description('Show all configuration values')
    .action(() => {
      const cfg = config.getAll();
      console.log(pc.cyan('\n━━━ GTA Configuration ━━━\n'));

      for (const [key, value] of Object.entries(cfg)) {
        console.log(`  ${pc.blue(key.padEnd(20))} ${pc.green(String(value))}`);
      }

      console.log(pc.dim(`\nConfig file: ${config.getPath()}\n`));
    });

  configCmd
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key')
    .action((key) => {
      const value = config.get(key);
      if (value === undefined) {
        console.log(pc.red(`Key "${key}" not found`));
        process.exit(1);
      }
      console.log(value);
    });

  configCmd
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action((key, value) => {
      // Parse boolean values
      let parsedValue = value;
      if (value === 'true') parsedValue = true;
      if (value === 'false') parsedValue = false;
      if (!isNaN(value)) parsedValue = Number(value);

      config.set(key, parsedValue);
      console.log(pc.green(`✓ Set ${key} = ${parsedValue}`));
    });

  configCmd
    .command('edit')
    .description('Edit configuration file')
    .action(() => {
      console.log(pc.cyan(`Config file: ${config.getPath()}`));
      console.log(pc.dim('Open this file in your editor to make changes.'));
    });

  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .action(() => {
      config.reset();
      console.log(pc.green('✓ Configuration reset to defaults'));
    });
}
