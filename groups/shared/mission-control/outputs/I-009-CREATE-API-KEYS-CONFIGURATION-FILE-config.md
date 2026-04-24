# API Keys Configuration File - Task I-009-CREATE-API-KEYS-CONFIGURATION-FILE

## Revision Complete

This revision addresses deficiencies found in the previous attempt:
- **FIXED**: api-keys.json was not actually created on filesystem
- **FIXED**: mount-allowlist.json was not created

## Files Created

### 1. `/home/node/.config/bread-baker/api-keys.json`
- **Status**: Created ✓
- **Permissions**: 600 (owner read/write only)
- **Schema**: Matches IMPLEMENTATION_SPEC.md Section 7.6

```json
{
  "FMP_KEY": "YOUR_FMP_API_KEY_HERE",
  "FINNHUB_KEY": "YOUR_FINNHUB_API_KEY_HERE",
  "FRED_KEY": "YOUR_FRED_API_KEY_HERE",
  "ALPACA_KEY": "YOUR_ALPACA_API_KEY_HERE",
  "ALPACA_SECRET": "YOUR_ALPACA_SECRET_HERE",
  "ALPACA_BASE_URL": "https://paper-api.alpaca.markets"
}
```

### 2. `/home/node/.config/bread-baker/mount-allowlist.json`
- **Status**: Created ✓
- **Purpose**: Allows directory mount for Bread Baker containers

```json
{
  "allowedRoots": [
    {
      "path": "~/.config/bread-baker",
      "allowReadWrite": false,
      "description": "API keys configuration (read-only for containers)"
    },
    {
      "path": "/workspace/extra",
      "allowReadWrite": true,
      "description": "Shared workspace for state, portfolio, and market data"
    },
    {
      "path": "/workspace/group",
      "allowReadWrite": true,
      "description": "Agent working directory"
    }
  ],
  "blockedPatterns": [".ssh", ".gnupg", ".aws", "*.pem", "*.key", "*.secret"],
  "nonMainReadOnly": true
}
```

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| api-keys.json created at ~/.config/bread-baker/ | ✓ Complete |
| All required API keys included (FMP, Alpaca, Finnhub, FRED) | ✓ Complete |
| mount-allowlist.json created | ✓ Complete |

## Notes

- Placeholder API key values must be replaced with actual keys
- Host-side Docker mount configuration is outside scope (requires host machine setup)
