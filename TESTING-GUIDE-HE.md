# מדריך בדיקה - GitHub CLI Setup

## איך לבדוק את התהליך?

### בדיקה מהירה

```bash
node test-gh-setup.js
```

הסקריפט יבדוק ויציג את כל התהליך של התקנה ואימות.

## למה `node index.js` לא עובד?

כשמריצים `node index.js` בלי ארגומנטים, Commander.js מציג את תפריט העזרה ויוצא. זו התנהגות תקינה.

**כדי לראות את תהליך ההתקנה**, צריך להריץ פקודה שדורשת GitHub CLI:

```bash
# דוגמאות לפקודות שיפעילו את תהליך ההתקנה:
gta add
gta github
gta project
gta init
```

## תרחישי בדיקה

### תרחיש 1: התקנה מאפס (gh לא מותקן)

אם GitHub CLI כבר מותקן, אפשר לבדוק זמנית:

```bash
# בדוק אם מותקן
which gh

# שמור זמנית (macOS/Linux)
sudo mv /usr/local/bin/gh /usr/local/bin/gh.backup

# הרץ בדיקה
node test-gh-setup.js

# תראה:
# ✓ בדיקת מערכת
# ✓ הצעה להתקנה
# ✓ כל פלט Homebrew/apt/winget
# ✓ אימות התקנה
# ✓ תהליך אימות מלא
# ✓ סיכום הצלחה

# החזר את gh
sudo mv /usr/local/bin/gh.backup /usr/local/bin/gh
```

### תרחיש 2: מותקן אבל לא מחובר

```bash
# התנתק מ-GitHub
gh auth logout

# הרץ בדיקה
node test-gh-setup.js

# תראה:
# ✓ דילוג על התקנה (כבר מותקן)
# ✓ הצעה להתחבר
# ✓ תהליך אימות מלא
# ✓ סיכום הצלחה
```

### תרחיש 3: הכל כבר מוגדר

```bash
# הרץ בדיקה
node test-gh-setup.js

# תראה:
# ✓ הודעה שהכל כבר מוגדר
# ✓ הוראות איך לבדוק את התהליך
```

## בדיקה עם פקודות אמיתיות

אחרי שבדקת את התהליך, נסה עם פקודות GTA אמיתיות:

```bash
# זה יפעיל בדיקת gh לפני הרצה
gta add

# אם gh לא מוכן, תראה את כל התהליך
# ואז הפקודה תמשיך
```

## מה אמור לקרות?

### תהליך מלא:

1. **כותרת יפה**
   ```
   ╔═══════════════════════════════════════════════════════════╗
   ║           GitHub CLI Setup & Configuration            ║
   ╚═══════════════════════════════════════════════════════════╝
   ```

2. **שלב 1: בדיקת התקנה**
   ```
   Step 1/2: Checking GitHub CLI installation...
   ```

3. **אם לא מותקן - תהליך התקנה מלא**
   ```
   ━━━ GitHub CLI Installation ━━━
   System: macOS
   Package Manager: Homebrew
   
   [כל הפלט של Homebrew מוצג כאן...]
   
   ✓ GitHub CLI installed successfully!
   ```

4. **שלב 2: בדיקת אימות**
   ```
   Step 2/2: Checking GitHub authentication...
   ```

5. **אם לא מחובר - תהליך אימות מלא**
   ```
   ━━━ GitHub Authentication ━━━
   
   [הדפדפן נפתח, תהליך OAuth...]
   
   ✓ Successfully authenticated with GitHub!
   ```

6. **סיכום הצלחה**
   ```
   ╔═══════════════════════════════════════════════════════════╗
   ║              ✓ Setup Complete!                         ║
   ╚═══════════════════════════════════════════════════════════╝
   ```

## למה זה אינטראקטיבי?

הסקריפט **מחכה לתשובות שלך**:

- `Would you like to install GitHub CLI now?` → ענה Yes/No
- `Would you like to authenticate with GitHub now?` → ענה Yes/No
- במהלך האימות הדפדפן ייפתח ותצטרך לאשר

## איך להריץ בטרמינל?

אם אתה רוצה לראות את התהליך המלא:

```bash
# פתח טרמינל רגיל (לא דרך IDE)
cd /Users/mymac/code/gg/gta-node

# הרץ את הבדיקה
node test-gh-setup.js

# או הרץ פקודה אמיתית
gta add
```

## פתרון בעיות

### "gh: command not found" אחרי התקנה

```bash
# טען מחדש את ה-shell
exec $SHELL

# או הוסף ל-PATH
export PATH="/usr/local/bin:$PATH"
```

### האימות נכשל

```bash
# נסה ידנית
gh auth login --web

# בדוק סטטוס
gh auth status
```

### רוצה לבדוק שוב

```bash
# התנתק כדי לבדוק תהליך אימות
gh auth logout

# הסר התקנה כדי לבדוק תהליך מלא (macOS)
brew uninstall gh
```

## סיכום

- ✅ `node test-gh-setup.js` - בדיקה ישירה של התהליך
- ✅ `gta add` - בדיקה עם פקודה אמיתית
- ✅ התהליך אינטראקטיבי - מחכה לתשובות
- ✅ כל הפלט מוצג בזמן אמת
- ✅ אימות אחרי כל שלב
- ✅ סיכום יפה בסוף

---

**טיפ**: הדרך הטובה ביותר לראות את התהליך המלא היא להריץ `gh auth logout` ואז `node test-gh-setup.js` בטרמינל רגיל.
