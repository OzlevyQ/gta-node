# GTA Web Interface

Pure HTML, CSS, and JavaScript web interface for GTA.

## Structure

```
web/
├── index.html   # Main HTML structure
├── styles.css   # All styles (no frameworks)
├── app.js       # All JavaScript (vanilla JS)
└── README.md    # This file
```

## Features

- 📊 **Dashboard** - Repository info, automation status, quick actions
- 💾 **Commits** - Commit manager with AI generation
- ⚙️ **Config** - View all configuration settings
- 👤 **Profile** - Personal information and settings

## Tech Stack

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with gradients, flexbox, grid
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **Fetch API** - RESTful communication with backend

## API Endpoints

The web interface communicates with these backend endpoints:

- `GET /api/status` - Get repository and config status
- `POST /api/commit` - Create a commit
- `POST /api/commit/generate` - Generate AI commit message
- `POST /api/push` - Push commits to remote

## Running

```bash
gta web              # Launch on port 3000
gta web -p 8080      # Custom port
gta web --no-open    # Don't open browser
```

## Auto-refresh

The interface automatically refreshes data every 5 seconds to show real-time updates.

## Styling

- Gradient background: `#667eea` to `#764ba2`
- Primary color: `#667eea` (purple-blue)
- Cards with shadows and rounded corners
- Smooth transitions and hover effects
- Responsive grid layout

## JavaScript Architecture

- Event-driven with `addEventListener`
- Async/await for all API calls
- Modular functions for each feature
- Error handling with try/catch
- No global pollution (scoped variables)
