# Revision Required: I-004-CREATE-MOUNT-ALLOWLIST-CONFIGURATION

## Verification Result: FAILED (REVISION 3/3 - MAX REVISIONS REACHED)

**FINAL VERDICT: Task cannot be verified as complete.**

The task was marked as "done" but verification shows the deliverable is still missing after 3 revision attempts.
- [ ] mount-allowlist.json file does NOT exist at ~/.config/bread-baker/mount-allowlist.json (VERIFIED: directory /home/node/.config/bread-baker/ does not exist)
- [ ] Cannot verify acceptance criteria - file is missing

## What Needs to Change
This is now REVISION 3/3 - the final attempt.

1. Create the directory if it doesn't exist: `mkdir -p ~/.config/bread-baker/`
2. Write the actual file to `~/.config/bread-baker/mount-allowlist.json` (not just the output document)
3. Use this exact structure:
```json
{
  "allowedRoots": [
    {
      "path": "~/Documents/dev/bread-baker/data/state",
      "allowReadWrite": true,
      "description": "ATLAS agent state directory (read-write)"
    },
    {
      "path": "~/Documents/dev/bread-baker/data/market",
      "allowReadWrite": false,
      "description": "Market data directory (read-only)"
    },
    {
      "path": "~/Documents/dev/bread-baker/data/scorecard",
      "allowReadWrite": true,
      "description": "Scorecard directory (read-write)"
    },
    {
      "path": "~/Documents/dev/bread-baker/data/api-keys",
      "allowReadWrite": false,
      "description": "API keys directory (read-only)"
    },
    {
      "path": "~/Documents/dev/bread-baker/data/portfolio",
      "allowReadWrite": true,
      "description": "Portfolio directory (read-write)"
    },
    {
      "path": "~/Documents/dev/bread-baker/data/repo",
      "allowReadWrite": false,
      "description": "Repo directory (read-only for most agents, read-write for autoresearch)"
    }
  ],
  "blockedPatterns": [".ssh", ".gnupg", ".env", "credentials", "secret", "token", "password"],
  "nonMainReadOnly": false
}
```
4. CRITICAL: Verify the file was written using `cat ~/.config/bread-baker/mount-allowlist.json` BEFORE marking task complete

## What Was Good
- Output file correctly identifies the expected structure
- JSON structure in output document is well-formed

## Why This Keeps Failing
The worker is writing to the output document (mission-control/outputs/) but NOT actually creating the file at ~/.config/bread-baker/. This is the core issue - the deliverable is the actual config file, not a report about the config file.
