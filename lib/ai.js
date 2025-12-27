import { execa } from 'execa';
import { config } from './config.js';

/**
 * Generate text using configured AI provider
 */
export async function generateWithAI(prompt, options = {}) {
  const provider = config.get('aiProvider');
  const model = config.get('aiModel');

  if (provider === 'none') {
    throw new Error('AI provider not configured. Run: gta ai set-provider gemini');
  }

  try {
    switch (provider) {
      case 'gemini':
        return await generateWithGemini(prompt, model, options);
      case 'openai':
        return await generateWithOpenAI(prompt, model, options);
      case 'anthropic':
        return await generateWithAnthropic(prompt, model, options);
      case 'ollama':
        return await generateWithOllama(prompt, model, options);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (error) {
    throw new Error(`AI generation failed: ${error.message}`);
  }
}

/**
 * Generate using Gemini CLI
 */
async function generateWithGemini(prompt, model, options = {}) {
  try {
    // Check if gemini CLI is installed
    await execa('which', ['gemini']);
  } catch {
    const error = new Error('Gemini CLI not installed. Install: npm install -g @google/generative-ai-cli');
    error.cause = 'CLI not found in PATH';
    throw error;
  }

  // Build args - use positional argument for prompt (--prompt is deprecated)
  const args = [];

  if (model) {
    args.push('--model', model);
  }

  if (options.yolo) {
    args.push('--yolo');
  }

  args.push('--output-format', 'json');

  // Prompt goes last as positional argument
  args.push(prompt);

  try {
    const { stdout } = await execa('gemini', args);
    const response = JSON.parse(stdout);
    return response.response || response.text || stdout;
  } catch (error) {
    // Capture full error details
    const errorDetails = [];
    errorDetails.push(error.message);

    if (error.stderr) {
      errorDetails.push('STDERR: ' + error.stderr);
    }

    if (error.stdout) {
      errorDetails.push('STDOUT: ' + error.stdout);
    }

    const err = new Error(`Gemini API error - this might be an API key issue or rate limit`);
    err.cause = errorDetails.join('\n');
    throw err;
  }
}

/**
 * Generate using OpenAI CLI
 */
async function generateWithOpenAI(prompt, model, options = {}) {
  try {
    await execa('which', ['openai']);
  } catch {
    throw new Error('OpenAI CLI not installed');
  }

  const args = ['api', 'chat.completions.create', '-m', model || 'gpt-4', '-g', 'user', prompt];
  const { stdout } = await execa('openai', args);

  return stdout;
}

/**
 * Generate using Anthropic CLI
 */
async function generateWithAnthropic(prompt, model, options = {}) {
  try {
    await execa('which', ['anthropic']);
  } catch {
    throw new Error('Anthropic CLI not installed');
  }

  const args = ['messages', 'create', '--model', model || 'claude-3-5-sonnet-20241022', '--max-tokens', '1024', '--message', prompt];
  const { stdout } = await execa('anthropic', args);

  return stdout;
}

/**
 * Generate using Ollama
 */
async function generateWithOllama(prompt, model, options = {}) {
  try {
    await execa('which', ['ollama']);
  } catch {
    throw new Error('Ollama not installed');
  }

  const { stdout } = await execa('ollama', ['run', model || 'llama2', prompt]);

  return stdout;
}

/**
 * Generate commit message from git diff
 */
export async function generateCommitMessage() {
  const { execa: exec } = await import('execa');

  // Get git diff
  const { stdout: diff } = await exec('git', ['diff', '--cached']);

  if (!diff) {
    const { stdout: unstagedDiff } = await exec('git', ['diff']);
    if (!unstagedDiff) {
      throw new Error('No changes to commit');
    }
  }

  // Check for custom prompt in config
  const customPrompt = config.get('aiCommitPrompt');
  const context = `Changes:\n${diff.slice(0, 3000)}`;

  const prompt = customPrompt
    ? `${customPrompt}\n\n${context}`
    : `Generate a concise git commit message for these changes. Follow conventional commits format (type(scope): description).
Keep it under 72 characters. Only return the commit message, nothing else.

${context}`;

  const message = await generateWithAI(prompt, { yolo: true });

  // Clean up the response
  return message.trim().split('\n')[0].replace(/^["']|["']$/g, '');
}

/**
 * Generate branch name from description or diff
 */
export async function generateBranchName(description) {
  const customPrompt = config.get('aiBranchPrompt');

  const prompt = customPrompt
    ? `${customPrompt}\n\nDescription: ${description}`
    : `Generate a short, kebab-case git branch name for the following task description.
Rules:
- Use only lowercase letters, numbers, and hyphens
- Start with a type prefix if obvious (feature/, fix/, chore/)
- Keep it under 50 characters
- Return ONLY the branch name

Description: ${description}`;

  const branchName = await generateWithAI(prompt, { yolo: true });
  return branchName.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '-');
}

/**
 * Generate README.md content
 */
export async function generateReadme(projectName, context = '') {
  const prompt = `Generate a professional README.md file for a project named "${projectName}".
${context ? `Context: ${context}` : ''}

Include:
- Project title and brief description
- Getting Started section with installation and usage
- Basic project structure if applicable
- License (MIT)

Return only the markdown content, no explanations.`;

  const readme = await generateWithAI(prompt, { yolo: true });

  return readme.trim();
}

/**
 * Generate project description
 */
export async function generateProjectDescription(projectName, files = []) {
  const prompt = `Generate a brief one-sentence description for a project named "${projectName}"${files.length > 0 ? ` with files: ${files.join(', ')}` : ''}.
Keep it under 100 characters. Return only the description, nothing else.`;

  const description = await generateWithAI(prompt, { yolo: true });

  return description.trim().replace(/^["']|["']$/g, '');
}

/**
 * Summarize recent commits
 */
export async function summarizeCommits(commitCount = 3) {
  const { execa: exec } = await import('execa');

  // Get recent commits
  const { stdout: commits } = await exec('git', ['log', `-${commitCount}`, '--format=%h %s']);

  if (!commits) {
    throw new Error('No commits found');
  }

  const prompt = `Summarize these recent git commits in 2-3 sentences. Focus on what was changed and why it matters:

${commits}

Return only the summary, nothing else.`;

  const summary = await generateWithAI(prompt, { yolo: true });

  return summary.trim();
}
