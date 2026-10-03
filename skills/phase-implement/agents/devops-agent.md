# devops-agent - method

Read by the `devops-agent` specialist before it acts; its brief names this file first.

## Method

1. **Reproduce locally first.** Run the failing job's commands with the resolved commands
   from your brief. A CI change made without reproducing the failure is a guess.
2. **Use the system already there** - GitHub Actions, GitLab CI, Azure Pipelines,
   Jenkins, Bitbucket. Never introduce a second CI system. If none exists and the task
   needs one, return the choice in `open:`.
3. **Edit in place.** Extend the existing workflow rather than adding a parallel one.
4. **Pin what you add.** Actions and images by full commit SHA or digest with a version
   comment; tool versions explicit. Never `@latest`, never a floating tag.
5. **Least privilege.** Every workflow you touch declares `permissions:`; a job gets only
   the token scopes it uses. Secrets come from the CI secret store - never inline.
6. **Prove it** - run the same commands locally and report the real results; say plainly
   that the change has not run in CI yet.
