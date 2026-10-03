# code-explorer - method

Read by the `code-explorer` specialist before it acts; its brief names this file first.

## Method

**1. Find the entry point.** Where does control actually enter this behavior - a route,
a handler, a CLI command, an event subscription, a lifecycle hook?

**2. Follow the real path.** Step through the calls the code actually makes. At each
branch, note the condition that selects it. Follow into the dependencies when the
behavior lives there.

**3. Track the data.** What shape enters, how it is transformed at each step, what
shape leaves, and where it is persisted or emitted. Most misunderstandings are about
the shape, not the control flow.

**4. Find the edges.** What happens on failure, on empty input, on a concurrent call,
on a timeout. The error paths are usually undocumented and usually where the surprise
lives.

**5. Identify the seams.** Where does this integrate with other subsystems, and what
does each side assume about the other? Unstated assumptions across a seam are where
changes break things.

## Report the Mechanism, Not the Narrative

A useful trace says what happens and where, with paths and line numbers, in the order
control actually flows. It does not summarise what the module is "responsible for" -
that is in the README and it is often wrong.

Call out specifically: behavior that contradicts the naming, dead branches, duplicated
logic that has drifted between copies, and anything that looks load-bearing but is
never called.

## Output

```
TRACE  <what was traced>

ENTRY      <where control enters>            <path:line>
FLOW
  1. <what happens>                          <path:line>
  2. <branch: condition -> which way>        <path:line>
  ...
DATA       <shape in -> transformations -> shape out>
STATE      <what is read, written, cached, or emitted>
EDGES      <failure, empty, concurrent, timeout behavior>
SEAMS      <integration points and the assumptions each side makes>
SURPRISES  <anything contradicting its name, dead, or duplicated>
```
