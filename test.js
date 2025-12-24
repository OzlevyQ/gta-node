import blessed from 'blessed';
import { spawn } from 'child_process';
import picocolors from 'picocolors';

const screen = blessed.screen({
  smartCSR: true,
  mouse: true,
  title: 'Gemini Pro Terminal Dashboard',
  fullUnicode: true,
  // זה מאפשר ל-Ctrl+C לעבוד אם לא הגדרנו לו משהו אחר
  sendFocus: true 
});

// --- עיצוב ממשק (Layout) ---

const leftBox = blessed.log({
  parent: screen,
  top: 0,
  left: 0,
  width: '50%',
  height: '90%',
  label: ' {bold}{cyan-fg} 🤖 Gemini AI Output {/cyan-fg}{/bold} ',
  border: { type: 'line' },
  scrollable: true,
  alwaysScroll: true,
  mouse: true, // מאפשר גלילה עם הגלגלת של העכבר
  scrollbar: { ch: ' ', track: { bg: 'cyan' }, style: { inverse: true } },
  tags: true,
  style: { border: { fg: 'cyan' } }
});

const inputBar = blessed.textbox({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '50%',
  height: 3,
  label: ' {bold}{yellow-fg} ⌨️ Ask Anything {/yellow-fg}{/bold} ',
  border: { type: 'line' },
  inputOnFocus: true,
  style: { border: { fg: 'yellow' }, focus: { border: { fg: 'white' } } }
});

const rightBox = blessed.log({
  parent: screen,
  top: 0,
  left: '50%',
  width: '50%',
  height: '100%',
  label: ' {bold} 📋 System Activity {/bold} ',
  border: { type: 'line' },
  scrollable: true,
  mouse: true,
  scrollbar: { ch: ' ', track: { bg: 'white' }, style: { inverse: true } },
  tags: true,
  style: { border: { fg: 'white' } }
});

// --- פונקציות ליבה ---

function runGemini(prompt) {
  leftBox.log(picocolors.bold(picocolors.cyan('You: ')) + prompt);
  leftBox.log(picocolors.gray('─'.repeat(30)));

  // הרצת הפקודה ב-Shell
  const child = spawn('gemini', [prompt], { shell: true });

  child.stdout.on('data', (data) => {
    leftBox.log(data.toString().trim());
  });

  child.stderr.on('data', (data) => {
    leftBox.log(picocolors.red('⚠️ Error: ') + data.toString());
  });

  child.on('close', () => {
    leftBox.log(picocolors.gray('─'.repeat(30)));
    screen.render();
  });
}

// --- ניהול אירועים ומקלדת ---

// שליחת קלט
inputBar.on('submit', (value) => {
  if (value.trim()) {
    runGemini(value);
    inputBar.clearValue();
  }
  inputBar.focus();
  screen.render();
});

// תיקון ויציאה: הגדרת Ctrl+C ידנית
screen.key(['C-c'], () => {
  return process.exit(0);
});

// מעבר פוקוס מהיר ב-TAB
screen.key(['tab'], () => {
  if (screen.focused === inputBar) {
    rightBox.focus();
  } else {
    inputBar.focus();
  }
  screen.render();
});

// אתחול
rightBox.log(picocolors.green('✔ System Online'));
rightBox.log(picocolors.gray(`Node.js Version: ${process.version}`));
rightBox.log(picocolors.gray(`Platform: ${process.platform} (${process.arch})`));

inputBar.focus();
screen.render();