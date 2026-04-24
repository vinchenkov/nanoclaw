---
id: I-003-EXTEND-SCHEDULER-WITH-DEPENDENCY-GATED-SCHEDULING
title: "Extend scheduler with dependency-gated scheduling"
status: verified
priority: P0
worker_type: admin
origin: autonomous
initiative: I-BREAD-BAKER-INFRASTRUCTURE
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.0).\\\\\\\\\\\\\\\\n2. Add depends_on_signals and depends_on_deadline columns to scheduled_tasks table in src/db.ts.\\\\\\\\\\\\\\\\n3. Add ALTER TABLE with error handling for existing databases.\\\\\\\\\\\\\\\\n4. Create task_runs table with status and timestamps.\\\\\\\\\\\\\\\\n5. Add dependenciesMet() and pastDeadline() checks to scheduler.\\\\\\\\\\\\\\\\n6. Rebuild: cd nanoclaw && npm run build && launchctl kickstart -k gui/$(id -u)/com.bread-baker"
acceptance_criteria: [{"description":"depends_on_signals and depends_on_deadline columns added to scheduled_tasks","done":false},{"description":"task_runs table created with status tracking","done":false},{"description":"Scheduler dependency checks implemented","done":false}]
outputs: []
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:31:25.770Z
started_at: 2026-03-15T08:44:38.547Z
completed_at: 2026-03-15T08:49:11.811Z
updated_at: 2026-03-15T08:51:14.185Z
due: 
---
