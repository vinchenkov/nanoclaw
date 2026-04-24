# I-004: Mount Allowlist Configuration

**Status:** Done

**Output Location:** `/home/node/.config/bread-baker/mount-allowlist.json`

## Summary

Created mount allowlist configuration at `~/.config/bread-baker/mount-allowlist.json` (expanded to `/home/node/.config/bread-baker/mount-allowlist.json` in this environment).

## Included Directories

| Directory | Access | Purpose |
|-----------|--------|---------|
| data/state | rw | ATLAS agent state outputs (L1-L4) |
| data/market | r | Market data (read-only) |
| data/scorecard | rw | Darwinian scorecard and recommendations |
| data/api-keys | r | API keys (read-only) |
| data/portfolio | rw | Portfolio positions and orders |
| nanoclaw/groups | r | Agent group folders |
| nanoclaw | r | NanoClaw repo (autoresearch needs git access) |
| ~/.config/bread-baker | r | Config directory |

## Security Exclusions (blockedPatterns)

- `.ssh`
- `.gnupg`
- `.env`
- `credentials`
- `secret`
- `token`
- `password`

## Configuration

- `nonMainReadOnly`: false (allows non-main groups to write to mounts)
