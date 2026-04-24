# Task I-009-CREATE-API-KEYS-CONFIGURATION-FILE - Revision Complete

## Status: COMPLETED (Revision Applied)

## Summary

This revision addresses the deficiencies found in the original task. The files have been actually created on the filesystem.

## Files Created

### 1. Config Directory
- **Path**: `/home/node/.config/bread-baker/`
- **Created**: Yes (via `mkdir -p`)

### 2. API Keys Configuration
- **Path**: `/home/node/.config/bread-baker/api-keys.json`
- **Permissions**: `600` (read-write for owner only)
- **Content**:
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

### 3. Mount Allowlist
- **Path**: `/home/node/.config/bread-baker/mount-allowlist.json`
- **Content**:
```json
[
  {
    "hostPath": "~/.config/bread-baker",
    "containerPath": ".config/bread-baker",
    "readonly": true
  }
]
```

### 4. CLAUDE.md Updated
- **Path**: `/workspace/extra/bread-baker/nanoclaw/groups/main/CLAUDE.md`
- **Changes**: Added API keys mount to the Container Mounts section:
  - Added row: `.config/bread-baker` → `~/.config/bread-baker/` (read-only)
  - Added note about `.config/bread-baker/api-keys.json` for external services

## Verification

```
$ ls -la /home/node/.config/bread-baker/
total 16
drwxr-xr-x 2 501 dialout 4096 Mar 15 03:00 .
drwxr-xr-x 1 501 dialout 4096 Mar 15 02:59 ..
-rw------- 1 501 dialout  274 Mar 15 03:00 api-keys.json
-rw-r--r-- 1 501 dialout  118 Mar 15 03:00 mount-allowlist.json
```

## Note on containerConfig

The `containerConfig.additionalMounts` is a runtime configuration stored in `registered_groups.json` (at `<projectRoot>/data/registered_groups.json`). This file does not exist yet because no groups are registered. When the main group is registered, the following containerConfig should be included:

```json
{
  "containerConfig": {
    "additionalMounts": [
      {
        "hostPath": "~/.config/bread-baker",
        "containerPath": ".config/bread-baker",
        "readonly": true
      }
    ]
  }
}
```

This is documented in the CLAUDE.md under "Adding Additional Directories for a Group".

## Required API Keys

| Key | Service | Purpose |
|-----|---------|---------|
| `FMP_KEY` | Financial Modeling Prep | Stock market data |
| `FINNHUB_KEY` | Finnhub | Alternative market data |
| `FRED_KEY` | FRED (Federal Reserve) | Economic data |
| `ALPACA_KEY` | Alpaca | Broker API (paper trading) |
| `ALPACA_SECRET` | Alpaca | Broker API secret |

## Next Steps

1. Replace placeholder values in `/home/node/.config/bread-baker/api-keys.json` with actual API keys
2. The keys will be available at `.config/bread-baker/api-keys.json` inside the container
