# Utilize Nanoclaw to Implement Bread Baker

## Bread Baker
There exists an implementation spec at "/Users/vinchenkov/Documents/dev/claws/NanoClaw/specs/BREAD-BAKER-IMPLEMENTATION-SPEC.md".
This will create a piece of automated, investment software.
I am using Nanoclaw as a base. The implementation spec will transform a nanoclaw installation to facilitate the design of the atlas-gic project.

## Two Nanoclaw installations
I want to use this Nanoclaw, let's call it the "Homie" installation to implement the bread baker system. As stated above, the bread baker system will be written on top of / modify a vanilla Nanoclaw installation.

The Nanoclaw installation I want to actually perform the implementing: "/Users/vinchenkov/Documents/dev/claws/NanoClaw".
The Nanoclaw installation that will be transformed into Bread Baker by Homie: "/Users/vinchenkov/Documents/dev/bread-baker/nanoclaw"

## Utilize Orchestrator Framework
I want to utilize the framework I've created (planner, worker, verifier) to implement the bread baker specification.

First, to enable this I will need to mount the "/Users/vinchenkov/Documents/dev/bread-baker/nanoclaw" directory as a workspace for all the groups to access.

Second, I will need to seed initiatives/tasks so that the agents are assigned work.

## Implementation Spec Updates

The paths / workspace written in the spec need to be updated to reflect the actual paths the agents will see in their containers, the full mounted paths.

## Long Running Time
I will kickoff this implementation / nanoclaw before I fall asleep.
I want to ensure Nanoclaw is WORKING THE WHOLE TIME.

I am afraid that the initiatives/tasks we manually seed for Homie will only be worked on for a few agent runs, maybe like a total of 45 minutes.
I want to ensure that Homie is working throughout the night. 


## Outcomes
In the morning when I wake up:
1. The Bread Baker system should be nearly system complete.
2. It should have correctness tests
3. I should have a high-level report of the changes: what was done, what I need to do next (integrations, api keys, etc.).

## Open Questions
Can the Homie agents, spawn containers, even though they are in containers themselves? If so, this means they'd be able do actually test and run certain aspects of the bread baker system right?


We need to brainstorm what else I need to ensure that the Homie agents work fruitfully, and throughout the night. What changes do I need to make?
For this night run, I will checkout into a new branch called night-run/bread-baker-implementation so that I way I can remove the things like my vision statemetn and irrelevant details.