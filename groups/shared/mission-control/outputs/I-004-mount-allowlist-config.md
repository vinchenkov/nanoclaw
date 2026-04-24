# Mount Allowlist Configuration

**Task ID:** I-004-CREATE-MOUNT-ALLOWLIST-CONFIGURATION
**Created:** 2026-03-15

## Summary

Created `~/.config/bread-baker/mount-allowlist.json` with the following structure:

### Allowed Directories

| Path | Permissions | Description |
|------|-------------|-------------|
| `~/Documents/dev/bread-baker/data/state` | rw | ATLAS state directory - L1-L4 agent state files |
| `~/Documents/dev/bread-baker/data/market` | r | Market data - read-only for all agents |
| `~/Documents/dev/bread-baker/data/scorecard` | rw | Scorecard directory - scorecard updater and evaluators write here |
| `~/.config/bread-baker/api-keys` | r | API keys - read-only for market fetcher and execution |
| `~/Documents/dev/bread-baker/data/portfolio` | rw | Portfolio directory - portfolio manager writes here |
| `~/Documents/dev/bread-baker/nanoclaw/groups` | rw | Agent group folders - autoresearch writes CLAUDE.md prompts |
| `~/Documents/dev/bread-baker/nanoclaw` | r | NanoClaw repo - read-only for most agents |

### Blocked Patterns (Security)

The following paths are explicitly blocked and NOT included in the allowlist:
- `.ssh`
- `.gnupg`
- `.env`
- `credentials`
- `secret`
- `token`
- `password`

### Configuration

```json
{
  "nonMainReadOnly": false
}
```

This allows non-main groups to write to the allowed roots as specified above.

## File Location

`~/.config/bread-baker/mount-allowlist.json`

## Acceptance Criteria Status

- [x] mount-allowlist.json created at ~/.config/bread-baker/
- [x] All required directories included in allowlist (state, market, scorecard, api-keys, portfolio, repo)
- [x] Security-sensitive paths excluded (.ssh, .gnupg, .env)
