import { execa } from 'execa';
import { existsSync } from 'fs';
import { join } from 'path';

export class GitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitError';
  }
}

export async function isGitRepo() {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

export async function ensureGitRepo() {
  const isRepo = await isGitRepo();
  if (!isRepo) {
    throw new GitError('Not inside a git repository. Run "gta init" first.');
  }
}

export async function initGitRepo(defaultBranch = 'main') {
  const isRepo = await isGitRepo();
  if (isRepo) {
    return { alreadyExists: true };
  }

  await execa('git', ['init']);

  // Create initial README if doesn't exist
  if (!existsSync('README.md')) {
    const { writeFileSync } = await import('fs');
    writeFileSync('README.md', '# Project\n');
  }

  await execa('git', ['add', '-A']);
  await execa('git', ['commit', '-m', 'chore(init): initial commit']);
  await execa('git', ['branch', '-M', defaultBranch]);

  return { alreadyExists: false };
}

export async function getCurrentBranch() {
  const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return stdout.trim();
}

export async function hasChanges() {
  try {
    await execa('git', ['diff', '--quiet']);
    await execa('git', ['diff', '--cached', '--quiet']);
    return false;
  } catch {
    return true;
  }
}

export async function getChangeSize() {
  const { stdout } = await execa('git', ['diff', '--numstat']);
  const lines = stdout.split('\n').filter(Boolean);

  let total = 0;
  for (const line of lines) {
    const [added, deleted] = line.split('\t');
    total += parseInt(added || 0) + parseInt(deleted || 0);
  }

  return total;
}

export async function commitChanges(message) {
  await execa('git', ['add', '-A']);

  try {
    await execa('git', ['diff', '--cached', '--quiet']);
    return { committed: false, message: 'No changes to commit' };
  } catch {
    await execa('git', ['commit', '-m', message]);
    return { committed: true, message };
  }
}

export async function pushChanges(branch) {
  try {
    await execa('git', ['push', '-u', 'origin', branch]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getRemoteUrl() {
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin']);
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function setRemoteUrl(url) {
  const hasRemote = await getRemoteUrl();

  if (hasRemote) {
    await execa('git', ['remote', 'set-url', 'origin', url]);
  } else {
    await execa('git', ['remote', 'add', 'origin', url]);
  }
}

export async function createBranch(name) {
  await execa('git', ['checkout', '-b', name]);
}

export async function switchBranch(ref) {
  if (ref === 'prev') {
    await execa('git', ['checkout', 'HEAD~1']);
  } else if (ref === 'next') {
    await execa('git', ['checkout', '@{-1}']);
  } else {
    await execa('git', ['checkout', ref]);
  }
}

export async function listBranches() {
  const { stdout } = await execa('git', ['branch', '-a']);
  return stdout
    .split('\n')
    .map(b => b.trim().replace(/^\*\s*/, ''))
    .filter(b => b && !b.includes('->'))
    .map(b => b.replace(/^remotes\/origin\//, ''));
}

export async function getRepoPath() {
  const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
  return stdout.trim();
}

export async function getRepoName() {
  const path = await getRepoPath();
  return path.split('/').pop();
}

export async function getLog(count = 10) {
  const { stdout } = await execa('git', [
    'log',
    '--oneline',
    '--graph',
    '--decorate',
    `-n${count}`,
  ]);
  return stdout;
}

/**
 * Get count of unpushed commits
 */
export async function getUnpushedCommitsCount() {
  try {
    const branch = await getCurrentBranch();
    // Check if tracking branch exists
    await execa('git', ['rev-parse', `@{u}`]);

    const { stdout } = await execa('git', ['rev-list', '--count', `@{u}..HEAD`]);
    return parseInt(stdout.trim());
  } catch {
    // No upstream or error - return 0
    return 0;
  }
}

/**
 * Get list of unpushed commits
 */
export async function getUnpushedCommits() {
  try {
    const branch = await getCurrentBranch();
    await execa('git', ['rev-parse', `@{u}`]);

    const { stdout } = await execa('git', ['log', '--oneline', `@{u}..HEAD`]);
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
