export function gitCommand(program) {
  const gitCmd = program.command('git').description('Git operations');

  gitCmd
    .command('switch')
    .argument('<ref>', 'Branch, commit, or prev/next')
    .action((ref) => {
      console.log(`Switching to: ${ref}`);
      // Implementation in TUI
    });

  gitCmd
    .command('branch')
    .description('List or create branches')
    .action(() => {
      console.log('Use: gta tui for interactive branch management');
    });
}
