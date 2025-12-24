export function githubCommand(program) {
  const ghCmd = program.command('github').alias('gh').description('GitHub operations');

  ghCmd
    .command('connect')
    .description('Connect to GitHub remote')
    .action(() => {
      console.log('Use: gta tui for interactive GitHub setup');
    });
}
