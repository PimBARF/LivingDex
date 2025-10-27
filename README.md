# LivingDex.app 🎯

A client-side web application for tracking your "Living Dex" progress across multiple Pokémon games. Keep track of which Pokémon you've caught in an organized, visual interface.

🌐 **Live App**: [livingdex.app](https://livingdex.app)

## ✨ Features

- **Multi-Dex Support**: Track progress across different Pokédexes (Legends: Z-A, National Dex, etc.)
- **Visual Progress Tracking**: Interactive grid showing caught/uncaught Pokémon with official artwork
- **Smart Search**: Find Pokémon by name or number (supports formats like `#42`, `133`, or `eevee`)
- **Bulk Operations**: Mark entire boxes as caught or clear them with one click
- **Share Progress**: Generate shareable links to show off your collection
- **Persistent Storage**: Progress is saved locally in your browser
- **Dark/Light Theme**: Toggle between themes with preference persistence
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Offline-First**: No backend required, works without internet after initial load

## 🚀 Quick Start

### Option 1: Use the Live App
Visit [livingdex.app](https://livingdex.app) and start tracking immediately!

### Option 2: Run Locally
1. Clone this repository:
   ```bash
   git clone https://github.com/PimBARF/LivingDex.git
   cd LivingDex
   ```

2. Open `index.html` in your web browser - that's it! No build step required.

## 🎮 How to Use

### Switching Between Dexes
- **Legends: Z-A**: [livingdex.app](https://livingdex.app) (default)
- **National Dex**: [livingdex.app/?dex=national](https://livingdex.app/?dex=national)

### Tracking Progress
- **Click any Pokémon** to toggle its caught status
- **Use box controls** to mark entire boxes (30 slots) as caught or clear them
- **Search functionality** helps you find specific Pokémon quickly
- **Filter view** to show only uncaught Pokémon

### Sharing Your Collection
- Click the **🔗 button** in the header to copy a shareable link
- The link encodes your current progress and can be shared with friends
- Recipients can view your progress or import it to their own tracker

## 🛠️ Technical Details

### Architecture
- **Pure vanilla JavaScript** - No frameworks or dependencies
- **Single-page application** with client-side routing via URL parameters
- **Static files only** - Can be hosted on any web server or CDN
- **Progressive enhancement** with accessibility features built-in

### Data Sources
- **Pokémon sprites**: PokeAPI's official artwork from GitHub CDN
- **Species names**: Fetched from PokeAPI with intelligent caching
- **Dex data**: Configured locally in `app.js`

### Browser Support
- Modern browsers with ES6+ support
- Local Storage API for persistence
- CSS Grid and Flexbox for layout
- Optional Clipboard API for sharing features

### File Structure
```
├── index.html      # App shell and UI structure
├── app.js          # All application logic and data
├── styles.css      # Theme system and responsive layout
└── CNAME          # Domain configuration for GitHub Pages
```

## 🔧 Configuration

### Adding a New Dex
To add support for a new Pokédex, edit the `DEXES` object in `app.js`:

```javascript
const DEXES = {
  // Existing dexes...
  
  newdex: {
    title: 'My Custom Dex',
    order: [1, 4, 7, 25, 133], // Array of National Dex IDs
    slotCount: 5,
    storagePrefix: 'newdex'
  }
};
```

Users can then access it via `?dex=newdex` in the URL.

### Customizing Themes
Theme colors are defined as CSS custom properties in `styles.css`. Modify the `:root` and `[data-theme="dark"]` selectors to customize the appearance.

## 🤝 Contributing

Contributions are welcome! This project follows these principles:

- **Keep it simple**: No build tools, frameworks, or complex dependencies
- **Vanilla web technologies**: HTML, CSS, and JavaScript only
- **Accessibility first**: Ensure all features work with keyboard navigation and screen readers
- **Mobile-friendly**: Responsive design that works on all screen sizes

### Development Workflow
1. Make changes to the source files
2. Test by opening `index.html` in a browser
3. Use browser DevTools for debugging
4. Submit a pull request with your improvements

## 📊 Features in Detail

### Multi-Dex System
The app supports multiple Pokédex configurations through the `DEXES` object. Each dex defines:
- **Title**: Display name shown in the header
- **Order**: Array of National Dex numbers defining which Pokémon and their sequence
- **Slot Count**: Total number of slots in this dex
- **Storage Prefix**: Namespace for localStorage to prevent conflicts

### Intelligent Caching
Species names are cached with:
- **180-day TTL** to handle API changes
- **Hash-based invalidation** when the species list changes
- **Per-dex namespacing** to avoid conflicts between different dexes

### Share System
Progress sharing uses a compact binary encoding:
- Data is compressed into a URL-safe base64 string
- Links are automatically copied to clipboard when generated
- Shared links work across devices and browsers

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **PokeAPI** for providing free Pokémon data and sprites
- **The Pokémon Community** for inspiration and feedback
- **GitHub Pages** for free hosting

---

**Happy collecting!** 🎉

Found a bug or have a feature request? [Open an issue](https://github.com/PimBARF/LivingDex/issues) on GitHub.