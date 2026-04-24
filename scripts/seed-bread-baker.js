
import { execSync } from 'child_process';

const MC_PATH = 'npx tsx groups/shared/bin/mc.ts --base-dir groups/shared';

function run(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8' });
    console.log(output);
    return JSON.parse(output);
  } catch (e) {
    console.error(`Error running command: ${cmd}`);
    console.error(e.stderr || e.message);
    return null;
  }
}

// 1. Create the Master Transformation Initiative
const mainInitiative = run(`${MC_PATH} initiative create \
  --title "BREAD-BAKER-FULL-TRANSFORMATION" \
  --goal "Decompose and execute the full ATLAS-GIC implementation spec to transform NanoClaw into Bread Baker." \
  --objective north-star \
  --timeframe "1 week"`);

if (!mainInitiative) process.exit(1);

// 2. Create the Static Analysis & Gap Analysis Initiative (PAUSED until finished)
const analysisInitiative = run(`${MC_PATH} initiative create \
  --title "BREAD-BAKER-STATIC-ANALYSIS-AND-GAP-VERIFICATION" \
  --goal "Perform exhaustive static analysis and gap verification once the transformation is complete." \
  --objective other \
  --timeframe "2 days"`);

if (analysisInitiative) {
  // Use 'paused' as 'blocked' is not a valid initiative status.
  // Transitions: active -> paused is allowed.
  run(`${MC_PATH} initiative update ${analysisInitiative.id} --status paused`);
}

// 3. Create the Master Decomposition Task
const metaTask = run(`${MC_PATH} task create \
  --title "Decompose Bread Baker Implementation Spec into Initiatives and Tasks" \
  --description "1. Read /Users/vinchenkov/Documents/dev/bread-baker/IMPLEMENTATION_SPEC.md.\n2. Create Initiatives for each phase (Infrastructure, L1-L4 agents, etc.) under the main transformation goal.\n3. Seed granular technical tasks for each. Ensure each task tells the worker to read the spec for context before executing the task.\n4. Create a final 'Verification' task under the Static Analysis initiative (${analysisInitiative ? analysisInitiative.id : 'ANALYSIS_ID_MISSING'}) that depends on all other tasks being 'done'." \
  --acceptance-criterion "Main transformation roadmap seeded with 15+ tasks" \
  --acceptance-criterion "Static Analysis initiative configured to trigger only after completion" \
  --initiative ${mainInitiative.id} \
  --worker-type admin \
  --priority P0`);

if (metaTask) {
  run(`${MC_PATH} task update ${metaTask.id} --status ready`);
  
  // 4. Create the final Analysis Task (the "Gaps" task)
  if (analysisInitiative) {
    const analysisTask = run(`${MC_PATH} task create \
      --title "Exhaustive Static Analysis and Gap Reporting" \
      --description "1. Analyze the completed Bread Baker codebase at /workspace/extra/bread-baker/nanoclaw/.\n2. Compare the implementation against every section of the /Users/vinchenkov/Documents/dev/bread-baker/IMPLEMENTATION_SPEC.md.\n3. Identify missing logic, unhandled edge cases, or architectural drift.\n4. Write all findings to '/workspace/extra/shared/mission-control/outputs/BREAD-BAKER-GAP-ANALYSIS.md'.\n5. This file will be consumed by a follow-up 'Remediation' task." \
      --acceptance-criterion "Comprehensive report written to BREAD-BAKER-GAP-ANALYSIS.md" \
      --acceptance-criterion "Every phase of the spec is audited for completion" \
      --initiative ${analysisInitiative.id} \
      --worker-type research \
      --priority P3`); // Priority P4 is invalid, using P3.
      
    if (analysisTask) {
      // 'blocked' is a valid task status.
      run(`${MC_PATH} task update ${analysisTask.id} --status blocked`);
    }
  }
}

console.log("\nSuccess! Transformation and Static Analysis roadmap initialized.");
