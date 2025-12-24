# GTA Examples

This directory contains usage examples for GTA CLI features.

## Available Examples

### `gh-checker-usage.js`

Demonstrates how to use the GitHub CLI checker module in your own commands.

**Run it:**
```bash
node examples/gh-checker-usage.js
```

**What it shows:**
- Example 1: Simple check - Quick `isGhReady()` check
- Example 2: Detailed check - Separate installation and authentication checks
- Example 3: System detection - OS and package manager detection
- Example 4: Full setup flow - Interactive setup with user prompts (commented out)
- Example 5: Custom command - How to integrate gh checking in your command
- Example 6: Graceful degradation - Fallback when gh is not available

**Interactive examples:**

To test the interactive examples (4, 5, 6), edit the file and uncomment them in the `main()` function:

```javascript
async function main() {
  // ...
  
  // Uncomment to test interactive examples:
  await example4_fullSetup();
  await example5_customCommand();
  await example6_gracefulDegradation();
  
  // ...
}
```

## Creating Your Own Examples

Feel free to add more examples to this directory. Follow this pattern:

```javascript
#!/usr/bin/env node

import { /* functions */ } from '../lib/module.js';
import pc from 'picocolors';

async function myExample() {
  console.log(pc.cyan('\\n━━━ My Example ━━━\\n'));
  
  // Your example code here
}

async function main() {
  await myExample();
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main().catch(console.error);
}

export { myExample };
```

## More Examples Coming Soon

- AI provider integration examples
- Git operations examples
- Configuration management examples
- Web interface customization examples

## Contributing

If you create useful examples, please consider contributing them back to the project!
