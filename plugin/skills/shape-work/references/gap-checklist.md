# The gap checklist

The questions a story must answer before anyone plans it. `shape-work` walks them with the PO;
`plan-work` step 0 checks a story against them. One source, two readers: edit it here.

**Not every row applies to every story.** First decide which rows apply, from what the story is —
a list, a form, a single setting, an API change, a background job — using *Applies when*. Only
those rows are asked, and only those are checked. **A row that does not apply is skipped**: nobody
asks it, and the body says nothing about it, not even `n/a`. When you cannot tell whether a row
applies, that is the one question to ask: *"can this list get long enough to page?"*

Of the rows that apply, one the story already answers needs nothing; one it leaves open is a gap.

The rows are questions, not headings. An answer lands as a rule under the acceptance criterion it
belongs to — the empty state under the criterion for the list it empties.

| Area | Applies when | The question the story must answer |
|---|---|---|
| Data scope | it shows or acts on records | Which records — and is there an "all", and who may see it? |
| Roles and permissions | not everyone may see it or do it | Who can see it, who can act on it, and what does everyone else see? |
| Placement | it adds something a user sees or calls | Where does it live in the UI or API, and what does it sit next to? |
| Availability | the surrounding feature is on only for some — a toggle, a setting, a licence, a location | Where is it offered, and where is it not? Does it follow the same switch as the feature it extends? |
| Checks and limits | the user sends, uploads or enters data | Which checks and limits will they hit — size, format, a scan, a quota, a duplicate — and what do they see when they do? |
| Default on load | a view or control has a starting state | What is shown or selected before the user does anything? |
| Empty state | a view can have nothing to show | What does the user see when there is nothing? |
| Error state | it can fail where the user sees it | What does the user see when it fails? |
| Loading state | the user waits for data | What does the user see while it is fetching? |
| Reset / clear | the user can change a selection, filter or setting | How does the user get back to the default? |
| Pagination and sort | a list can grow | How many, in what order, and can the user change either? |
| Search and filter semantics | it has search or filters | Live or on submit? Several filters combined with AND or OR? |
| Fallback | part of it may not be built in this story | What the user gets if part of this is not built in this story |

## What must not happen

A story that touches **data scope, roles, permissions or isolation** names at least one thing that
must be refused, hidden or absent: who does *not* see the records, which action is *not* offered.
A story with only things that must appear is half a specification there, and the divergence
reviewer will find its tasks prove nothing about the other half. A story that touches none of these
does not need one.

A story that **moves, copies, deletes or replaces** the user's data names what must never be lost:
the original after a failed or rejected step, the file a cleanup removes, the record an overwrite
replaces. "Copy or move?" left `OPEN:` is not that rule; it is the question that decides it.

## Hidden scope

The capabilities the story assumes exist and do not: a screen, a setting, a kind of record, an
integration. Check the code for each. A capability nobody noticed was missing is how a three-task
story becomes a seven-task story halfway through.

Hidden scope is a product question only when it needs a **scope decision**: build it in this story
(a criterion), give the user something else for now (a fallback), or leave it out (*Out of scope*,
with where it went instead). Whether an endpoint, a column or an event exists, and how to build it,
is the developer's question — it goes under *Open questions for dev*, and planning answers it.

**The test for *Open questions for dev*: would the user see the answer?** Then it is a product
question, asked now, however technical it sounds. "Should the queue remember which case a file came
from?" decides whether the user gets a link back to the case: product. "How do we detect the same
file?" changes nothing the user sees: the developer's.
