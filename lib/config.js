import Conf from 'conf';
import { z } from 'zod';

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
};

class GTAConfig {
  constructor() {
    this.config = new Conf({
      projectName: 'gta',
      schema: confSchema,
    });
  }

  get(key) {
    return this.config.get(key);
  }

  set(key, value) {
    this.config.set(key, value);
  }

  getAll() {
    return this.config.store;
  }

  validate() {
    try {
      configSchema.parse(this.config.store);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  reset() {
    this.config.clear();
  }

  getPath() {
    return this.config.path;
  }
}

export const config = new GTAConfig();
