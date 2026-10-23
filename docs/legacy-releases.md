# Manual legacy image publishing

Normal releases use the independent component workflows and immutable digest
records. `release.yml` retains legacy artifacts for explicit compatibility work.
It accepts only `workflow_dispatch`, with an existing `v*` tag and
`acknowledge_legacy=true`. It never promotes `latest` or deploys production.

In Actions, choose the manual legacy workflow and a branch containing this policy.
Provide the source tag and tick the acknowledgement. The workflow checks out that
tag, keeps the existing legacy build/test steps, and refuses any image version
that is already published. Registry/authentication failures stop publication;
they are not treated as missing images. A partially published run needs a new
version rather than overwriting its completed artifacts.

The main integration carries the reviewed split-development and manual legacy
publishing policy from the release branch into the default branch.
GitHub reads tag-push workflows from the tagged commit: historical source commits
retain their earlier automatic workflow. Do not push new tags pointing at those
old commits expecting this guard to apply. The policy changes the retained
workflow on the integrated branch; it does not rewrite historical tags or runs.

Cards retains `cards-web`; Hearts retains the combined `hearts-api`, standalone
`hearts-web`, and mounted `hearts-cards-web`; Euchre retains `euchre-web`.
Published digest pins, existing images and the infrastructure's guarded rollback
target are unchanged. The integration dispatches no publishing workflow; ordinary validation checks may run.

GitHub documents [tag-push behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push)
and [manual runs with branch selection](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
