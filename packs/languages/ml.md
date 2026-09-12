# Pack: Machine learning / PyTorch

Loaded alongside the `python` pack. ML code fails differently from application code -
usually silently, producing a worse model rather than an error.

## Review focus

**Data leakage.** The defect that invalidates results entirely. Normalisation statistics
computed over the full dataset before splitting, a feature derived from the target, and
time-series splits that let the future inform the past. Fit every transform on train
only, then apply to validation and test.

**Split integrity.** Splits must be reproducible and disjoint. Grouped data - multiple
rows per user, per patient, per session - must be split by group, or the same entity
appears on both sides and the score is inflated.

**Reproducibility.** Seed Python, NumPy and the framework. Record the data version, the
code commit and the hyperparameters with the run. An unreproducible result cannot be
debugged or defended.

**Tensor mechanics.** Shape mismatches that broadcast silently instead of failing are
the common PyTorch bug - assert shapes at boundaries. Device mismatch between model and
data. Forgetting `model.eval()` leaves dropout and batch-norm in training mode and
quietly degrades inference. `torch.no_grad()` for evaluation, or memory grows.
Forgetting `optimizer.zero_grad()` accumulates gradients across steps.

**Evaluation.** Accuracy on an imbalanced dataset is meaningless - use metrics matched
to the decision being made, and report a baseline. A model must beat the trivial
predictor before anything else is discussed.

**Serving.** Training and serving must apply identical preprocessing - divergence here
is the classic production failure. Pin the model version alongside the code version, and
have a rollback path.
