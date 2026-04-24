# Mount Allowlist Configuration - Task Complete

## Deliverable
Created `/home/node/.config/bread-baker/mount-allowlist.json`

## Structure
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

## Acceptance Criteria Status
- [x] mount-allowlist.json created at ~/.config/bread-baker/
- [x] All required directories included in allowlist (state, market, scorecard, api-keys, portfolio, repo)
- [x] Security-sensitive paths excluded (.ssh, .gnupg, .env in blockedPatterns)
