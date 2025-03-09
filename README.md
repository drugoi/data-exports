# Data Exports

A collection of scripts for extracting and analyzing personal data from various services and platforms.

## 🎯 Purpose

This repository contains scripts to help you:

- Extract your personal data from different services
- Process and analyze the extracted data
- Generate insights and statistics
- Store data in a structured format for further analysis

## 📁 Repository Structure

```
data-exports/
├── food/                   # Food delivery services data
│   ├── wolt-orders.js     # Wolt orders extraction script
│   └── wolt-stats.js      # Wolt order statistics and analysis
├── data/                   # Extracted data (gitignored)
│   └── wolt/              # Wolt data files
│       ├── wolt_orders.json       # Recent orders (last year)
│       ├── wolt_items.json        # Recent items (last year)
│       ├── all_wolt_orders.json   # All historical orders
│       └── all_wolt_items.json    # All historical items
├── .env                    # Environment variables (gitignored)
└── package.json           # Project dependencies
```

## 🚀 Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/data-exports.git
   cd data-exports
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your API tokens/keys.

## 📊 Available Scripts

### Wolt Data Export

Extract and analyze your Wolt order history.

1. Get your Wolt token:
   - Log in to Wolt in your browser
   - Open Developer Tools (F12)
   - Go to Network tab
   - Find any request to `wolt.com`
   - Copy the `Authorization` header value (starts with "Bearer")

2. Set up the token:
   - Add your token to `.env`:

     ```
     WOLT_TOKEN=your_token_here
     ```

3. Run the scripts:

   ```bash
   # Extract recent orders (last year)
   node food/wolt-orders.js

   # Extract all historical orders
   node food/wolt-orders.js --all

   # Generate statistics
   node food/wolt-stats.js         # For recent orders
   node food/wolt-stats.js --all   # For all orders
   ```

### Data Storage

- All extracted data is stored in the `data/` directory
- The data directory is gitignored to prevent accidental commits of personal data
- Data is stored in JSON format for easy processing and analysis

## 📝 Adding New Services

To add support for a new service:

1. Create a new directory for the service category if needed
2. Add your extraction script
3. Add any analysis scripts
4. Update this README with instructions

## 🔒 Security Notes

- Never commit API tokens or personal data
- Always use environment variables for sensitive data
- The `data/` directory is gitignored by default
- Review extracted data before committing any new scripts

## 📦 Dependencies

- Node.js
- axios - HTTP client
- dayjs - Date manipulation
- dotenv - Environment variables
- chalk - Terminal styling

## 🤝 Contributing

Feel free to:

- Add support for new services
- Improve existing scripts
- Add new analysis features
- Fix bugs or improve documentation

## 📄 License

MIT License - feel free to use and modify as needed.
