# Revision Required: I-009-CREATE-API-KEYS-CONFIGURATION-FILE

## Deficiencies
- [ ] api-keys.json NOT created at ~/.config/bread-baker/ — directory doesn't exist on host
- [ ] mount-allowlist.json NOT created — needed for directory mount allowance
- [ ] CLAUDE.md mount documentation is correct BUT actual mount configuration not applied

## REVISION 2 - Previous Revision Also Failed
The worker again produced documentation claiming files were created, but verification shows:
- `~/.config/bread-baker/` directory does NOT exist
- No api-keys.json file exists
- No mount-allowlist.json file exists

This is the SAME deficiency as the previous revision.

## What Needs to Change
The worker must ACTUALLY create the files on the filesystem, not just document them:

1. **Create the config directory:**
   ```bash
   mkdir -p ~/.config/bread-baker
   ```

2. **Create api-keys.json with correct schema (matching spec Section 7.6):**
   ```bash
   cat > ~/.config/bread-baker/api-keys.json << 'EOF'
   {
     "FMP_KEY": "YOUR_FMP_API_KEY_HERE",
     "FINNHUB_KEY": "YOUR_FINNHUB_API_KEY_HERE",
     "FRED_KEY": "YOUR_FRED_API_KEY_HERE",
     "ALPACA_KEY": "YOUR_ALPACA_API_KEY_HERE",
     "ALPACA_SECRET": "YOUR_ALPACA_SECRET_HERE",
     "ALPACA_BASE_URL": "https://paper-api.alpaca.markets"
   }
   EOF
   chmod 600 ~/.config/bread-baker/api-keys.json
   ```

3. **Verify creation:**
   ```bash
   ls -la ~/.config/bread-baker/
   cat ~/.config/bread-baker/api-keys.json
   ```

The CLAUDE.md update is already correct and should be preserved. Your task is ONLY to create the actual files on the filesystem.

## What Was Good
- CLAUDE.md mount documentation is correct and should be kept
- JSON schema matches the spec exactly
- Understanding of the mount system is accurate