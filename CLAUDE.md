# Project notes for Claude

## Workflow preferences

- **Always merge PRs immediately.** After pushing a branch and opening its PR, merge it
  right away (undraft if needed, then merge into `main`) without asking for confirmation —
  as long as it's mergeable (`mergeable_state: clean`) and any CI is green. Don't wait for
  a "мержи" / "merge" reply.
