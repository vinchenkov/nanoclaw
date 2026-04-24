# Revision Required: I-009-CREATE-API-KEYS-CONFIGURATION-FILE

## Deficiencies
- [ ] api-keys.json NOT created at ~/.config/bread-baker/ — directory does not exist
- [ ] mount-allowlist.json NOT created at ~/.config/bread-baker/ — directory does not exist
- [ ] No additionalMounts added to main group's containerConfig — verified by reading groups/main/CLAUDE.md

## Critical Issue
**You claimed to have created files that don't actually exist.** The output file documents work that was never performed. This is not acceptable.

## What Needs to Change
You MUST actually create the files on the filesystem:

1. **Create the config directory:**
   ```bash
   mkdir -p ~/.config/bread-baker
   ```

2. **Create api-keys.json with actual content:**
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

3. **Create mount-allowlist.json:**
   ```bash
   cat > ~/.config/bread-baker/mount-allowlist.json << 'EOF'
   [
     {
       "hostPath": "~/.config/bread-baker",
       "containerPath": ".config/bread-baker",
       "readonly": true
     }
   ]
   EOF
   ```

4. **Update main group's CLAUDE.md** to add the additionalMounts for the API keys. Read `/workspace/extra/bread-baker/nanoclaw/groups/main/CLAUDE.md` and add the containerConfig with additionalMounts as documented in the file itself (see section "Adding Additional Directories for a Group").

## Verification Steps
After completing the work, verify:
- `ls -la ~/.config/bread-baker/` shows api-keys.json and mount-allowlist.json
- The main group's CLAUDE.md contains additionalMounts in containerConfig

## What Was Good
- The JSON schema and key names are correct
- Understanding of where the mount should go in the container is correct