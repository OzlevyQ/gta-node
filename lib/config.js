import Conf from 'conf';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execaSync } from 'execa';

// Configuration schema for validation
const configSchema = z.object({
  autoMode: z.enum(['manual', 'confirm', 'auto']).default('auto'),
  commitThreshold: z.number().min(1).default(20),
  aiProvider: z.enum(['gemini', 'openai', 'ollama', 'anthropic', 'none']).default('gemini'),
  aiModel: z.string().optional(),
  defaultBranch: z.string().default('main'),
  pushOnCommit: z.boolean().default(false),
  aiCommitMessages: z.boolean().default(true),
  aiCommitMaxChars: z.number().default(72),
  aiCommitStyle: z.string().default('conventional'),
  commitsBeforeSummary: z.number().min(2).max(10).default(3),
  autoSummaryAndPush: z.boolean().default(true),
  // New Enterprise Fields
  aiCommitPrompt: z.string().optional(),
  aiBranchPrompt: z.string().optional(),
  workflowPrefixes: z.object({
    feature: z.string().default('feature/'),
    fix: z.string().default('fix/'),
    hotfix: z.string().default('hotfix/'),
    chore: z.string().default('chore/'),
  }).default({
    feature: 'feature/',
    fix: 'fix/',
    hotfix: 'hotfix/',
    chore: 'chore/',
  }),
});

// Conf schema (JSON Schema format)
const confSchema = {
  autoMode: {
    type: 'string',
    enum: ['manual', 'confirm', 'auto'],
    default: 'auto',
  },
  commitThreshold: {
    type: 'number',
    minimum: 1,
    default: 20,
  },
  aiProvider: {
    type: 'string',
    enum: ['gemini', 'openai', 'ollama', 'anthropic', 'none'],
    default: 'gemini',
  },
  aiModel: {
    type: 'string',
    default: 'gemini-2.0-flash-exp',
  },
  defaultBranch: {
    type: 'string',
    default: 'main',
  },
  pushOnCommit: {
    type: 'boolean',
    default: false,
  },
  aiCommitMessages: {
    type: 'boolean',
    default: true,
  },
  aiCommitMaxChars: {
    type: 'number',
    default: 72,
  },
  aiCommitStyle: {
    type: 'string',
    default: 'conventional',
  },
  commitsBeforeSummary: {
    type: 'number',
    minimum: 2,
    maximum: 10,
    default: 3,
  },
  autoSummaryAndPush: {
    type: 'boolean',
    default: true,
  },
  aiCommitPrompt: {
    type: 'string',
  },
  aiBranchPrompt: {
    type: 'string',
  },
  workflowPrefixes: {
    type: 'object',
    properties: {
      feature: { type: 'string', default: 'feature/' },
      fix: { type: 'string', default: 'fix/' },
      hotfix: { type: 'string', default: 'hotfix/' },
      chore: { type: 'string', default: 'chore/' },
    },
    default: {
      feature: 'feature/',
      fix: 'fix/',
      hotfix: 'hotfix/',
      chore: 'chore/',
    },
  },
};

class GTAConfig {
  constructor() {
    this.globalConfig = new Conf({
      projectName: 'gta',
      schema: confSchema,
    });
    this.localConfig = {};
    this.loadLocalConfig();
  }

  loadLocalConfig() {
    try {
      // Try to find git root
      const { stdout: gitRoot } = execaSync('git', ['rev-parse', '--show-toplevel'], { reject: false });

      const searchPaths = [
        process.cwd(),
        gitRoot
      ].filter(Boolean);

      // Unique paths
      const uniquePaths = [...new Set(searchPaths)];

      for (const basePath of uniquePaths) {
        const configPath = join(basePath, '.gta', 'config.json');
        if (existsSync(configPath)) {
          const content = readFileSync(configPath, 'utf8');
          try {
            const parsed = JSON.parse(content);
            this.localConfig = { ...this.localConfig, ...parsed };
          } catch (e) {
            // Ignore invalid json
          }
        }
      }
    } catch (e) {
      // Ignore errors finding git root
    }
  }

  get(key) {
    // Check local config first
    if (key in this.localConfig) {
      return this.localConfig[key];
    }
    return this.globalConfig.get(key);
  }

  set(key, value) {
    // Set strictly sets to global config
    this.globalConfig.set(key, value);
  }

  getAll() {
    return {
      ...this.globalConfig.store,
      ...this.localConfig,
    };
  }

  validate() {
    try {
      configSchema.parse(this.getAll());
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  reset() {
    this.globalConfig.clear();
  }

  getPath() {
    return this.globalConfig.path;
  }
}

export const config = new GTAConfig();
