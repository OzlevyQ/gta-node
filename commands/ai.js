export function aiCommand(program) {
  const aiCmd = program.command('ai').description('AI provider configuration');

  aiCmd
    .command('set-provider')
    .argument('<provider>', 'AI provider (openai/ollama/anthropic/gemini/none)')
    .action((provider) => {
      console.log(`Setting AI provider to: ${provider}`);
      // Implementation coming soon
    });
}
