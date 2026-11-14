# Grants as standing yeses

When someone tells an agent it can keep doing something, what gets saved, and where do they see it and take it back? In OODS Foundry a grant is **a standing yes, not a setting**: one set of terms on which one actor may act for one person or organization, as given by one person, until it ends. It is an object of its own, `Grant`. Its facts live on a trait, `Mandate`, so your own consent, mandate or connection records can take them too. Every change an agent makes under a grant can name it in that record's history.

![The Grant list searched for Ruth Adeyemi: every grant Ruth Adeyemi gave, with its holder, its party and its end](grants-as-standing-yeses/grant-list-light.png)

## What a grant is, and what it is not

| Thing | What it is | How a grant differs |
|---|---|---|
| A role | A position in an organization, for anyone who holds it | A role has no giver acting for a party, and no end |
| A permission setting | One value on one thing | A setting has no giver, no party, no end and no trace |
| A token | What a system issues under a grant | A token may be narrower than its grant, and may outlive it |
| A saved "always allow" | A rule in a settings file, in most products | Here it is a grant of its own, inside the first, with a giver, bounds and an end |
| An approval | One yes about one version of one thing, used once (see [Approvals as decisions](approvals-as-decisions.md)) | A grant stands for many uses within its terms |
| A delegation | A `Relationship` of type `delegation`, the link alone | A grant has three parties and terms; teams that keep the link keep the type |

## The object and its traits

`Grant` composes four traits:

| Trait | What it gives a grant |
|---|---|
| `Mandate` | The record's facts: who asked for it, who gave it and in what capacity, who holds it, who it is for, what it covers, its three lines for that party, its limits, its end, its use, the grant it sits inside or replaced, and who ended it and why. |
| `Stateful` | The grant's state, as a lifecycle with a declared order (below). |
| `Timestampable` | When it was asked for and last changed, and its latest event (given, paused, resumed, ended or updated) and when. |
| `Ownerable` | The one who answers for it: a person or a team, never an agent. |

**Its terms are never edited in place.** A change of terms is a new grant that names the one it replaces; the old one ends as replaced and is kept whole. A renewal is a replacement with a later end.

## The seats

| Seat | Who can sit in it |
|---|---|
| **Asked for by** | A person, or the agent itself. |
| **Given by** | A person, with the capacity they gave it in ("Finance manager, Tidewater Co-op"). |
| **For** | A person or an organization. Never an agent. |
| **Held by** | An agent, or a person standing in for someone. |
| **Answers for it** | A person or a team. By default, the one who gave it. |
| **Ended by** | Who ended it, and why. |

The seats are fields at the top of the record, so a search for a name on the Grant list finds every grant that names it: everything Ruth Adeyemi gave, everything held for Tidewater Co-op, everything the Billing Agent holds.

**Who may end a grant** is a rule, not a field: anyone who may give grants for the party, the one who gave it, the one who answers for it, and the holder giving it up. Nothing checks it, because OODS Foundry does not know who is looking.

## The terms, and the three layers

A grant's terms are:
- what it covers, in a few words;
- three lines for this party, in the agent's own convention: what goes ahead with no one asked, what needs a yes first, and what never happens. Anything no line names never happens;
- money limits per use and per period, and a count per period, as whole numbers in the currency's minor units;
- conditions in words, which are shown and not checked;
- an end (below).

Three layers apply to an agent acting for a party, each with its own owner, and the stricter always wins:
- **The agent's own lines** are its sponsor's ceiling. "Never" is never lifted. "Asks first" means the action needs a yes: asked each time, or given in advance by a standing yes under a grant (below).
- **The grant** is the party's: it can narrow the agent's lines for that party, never widen them.
- **The thing's own rule** (`Approvable`, see [Approvals as decisions](approvals-as-decisions.md)) is your product's: which change of a payment or an article needs which level of yes.

**A budget on a grant is the money it may move.** The cost of the agent's work is not on the grant.

## A yes given in advance

Where a thing's rule requires a yes for a change, a standing yes counts only if that rule opens the change to a yes given in advance: `Approvable`'s `inAdvance`, empty by default. `Transaction` opens resends. A standing yes satisfies the payment's required yes only when all five of these hold:
1. the thing's rule names the change in `inAdvance`;
2. the one who gave the standing yes is someone the level's "who" admits;
3. the standing yes lets the action go ahead, with bounds;
4. the use falls inside the bounds, while the grant is active;
5. the use names the grant.

Where a rule declares two or more levels, its last, most deliberate one is always asked: a payment's sign-off is never given in advance. The payment's outcome then reads **allowed in advance**, never "approved", because no one approved this one, and never "not required", because a yes was required. Your product checks all of this; OODS Foundry keeps the setting and shows the outcome.

A cost of this reading: a sponsor cannot say "ask every time, never in advance" for an action no thing's rule covers.

## Eight states

| State | In plain words |
|---|---|
| Requested | Asked for, and not given yet. |
| Active | Given, and it stands. It may stand unused. |
| Paused | It stands, and may not be used until it is resumed. Its end still runs. |
| Revoked | Taken back by someone. Who and why are kept. |
| Expired | It reached its end, or went unused as long as its terms allow. |
| Replaced | A newer grant with other terms took its place, and names it. |
| Declined | It was asked for, and the answer was no. |
| Withdrawn | Its asker dropped the request before an answer. |

The last five are endings, and final: a grant never comes back. A new grant follows it and names it. Paused is the one stop that can be lifted. No ending takes a success colour, and revoked is not a failure: it is the rule working. `Grant` declares this order. Your product enforces it: OODS Foundry keeps it as data, holds its own samples to it, and reads it nowhere at run time. A generated status select offers every state, and a generated app saves any move, a revoked grant back to active included.

**The end, in the party's own day.** A grant to an agent names its end, kept three ways: the exact instant a product checks (`ends_at`), the party's time zone (`timezone`, such as Pacific/Auckland), and one line in the party's own words and zone (`ends_note`, "At the end of 31 Dec 2026, Tauranga time"), written by your product. People read the line: the list, the card and the detail page show it, and the detail page also shows the instant, labelled as UTC. Every other time on a grant's screens, its history included, is UTC. For a grant with no end, your product writes that too ("No end: it stands until someone ends it"); with no line, no end is shown. Showing a record's own times in its own zone on every screen is the next step.

**Disuse** is your product's rule: the grant shows its last use, and a grant that ends unused is expired, with its reason ("Unused for 90 days"). Reconfirmation is not modelled yet.

## "Always allow" is a grant inside a grant

A standing yes for one action is a new grant inside the grant it narrows. It has the same holder and the same party, covers one action, carries its own bounds and end, ends no later than the grant it sits in, and can be ended alone. It is given by someone who may give the first grant, never by its holder; the holder may ask for it. It never names an action the first grant or the holder never allows. Where its action moves money, it carries an amount per use, an amount per period, a count and an end.

## Taking it back

Taking a grant back is one change of its state, to revoked, with the reason: the same step giving took, on the same screen. In a generated app a grant is given by moving its status from requested to active on its form, and taken back by moving it to revoked there, with the reason typed in "Why it ended". There is no Revoke button: your product builds its own, and that button is the next step.

What the record keeps: the grant stays, marked revoked, with who, when and why. What your product does: it withdraws the approvals asked or not yet used under it, pauses or hands on a task under way, and ends the grants inside it. What does not change: work already done stays done, and credentials and payments already issued may still run. OODS Foundry cannot know whether everything stopped. Taking back only the standing yes ends that one grant and leaves the first standing.

A revocation made in a generated app names no one, because the app does not know who is looking.

## The trace on each line

A change made under a grant can say which grant it was, through two optional fields on a history entry (`Stateful`'s `state_history`, `Auditable`'s `audit_log`):

| Field | Holds |
|---|---|
| `grant_id` | the Grant the change was made under |
| `grant_name` | the grant, as shown |

Every history prints the grant after any approval and before the task: **Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · grant: Tidewater invoices and payments · task: Get INV-2026-0155 paid**. A change a standing yes allowed was approved by no one, so its line names the grant and no approver: "Billing Agent for Tidewater Co-op · grant: Resend returned transfers". The grant's id stays in the record's data. It is a pointer, not a link: a generated app holds one object's records, so the line cannot open the grant. In OODS Foundry's samples, every line an agent writes for a party names the grant it acted under.

The task still keeps no field for the grant, because a task gives no authority: in OODS Foundry's samples, each line its doer writes for the party names the grant (see [Tasks as asks](tasks-as-asks.md)).

## The example

Times are UTC, as the records keep them; Tidewater Co-op is in Tauranga, New Zealand.
- **20 Aug, 21:30.** Ruth Adeyemi asks for a grant for the Billing Agent. It is requested.
- **1 Sep, 21:00.** Ruth gives it, as Finance manager of Tidewater Co-op: for Tidewater Co-op, held by the Billing Agent, covering invoices and payments. It looks up invoices and matches payments to invoices with no one asked; it asks first to resend a payment or dispute a charge; it never changes bank details or closes the account. It ends at the end of 31 Dec 2026, Tauranga time. Ruth answers for it.
- **28 Sep, 20:30 to 21:00.** The agent asks first, Ruth approves one resend, and it goes at 21:00 under that one-time approval. Every line the agent writes that evening names the grant.
- **28 Sep, 21:05.** The agent asks whether it may resend returned transfers without asking each time. At 21:12 Ruth gives a standing yes inside the Tidewater grant, "Resend returned transfers": a payment the bank returned, to the same payee for the same amount, with the invoice number in the reference, up to $12,000.00 each, at most $30,000.00 and three a month, until the Tidewater grant ends. It has not been used yet.

A later resend under it needs no new approval: its line names the standing yes, and the payment's outcome reads allowed in advance. It counts for the payment's rule only because `Transaction` opens resends to a yes given in advance.

![The Tidewater grant: who gave it and as what, the three lines, its end in Tauranga's words and in UTC, and its use](grants-as-standing-yeses/grant-detail-light.png)

![A payment's timeline: the resend by the Billing Agent for Tidewater Co-op, approved by Ruth Adeyemi, under the Tidewater grant, as part of the task](grants-as-standing-yeses/payment-timeline-light.png)

## Helpers, and passing a grant on

In this release a helper acts under its own grant from the one the work is for, given by a person. The first agent may ask for it, and the grant records that it asked. Passing part of a grant on, as a grant inside a grant held by the helper, never wider and never longer, ending when the first grant ends and only where the first grant allows it, is not modelled yet.

## The person's side today

The person's side is the Grant list. Search for your name or your organization's to see everything you gave, hold, or have held for you, and filter by state. Each grant's page shows its last use, and its form is where it is taken back. A person's own page listing their grants, a grant's page listing what was done under it, and "agents that can act for you" need OODS Foundry to list the records that point at a record, and a viewer: they are the next piece, shared with approvals and tasks. The list opens on every state: a person can filter it to active ones, and it does not do so by default.

## Bringing your own grant records

Your own consent, mandate or connection records can compose `Mandate` on an object of your own, beside your own lifecycle: the seats, the terms, the end and the use are the fields above, and a place your record holds no value for is left undrawn.

`object_import` proposes `Mandate` where another system's record has a grant's shape, from three facts together: a state with a value in force (active, granted, authorised, valid) beside one that says it was revoked or ended (revoked, expired, ended, terminated, withdrawn, deactivated), a date-time named for an end (`expires_at`, `expirationTime`, `valid_until`), and a single reference to the record of the agent or app that holds it. It binds who holds it, the end and, where the record references them, who gave it, asked for it and ended it and who it is for, and the state becomes the lifecycle; any other `Mandate` field binds only to a field of its own name and type. It never fills a scope or limits written inside the record (FDX's resources, Stripe's usage limits). An import of FDX 6.6's Consent Grant, Stripe's shared payment issued token, ReBIT's consent or GitHub's programmatic access grant gets no `Mandate`, because each lacks one of the three facts, while a team's own flat table, with text ids, gets every seat. The [importing guide](../../packages/foundry/IMPORTING-OBJECTS.md#records-of-a-grant) has the word lists and the measurements.

## What OODS Foundry does not do

It models and renders. It does not check a grant against what an actor does, expire, pause, revoke or renew one, propagate an end, stop a token, or decide whether an action was allowed. No ending is enforced: a grant's status select offers every state, and a generated app saves any move, a revoked grant back to active included. Beyond that:
- In a generated app, a grant is taken back by changing its status on its form. There is no Revoke button: your product builds its own.
- A revocation made in a generated app names no one.
- Screens show times in UTC. The end is also kept in the party's own words and zone, written by your product.
- Money limits assume two decimal places, so a currency with other decimals reads wrong.
- Taking a grant back does not stop what was issued under it, and OODS Foundry cannot know whether everything stopped.
- Uses, the last use, the money spent and an agent's `acts_for` are kept by your product and checked by nothing.
- It cannot list a person's grants on their own page, a grant's uses, or "agents that can act for you": those wait for the next piece.
- A grant passed on is not modelled yet, and reconfirmation is not modelled yet.
- A grant's form also offers fields a person would not edit there: the owner's id, type, name and role, the grant's own id, when it was asked for, and its last event.
- A team's own object named Grant replaces the shipped one, and a team's own trait named Mandate is refused.
