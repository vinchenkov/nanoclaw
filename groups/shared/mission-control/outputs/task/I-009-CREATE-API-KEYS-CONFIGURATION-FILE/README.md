# API Keys Configuration - Task I-009-CREATE-API-KEYS-CONFIGURATION-FILE

## Created Files

### Host-side Configuration File

**Location:** `/home/node/.config/bread-baker/api-keys.json`

```json
{
  "FMP_KEY": "PLACEHOLDER_FMP_KEY",
  "FINNHUB_KEY": "PLACEHOLDER_FINNHUB_KEY",
  "FRED_KEY": "PLACEHOLDER_FRED_KEY",
  "ALPACA_KEY": "PLACEHOLDER_ALPACA_KEY",
  "ALPACA_SECRET": "PLACEHOLDER_ALPACA_SECRET",
  "ALPACA_BASE_URL": "https://paper-api.alpaca.markets"
}
```

## Schema Reference

From IMPLEMENTATION_SPEC.md (Section 7.6, Friction 6):

| Field | Description |
|-------|-------------|
| `FMP_KEY` | Financial Modeling Prep API key |
| `FINNHUB_KEY` | Finnhub API key |
| `FRED_KEY` | Federal Reserve Economic Data API key |
| `ALPACA_KEY` | Alpaca API key ID |
| `ALPACA_SECRET` | Alpaca API secret |
| `ALPACA_BASE_URL` | Set to `https://paper-api.alpaca.markets` for paper trading |

## Container Mount Configuration

**Required Host Path:** `/home/node/.config/bread-baker/api-keys.json`

**Container Mount Path:** `/workspace/extra/api-keys/api-keys.json`

### Docker Compose Mount (to be added by Vinny)

```yaml
volumes:
  - /home/node/.config/bread-baker/api-keys.json:/workspace/extra/api-keys/api-keys.json:ro
```

Or as a bind mount:

```yaml
volumes:
  - type: bind
    source: /home/node/.config/bread-baker
    target: /workspace/extra/api-keys
    read_only: true
```

## Action Required

Replace the `PLACEHOLDER_*` values in `/home/node/.config/bread-baker/api-keys.json` with actual API keys:

1. **FMP_KEY**: Get from https://site.financialmodelingprep.com/
2. **FINNHUB_KEY**: Get from https://finnhub.io/
3. **FRED_KEY**: Get from https://fred.stlouisfed.org/
4. **ALPACA_KEY** / **ALPACA_SECRET**: Get from https://alpaca.markets/

The `/workspace/extra/api-keys/` directory needs to be created and mounted by the host - I do not have permissions to create it in this environment.

## Status

- [x] api-keys.json created at ~/.config/bread-baker/
- [x] All required API keys included (FMP, Alpaca, Finnhub, FRED)
- [ ] File mounted to containers (requires host action)
