# Changelog

What changed in each version of OODS Foundry, in the terms you use it in.

## 0.18.0

On Grant’s Edit form, “Keep it” and “Pause it instead” restore the saved ending reason and keep unrelated edits. The form shows “Unsaved changes” when the draft differs from the saved grant. A saved result appears below the navigation and clears on the next screen. Task and Transaction start cancellation at “Choose a reason”. A read-only currency beside a money fact has no editor. Approval’s form labels the choice “Answer” and keeps the name of the ask read-only. Its facts appear above the answer.

Owner captions use the same kind labels on cards and dashboards as on detail. Media’s list is labelled “Media”. Organization’s residency codes read US, EU, APAC and LATAM. Approval displays “Sign-off”, its declined article review names Nadia Farouk as the person asked, and its dashboard omits “Asked for” when the requester acts for themselves. The Order Agent’s “Acts for” matches the grant it holds. A related name ending in punctuation keeps that punctuation.

Correction to 0.17.0. Closure has five read-only contexts. Each can generate a single-screen app. Closure has no workflow app.

List rows place each fact’s caption before its value and show the date on a separate line. Closure rows on Grant, User and Organization show the last report, the same instant shown in the Closure list. A team can caption a related row’s time with `time: { field, says }`.

Object and trait definitions keep the exact text of YAML timestamps, including unquoted dates and offsets. YAML merge keys still work. An ended grant with unquoted history dates now shows “Recorded after it ended” and “Its closure”. Classifiable’s created and updated dates in the full `registry_snapshot` reply and the npm runtime’s live `structured_data_fetch` components dataset read `2025-11-18`. The components dataset’s ETag and byte count change with those values.

Correction to 0.17.0. The button rule shipped in generated workflow apps. List rows lost their outlines, and Save took the small button size. Single-screen apps use their component styles.

Charts now draw with a brand whose token intake emits HSL or space-separated RGB. This also fixes generating a Subscription detail screen that includes a chart in that brand.

Storybook component intake locates the package that owns each defining source file. A workspace component can now map from its own package name, exact version and local directory even when the monorepo root has no package identity.

Stage1 0.8.0 captures and redrifts open in the Run and Comparison views. The Run view shows the recorded identification mode and capture completeness, and counts skipped accessibility scans separately. Comparisons read identification mode from the source capture. An older capture can show “not recorded” even when a newer build performed the redrift. A measured declared-presence result can carry zero value-drift signals in drift reports 2.0.0 through 2.2.0. The full `structured_data_fetch` input schema names the new versions. Its advertised tool entry has the same bytes as before.

The runtime dependency update clears 12 npm advisory matches across eight advisories. Both shipped branches of `fast-uri` move past GHSA-333x-w4r6-6crp, GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr and GHSA-xhq7-xmqj-769h. The other four are GHSA-389g-gv7q-r4x8 in `fastify`, GHSA-6pq8-jhm2-2vcw in `qs`, GHSA-rxp7-6hxx-x8q5 in `ip-address` and GHSA-rmxm-3fg6-px4f in `@hono/node-server`. The [security note](SECURITY.md) lists the versions and the two moderate matches still present.

Object definitions returned by the registry can carry display labels as string maps in their field hints. A team object imported with an authored enum label now keeps that label through the adapter’s show reply.

State badges, filters and timelines use the same words. The default label for `still_running` is “Still running”. A field’s own enum label takes precedence, including in timeline transitions and a badge’s accessible name.

A field can supply `ui_hints.valueLabels` for the words shown for a stored value. Agent and Grant use it to explain what “None” means on their detail screens. Their records keep the original value.

New imports of email-address records use the address to label a related record by default. An imported Microsoft Graph contact now shows an illustrative email address in Email Addresses. Source examples and explicitly chosen titles take precedence.

Objects with revised definitions are `Agent` 1.1.1, `Approval` 1.1.2, `Grant` 1.0.1, `Organization` 1.2.1, `User` 1.5.1. Each has a matching entry in its own change history.

Traits with revised definitions are `Actor` 1.0.2, `Approvable` 1.1.1, `Decision` 1.1.1, `Mandate` 1.1.1, `Stateful` 2.5.1, `Timestampable` 1.0.1, `EncodingColor` 0.2.1, `EncodingOpacity` 0.1.1, `EncodingPositionX` 0.2.1, `EncodingPositionY` 0.2.1, `EncodingShape` 0.1.1, `EncodingSize` 0.2.1, `MarkArea` 0.2.1, `MarkBar` 0.2.1, `MarkGraph` 0.1.1, `MarkLine` 0.2.1, `MarkPoint` 0.2.1, `MarkRect` 0.1.1, `ScaleLinear` 0.2.1, `ScaleTemporal` 0.3.1, `ScatterPlot` 0.1.1. The visualization traits now name the chart tool `viz_render`. Closure and its Closeout trait retain their initial versions from 0.17.0.

## 0.17.0

The third part of the Grant story: what became of the work after a grant ended. A grant is a standing yes (0.15.0), a person sees their grants and takes one back (0.16.0), and now a product can record what became of the work after a grant ended, as a record of its own: a closure. Taking a grant back ends the yes, not the work. Only a report should move a closure, a rule your product keeps, and none reads "Closed": the nearest it comes is "Reported closed". OODS Foundry models and shows the record; it writes no closure, tells no one and stops nothing. See [What became of the work](https://github.com/kneelinghorse/OODS-Foundry/blob/v0.17.0/docs/concepts/what-became-of-the-work.md).

**Closure, the sixteenth public object.** `Closure` 1.0.0 is what a product reports became of the work after a grant that was given has ended: one per grant revoked, replaced or expired after it was given; a grant that ended with its outer grant gets none of its own, and your product may name it in a line of the outer grant's closure. It composes `Closeout`, `Stateful` (closing, reported closed, still running, not known and failed; reported closed moves only to failed, and failed is final), `Timestampable` and `Ownerable` for the one who answers for it. It is read-only: it composes a list, a detail page, a timeline, a card and an inline view, and no form, so its pages offer no Edit, no Delete and no move, and no app is generated for it; a request for its form is refused in the words every read-only object's is. Its lines are its history: each names who reported it, and a line that reports without moving the state (a party told, a party's answer, the receipt sent) keeps it. Its page lists the grant and its party as they stand now, what the records here show was still under way when the grant ended (labelled as read from records, not a report), and what was recorded under the grant after it ended. It ships three samples, one for each shipped grant that was given and then ended, resting in reported closed, not known and still running. Your own object named `Closure` is used in its place.

**Closeout, the record trait.** `Closeout` 1.0.0, the 55th trait, holds a closure's facts, each written by your product and shown read-only, as reported: what ended and how and when, who it was for, what the record covers, where it stands, when the product stops waiting for answers, until when access already given may still work, and the receipt as sent. Your own revocation or offboarding record can compose it. On a list row and a card it shows what ended and who it was for; on the detail page every instant is in UTC, labelled so. A team trait named `Closeout` is refused, as every shipped trait's name is.

**Where a closure shows.** A grant's page lists "Its closure" once the grant has ended, with the closure's lines in its row, or says "No closure here is of this grant.": a generated Grant app writes no closure, so a grant revoked there says so at once. A person's page lists "Closures {name} answers for" and "Closures of grants for {name}", and an organization's "Closures of grants for {name}". The generated Grant, User and Organization apps carry the shipped closures as copies, under the note that says so.

**Related lists.** A list can read another record's end from a date-time field of the page's own record, `endedAt: { field, noun }`: its `finality` and `afterEnd` then read that instant, whatever the record's own state, and a row says "When the grant ended: …". A source matched by a field can carry each row's whole history, `lines: true`. A `when` can keep only records that hold a value, `{ present: true }`; a `when` whose value is the word "present" still matches only that word. A row's line can leave a field out for given values, `{ field, except }`. The note under a page's lists says the rows were matched by id where one of its lists reads another of the record's fields through `key`, so a grant's page, whose parties are looked up so, now ends its lists with "These lists show only records here, matched by id; …". See [your own objects and traits](https://github.com/kneelinghorse/OODS-Foundry/blob/v0.17.0/packages/foundry/OBJECTS-AND-TRAITS.md#related-lists).

Changed: an object with one to four samples seeds exactly its samples; it was padded to five by repeating records, which gave every record a made-up id, so a list reading an authored id found nothing. Each record keeps its sample's id where every sample names a different one. An object with five or more samples, or none, seeds as before.

Changed: four states join the shared lifecycle tone table, under names no other record uses: `closing` ("Closing: an end was asked for, and no report yet says what became of it."), `reported_closed` ("Reported closed: a report says nothing more can start under it, for the scope it states."), `still_running` ("Still running: it, or some of the work it covers, is still going.") and `not_known` ("Not known: no report says."). None takes the success tone. `closed` and `unknown` gain no entry, so no other badge changes.

Changed: `registry_snapshot` and `object_registry` reply with compact JSON through the stdio adapter, as the brand template does; the JSON is the same. The registry summary is under 50,000 characters as sent, and so is every public object's `show`.

Changed: a person's "Given for {name} by someone else" lists only the grants that stand, says under its rows that only someone who may give grants for that person should end one and that the app does not check who is asking, and the ended ones move to a new list, "Ended grants given for {name} by someone else", closed until opened. A person's "Grants {name} gave", "Grants {name} answers for" and "Given for {name} by someone else" rows show the last use, as the Grant list's rows now do. A person's two ended lists and an agent's "Ended grants {name} held" list only grants that were given, so a request that expired unanswered is in none.

Changed: a person's "Agents {name} sponsors" row leaves out "None" for an agent that acts for no one ("Support Agent · Active").

Changed: every generated app's own button style leaves the design system's Buttons alone, so a primary and a danger Button read as such before hover (Revoke grant is red at once). A team's mapped adapters keep their own look.

Changed: a form's date-time input says it is in UTC, in its label ("Due (UTC)").

Changed: where a page shows the owner's kind beside its label, it reads as a word: "Owner Type: User", where it read "user".

Changed: in HTML, a list's search label sits above its box, as the Status and Sort labels beside it do.

Changed: an open grant's form labels its note "Why it is ending, if you end it here"; an ended grant's page keeps "Why it ended".

Fixed: the dashboard layout leaves out an empty place the trait asked to leave out, so a grant's and a task's dashboards no longer read "`<seat> unavailable`" for a seat nobody holds.

Fixed: `object_registry` (action `validate`) writes every path one way: a trait parameter's problem reads `traits[1].parameters.actions[2].from[0]`, where it read `traits[1].parameters/actions/2/from/0`, and its message opens with that path.

Not in this release: one closure across several grants, "stop everything this agent does for me", a closure pointer on other records' lines, "Report" actions in a generated app, and an importer rule for closure records. Each page still shows times in UTC, not in its subject's own zone.

## 0.16.0

Taking a grant back ends the yes, not the work. A person's, an organization's, an agent's and a grant's own pages now list the records that point at them, and a generated app can revoke, pause and resume a grant. A revoke asks once first, saying what ends with it and what goes on, and the grant's page then shows what was still under way when it ended. See [The person's side](https://github.com/kneelinghorse/OODS-Foundry/blob/v0.16.0/docs/concepts/the-persons-side.md).

**Related lists.** An object can declare, in `metadata.relatedLists`, lists of the records that point at one of its records, on the page that shows them: a person's "Waiting for {name}'s answer" and the grants they gave, an organization's agents and payments, an agent's work, a grant's grants inside it, what was recorded under it and what is still under way. `User`, `Organization`, `Agent` and `Grant` declare theirs, and their detail pages, standalone and in a generated app, end with the lists in React, Vue and HTML alike: read-only rows, the first five of each, history lines in a disclosure, and one note on what the lists cannot see. Lists read ids, never names. A generated app of one of these objects gains `src/related-data.ts`, with the other objects' records the lists read copied from the samples when the app was made, and `relatedRows` and `store.related(record)` in its store; the app's own records are live. Declared relationships from a team's foreign keys make no lists. Validation refuses a malformed list, naming its path.

**Revoke, Pause and Resume.** `Stateful` 2.5.0 adds `actions`: named moves a person makes on a record, each to one state of the declared order, with its verb, its event, and optionally the field its note is written to, the seat that names who acted, whether it asks first, and the records that make the same move with it. Validation refuses an action whose move the order does not allow, whose event is not recorded, or whose fields the object lacks, naming its path. `Grant` declares Revoke (active or paused to revoked, asking first, ending the grants inside it), Pause and Resume. Every renderer offers each action only from the states it moves from, so a revoked or replaced grant offers none, and `Grant`'s detail no longer offers Delete: an ended grant is kept. In a generated app, Revoke's confirmation names what ends with it, what is still under way, what revoking does not recall, the other grants still held for the party and who is ending it, with an optional note; a move to revoked on the form asks the same. The grants inside a revoked grant end with it, each with its own line.

**A generated app's store.** Every generated app's `store.ts` changes: `createStore` and `createWorkflow` take an optional `actor` (`{ id, name, kind }`), and every line the store writes, Cancel's and an edit's included, then names who acted (`actor_id`, `actor_name`, `actor_kind` on the history entry); told no one, a line names no one, as before. For `Approval`, `Task` and `Grant`, which declare an order, the store refuses a move the order does not allow and any move out of a final state ("This grant's status is Revoked, and that status is final."), and the status select offers the current state and the moves allowed from it, in React, Vue and HTML. An ended grant keeps how it ended: a change to why or by whom is refused, and its form shows why it ended as a fact. Objects that declare no order save as before, and Cancel works as before.

**Who was asked.** `Mandate` 1.1.0 adds `asked_of_id`, `asked_of_name` and `asked_of_kind`, who was asked for the yes (a requested grant waits on them; a grant's page shows them as "Asked of"), and `ended_as`, the capacity someone ended a grant in where they hold none of its seats; your product writes it, a generated app never does. `asked_of_id` and `asked_of_name` are the names `Decision` uses for who was asked, so an object composing both shares them. `Grant`'s order lets a request expire unanswered (requested to expired), and a person's "Waiting for {name}'s answer" lists the grants asked of them.

Changed: the lifecycle tone table's `revoked` reads "Revoked: someone ended it.", where it read "someone took it back", on the title of every revoked badge (the Marlow Yoga and Northwind customer replies grants, wherever they are drawn), and `withdrawn` reads "Withdrawn: the ask was called off.", where it read "Withdrawn by the one who asked"; no shipped sample rests in withdrawn.

Changed: the samples. Northwind Group and Harbor Channel Partners have one id each everywhere, so an organization's owner is the same record its relationships name. Dana Whitfield revokes Northwind customer replies on 8 October 2026 ("Replies go back to the support team") while its task, "Reply about order NW-2207", still needs her answer; the Support Agent's `acts_for` reads None. The Scheduling Agent's retirement and the Order Agent's pause are recorded a minute earlier, while the accounts of the people who made them were still open, the Support Agent's last event is its 8 October update, and the Tidewater grant and the Billing Agent say "twelve days of supervised matching", as their dates do. Task's sample rule for an agent's line now checks that the agent held a grant for the party at the line's time, not its `acts_for` today. Resend returned transfers was asked of Ruth Adeyemi, who gave it.

Fixed: `Transaction`'s and `Article`'s committed TypeScript types include the fields `Approvable` gives them, which they had lacked since 0.13.0.

Changed: one search rule. A list's search finds a record when any text or number in it contains the search, its history's lines included, and never by a field's name, alike in a generated app and in HTML. HTML's search read each record's field names too, so a search for "name" found every row. On Approval's list, "Finance team" now also finds the sign-off approval, whose line says the finance team sent the article back.

Changed: every date-time a record screen shows says the zone it is shown in, "Dec 31, 2026, 10:59 AM UTC", in React, Vue, HTML and generated apps; a date alone says none. The shared date formatter shows a zone the browser does not know in UTC, rather than stopping the screen. A form's date-time input does not say its zone yet. Charts keep their own time formatting. On a grant, "Ends (UTC)" and "Last used (UTC)" read "End time" and "Last used", since their values say UTC, and "Last use" reads "Last used for".

Changed: in HTML, the notice a button shows names it as it reads, "Revoke grant needs your application to act. Nothing was changed.", where it named the handler.

Changed: no form offers a record's own id, when it was created or last changed, or its last event and when. Every form that offered them changes; the owner's fields, where a trait gives them, stay.

Changed: `active` takes the info tone and a dot, not the success tone and its check: an active record is live, not done. Its words stay "Active." Every active badge that reads the lifecycle table moves (Subscription's keeps its own table).

Fixed: a code written in capitals keeps them: a currency select's choices read "GBP", "USD" and "EUR", where they read "Gbp", "Usd" and "Eur", as do "UTC" and the contrast levels "AA" and "AAA".

Fixed: in high contrast, a price in a list row is drawn as text, with no outline crossing its first and last characters.

Fixed: a team's mapped card in a timeline takes no fill of its own, so a mapped React timeline and a mapped Vue timeline read alike in dark, where React's sat on the team's navy card and Vue's on its grey one.

Changed: User's `timezone` and `Timestampable`'s `timezone` parameter no longer say screens render in them: screens show times in UTC, and a shown date-time says so.

Not yet: what was done about the work still under way when a grant ended is not recorded. A page in its subject's own zone, a date-time input that says its zone, reconfirmation and a viewer are not built yet.

## 0.15.0

A grant is a standing yes, not a setting. `Grant` is the fifteenth public object: one set of terms on which one actor may act for one person or organization, as given by one person, until it ends. It records who asked for it, who gave it and in what capacity, who holds it, who it is for, what it covers, its three lines for that party (what goes ahead with no one asked, what needs a yes first, what never happens), money limits per use and per period and a count, conditions in words, its end, its use as your product counts it, the grant it sits inside or replaced, and who ended it and why. A person or a team answers for it, never an agent. Its eight states are requested, active, paused, revoked, expired, replaced, declined and withdrawn; the last five are endings and final, and your product enforces the order. Its terms are never edited in place: a change of terms is a new grant that names the one it replaces. "Always allow" for one action is a new grant inside the first, with its own bounds and end. See [Grants as standing yeses](https://github.com/kneelinghorse/OODS-Foundry/blob/v0.15.0/docs/concepts/grants-as-standing-yeses.md).

The new `Mandate` trait holds those facts, so your own consent, mandate or connection records can compose them. Every place it draws is left undrawn where the record holds no value. On a grant's form its terms and the seats `Mandate` keeps are read as facts and are not edited there; of those, why it ended is the one written there. Taking a grant back is a change of its status to revoked on its form, with the reason: the same step giving took. There is no Revoke button; your product builds its own. A revocation made in a generated app names no one. The end is kept three ways: the exact instant (`ends_at`), the party's time zone (`timezone`) and one line in the party's own words (`ends_note`, "At the end of 31 Dec 2026, Tauranga time"), which the list, the card and the detail page show; the detail page also shows the instant, labelled as UTC. Every other time is shown in UTC. Money limits assume two decimal places.

A recorded change can name the grant it was made under: optional `grant_id` and `grant_name` on `Stateful` history and `Auditable` log entries (`Stateful` 2.4.0, `Auditable` 1.4.0). Every history prints the grant after any approval and before the task; a change a standing yes allowed names the grant and no approver. The id stays in the record's data and is not a link. A history without the two fields reads as before. The payment's resend now reads "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · grant: Tidewater invoices and payments · task: Get INV-2026-0155 paid", and every line an agent writes for a party in the samples names its grant.

`Approvable` 1.1.0 gains `inAdvance`: the changes a grant's standing yes may allow in advance, empty by default, so every change a rule names is asked each time unless your rule opens it. A rule whose `inAdvance` names a change `requiredLevels` does not name, or, where it declares two or more levels, one that needs its last level, is refused, naming the change. A rule that opens changes may add the outcome `allowed_in_advance` ("Allowed in advance: a person set the terms earlier, and no one was asked this time."), which never reads approved.

Changed: `Transaction` is 1.3.0 and opens resends to a yes given in advance (`inAdvance: [resend]`), with `allowed_in_advance` among its declared outcomes. Its level texts are unchanged, only resends are opened, and no sample rests in the new outcome. The Tidewater approval's first line now says why it was created, to ask for a yes before resending, where it said the bank had just returned the transfer.

Changed: `Relationship` is 1.3.0. The `delegation` type stays, as the link alone: a grant with its terms is a `Grant`. Its two delegation samples are `Grant` samples now, so it holds six. Your own delegation records map across mechanically: the source becomes who the grant is for and the target who holds it; the label becomes the name and the description what it covers; proposed, active, paused, terminated and completed become requested, active, paused, revoked and expired; and the actor of the "Granted" line becomes who gave it. `Agent` is 1.1.0: its four rule fields say what they mean beside a grant, `acts_for` restating the grant it holds for each party and asks first meaning a yes, asked each time or given in advance; their values and the samples do not change. `Actor` 1.0.1 names a grant's seats where it named a delegation.

`object_import` proposes `Mandate` for another system's record of a grant, from three facts together: a state with a value in force beside one revoked or ended, a date-time named for an end, and a single reference to an agent's or an app's own record. It binds who holds it and the end and, where the record references them, who gave it, asked for it and ended it, who it is for, and its last use. It never fills a scope or limits written inside the record, and a holder held as a number or a UUID proposes no `Mandate`. The references it binds are not also proposed as an owner or as the record acting for someone, and where all three facts hold it wins over an answer enum's reading as an approval. On FDX 6.6's Consent Grant, Stripe's shared payment issued token (a preview API), ReBIT's Account Aggregator 2.1.0 and GitHub's organization programmatic access grant it proposes no `Mandate`, because each lacks one of the three facts. A team's flat table with text ids gets every seat. The run-as evidence now names the grant it acts under as a `Grant` record.

Changed: where no rule recognises a record, the importer takes its lifecycle from the enum named for its status or state, ahead of one that sorts first, and never takes a date-time named for an end as its creation time. On GitHub's REST description this moves 86 lifecycles, among them the agent task's, from `creator_type` to `state`, and 14 creation times; on Stripe's, 179 lifecycles, among them the payment intent's, from `cancellation_reason` to `status`; on FDX's Consent Grant, its lifecycle from `durationType` to `status`; and on ReBIT's signed consent detail, its creation time from `consentExpiry` to `consentStart`. Each lifecycle moves from an enum that is not a state (a reason, a method, a type, a location, a role and the like) to the record's `status` or `state` enum or, in five records with neither, to one whose name ends so (`lock_status`, `return_status`, `regulated_status`).

Changed: the lifecycle tone table gains requested (info), revoked (neutral: the rule working, not a failure), replaced (neutral) and allowed_in_advance (info). `expired` now reads "Expired: its time ran out.", where it read "never answered in time", and `active` reads "Active.", where it read "Active and in use.", on the title of every active badge that reads this table (Subscription's keeps its own words). A state of any of these names, on your own object or an imported one, takes that tone and these words.

Changed: a money fact on a form now reads as money ("$12,000.00", not 1200000) in React, Vue, HTML and the generated app, as the detail page does; its currency stays in the form's record with no control. An amount's currency alone no longer draws a place that leaves itself out where it is empty. A read-only optional number a sample leaves out is unrecorded, not 0.

Fixed: on a Vue form, a choice or a yes/no that is read only as a fact starts with no value, so a record that holds none shows none, where Vue showed the first choice. This moves the generated Vue of Approval's form and workflow, whose level every shipped sample holds; nothing visible moves there.

Fixed: a reference select never shows another record than the one the record holds. Where the select's options do not list the record's own value, it shows that value first, by the record's kept name ("Elena Park" on Article's form, "Helen Rowe" on PAY-2026-0404's), in React, Vue, HTML and the generated app; a UUID with no kept name reads "`<label> reference not resolved`", and a readable id reads as itself. This moves the generated code of every object with a reference select (Article, Decision, Document, Evidence, Invoice, Transaction, Usage), and Article's form.

Fixed: every text area is four rows in all three renderers: HTML's two paths drew about two, and Vue's Textarea three. This moves the HTML form of most objects.

Fixed: a form keeps a text area for long text: a field named for a summary, a message, details, notes, a reason, a body or the like, a multiline hint, or a length above 240, and a long-text field the form's slots gave a one-line input now gets its text area. A record's name, title or label is one line at any length, and `multiline: false` keeps a field one line. No shipped form moves.

Fixed: a fact an approval's answer screen shows only through a `Dialog`'s own props, or a multi-panel `Tabs`' own props, is refused as hidden (`OODS-V221`), as one inside them is. No shipped screen moves.

Changed: `hono` 4.13.18 and `@hono/node-server` 1.19.19 in the bundled runtime, past six advisories on the versions 0.14.0 shipped (GHSA-jpvv-r467-5p4w, GHSA-3gg2-335m-rxc6, GHSA-46wx-v44x-9hh2, GHSA-4h7h-rv7c-7m2v, GHSA-4m76-xfj5-7975, GHSA-h7mg-cq63-vhpq). None was reached: OODS Foundry runs on stdio and does not load the MCP SDK's HTTP transport.

Names: a shipped object named `Grant` and a shipped trait named `Mandate` now exist. A team's own object named Grant replaces the shipped one, as any team object with a shipped name does. A team's own trait named Mandate is refused: give it a name of its own. `Mandate` shares the names `requested_by_id`, `requested_by_name` and `requested_by_kind` with `Decision` and `Assignment`, so an approval, a task and a grant read alike; a team object that composes two of them gets the composer's warning and the last trait's field.

Not in this release: a person's own page listing their grants, a grant's page listing its uses, and "agents that can act for you", which need OODS Foundry to list the records that point at a record; a Revoke button; a record's own times shown in its own zone on every screen; a grant passed on from one agent to another; a record of what still runs after a revocation; and reconfirmation.

## 0.14.0

A task is an ask, not a ticket. `Task` is the fourteenth public object: one ask to one person or agent to do one piece of work, and what became of it. It records who asked and for whom, who is doing it, exactly what was asked, what the work is about, when it is due, what it waits on, the task it came from and the first ask in its chain, the result in one line, and how many tries there have been, with a line about the last one. Its eleven states (not started, working, needs input, waiting, paused, outcome unknown, finished, failed, declined, cancelled, handed over) follow a declared order whose five endings are final. The one who answers for the work is the task's owner, a person or a team, never an agent: a person doing the work answers for it; when an agent is doing it and a person asked, the person who asked; otherwise the doing agent's sponsor. Eight samples name the shipped people, agents, organizations and approval they are about; the first carries on 0.13's worked example, the Billing Agent's resend of Tidewater Co-op's payment. See [Tasks as asks](https://github.com/kneelinghorse/OODS-Foundry/blob/v0.14.0/docs/concepts/tasks-as-asks.md).

The new `Assignment` trait holds those facts, so your own record of work can compose them. On a task's form, what was asked, who asked and for whom, and who is doing it are read as facts above the status and are not edited there; the result, the due date and what it waits on each get an input. The form also offers fields a person would not edit there, such as the task's own id and the owner's. On a list row and a card, the one doing the work and what it waits on each read as a value over its caption ("Billing Agent", "Doing it").

A view can now leave a place undrawn where the record holds no value for it: `data-oods-omit-empty: true` in the view's props. The row, the list cell, the card line or the form's fact is left out, label and all, in React, Vue and HTML and on a generated app's screens. The closed "Reference details" block at the foot of a detail page still lists each reference, set or not. No earlier view carries it, so every other screen draws as before.

A recorded change can name the task it was made under: optional `task_id` and `task_name` on `Stateful` history and `Auditable` log entries. Every history prints the task after who acted and who approved; the id stays in the record's data and is not a link. A history without the two fields reads as before. The payment's resend now names its task: "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · task: Get INV-2026-0155 paid". `Transaction` is 1.2.2.

`object_import` recognises another system's record of work where the schema says so. A state enum with a working value, a finished value and a value that means a person is needed, beside a reference to the one doing the work (an agent's own record, or a person the schema names as doing it, such as an assignee), proposes `Assignment` at medium. Who asked, the thing, the task it came from, a due date, what was asked, the result and a count of tries are bound where the record has them, and a same-named field of another type is left unbound. Measured on five published schemas: Linear's agent session is recognised; A2A's and MCP's tasks name no one, and nothing in GitHub's agent task references the one doing the work, so they gain nothing. `IMPORTING-OBJECTS.md` has the rule, the grades and how other systems' states read against a task's.

Changed: where the importer recognises a record of work, a reference to the record's own kind is the task it came from and is no longer also proposed as a category tree (`Classifiable`), and the one doing the work and who asked are no longer also proposed as an owner with nothing bound (`Ownerable`). Every other import proposes what it did in 0.13.1.

Changed: in generated React and Vue screens, Cancel follows a declared order for an object that composes `Cancellable` and declares one. It is offered, and the generated store accepts it, only from a state whose declared targets include the state cancelling moves to: `cancelled`, or `pending_cancellation` for a lifecycle that cancels at a period's end. An object that declares no order, `Subscription` and `Transaction` among them, offers Cancel as before. An HTML screen offers it whatever the state.

Changed: an object whose declared order (`transitionRules`) names a state its lifecycle does not declare is now refused where it is validated, registered or imported, and the message names the state; 0.13.1 accepted it. Correct the name in the order.

Changed: the lifecycle tone table gains not_started (neutral), working (info), needs_input (warning), outcome_unknown (warning, not the failure tone), finished (neutral: the doer's word, not a success) and handed_over (neutral). A state of any of these names, on your own object or an imported one, now takes that tone where it fell back to neutral with "Status not found in registry".

Changed: `registry_snapshot`'s default summary cuts each trait's and object's description to its first sentence, so the summary stays under 50,000 characters. `detail: "full"` returns every description whole.

`Stateful` is 2.3.0 and says one thing about who enforces a declared order: your product does. OODS Foundry keeps the order as data, checks it against the lifecycle's states, holds its own samples to it and, in generated React and Vue screens, offers Cancel only where it allows; a generated status select still offers every state. `Auditable` is 1.3.0.

Names: a shipped object named `Task` and a shipped trait named `Assignment` now exist. A team's own object named Task replaces the shipped one, as any team object with a shipped name does, and importing A2A's schema drafts an object named Task. A team's own trait named Assignment is refused: give it a name of its own. An intent that names a task with a screen word, such as "a task list" or "show me the task detail", now composes the Task object.

## 0.13.1

Changed: `design_compose` now refuses a screen that gives an approval's answer without showing who is asking (`OODS-V221`), where 0.13.0 composed it. The `Decision` trait's form views now include who is asking and for whom, so a screen composed from them, and an accepted import's form, still compose. Where your own trait's views or a component override place the answer without those views, place them, or bind a node beside the answer to `requested_by_id` or `requested_by_name`, and to `requested_for_id` or `requested_for_name` when the record keeps them.

Who is asking is the fifth fact on the screen where an approval's answer is given, beside the thing, exactly what was shown, the level and the meaning. The approval's form reads "Asked by" and "Asked for" after the meaning and before the answer, as text that is not edited there; where no one else was named, "Asked for" reads "Not recorded". Who it is asked for is held to the screen only when the record keeps it. A record that keeps no asker is a warning in `design_compose`'s reply (`OODS-V222`), naming who is asking, and the screen composes. An imported asker bound by its id alone is read on the form as a fact, and a requester field your form edited before is now read there, not edited: the product writes who asked. `Decision` is 1.1.0.

A fact now counts only where the answer is given: on the answer's own screen, in the same panel of a `Tabs` that has more than one, and inside the same `Dialog` as the answer, or outside every dialog with it. A fact placed anywhere else is refused with `OODS-V221`, and the message says where it is ("in another tab", "in a dialog", "on another screen"). The rule reads the composed screen's structure: it cannot see the fold, scrolling or styling, or whether the words are true or enough, and a schema passed straight to `code_generate`, `schema_render` or `schema_store` is not checked.

`Approval` declares the order of its states: not yet asked to waiting, withdrawn or not needed; waiting to approved, declined, expired, withdrawn or not needed; approved to used, out of date, taken back, expired, withdrawn or not needed. Every other state is final. Your product enforces the order: OODS Foundry keeps it as data, moves no record and checks only its own samples against it. `Stateful`'s parameter schema now accepts an empty list of next states, which marks a final state, and its description says the product enforces the order and writes `allowed_transitions`; a generated `StatusSelector` still offers every state. `Stateful` is 2.2.1.

The worked example obeys its own rule. What was shown is what a yes approves, so the resend's shown line carries the correction: "Resend $12,000.00 by bank transfer for INV-2026-0155, with the invoice number in the reference". Ruth Adeyemi's comment is now a remark. `Transaction`'s approval level says the shown line carries anything the resend must do differently, and that the yes is used when the resend is sent and recorded, not when the bank answers. `Approval` is 1.1.0 and `Transaction` 1.2.1.

Fixed: a record with no title now reads its state on its own page. Its lifecycle's badge opens the detail header, and the screen's actions follow it, as they follow a titled record's summary. Before, a record with no name and no history, such as Jira Service Management's imported `ApproverDTO`, never showed its answer on its detail page. Every shipped object has a title and composes as before.

Fixed: `Article`'s body was a one-line input on its form, and its numbered steps ran together; it is now a text area that keeps its lines and its required mark, and `Approval`'s comment is a text area too. A required field the form's slots leave out now gets the long-text test a slotted field gets, and a field named for a comment joins those a form keeps as text areas. A form still keeps a text area only for a field whose name says description, reason, notes, body, content, instructions or comment, so long text named otherwise, such as `message` or `summary`, is still a one-line input. No other shipped form moves.

Changed: `fast-xml-parser`, which the OData reader uses, moves from 5.11.2 to 5.12.0 (with `strnum` 2.5.1 and `is-unsafe` 2.0.3), past GHSA-474x-hrwr-fgx4, a low-severity advisory about quadratic CPU use when scanning unterminated stop-node tags. The OData reader drafts TripPin, Northwind and SAP's two published samples exactly as before.

## 0.13.0

An approval is a decision, not a status. `Approval` is the thirteenth public object: one ask to one person or agent for a yes, about one version of one thing, and the answer it became. It records who asked and for whom, who was asked, who answered and for whom, the thing (by its id and a kept name), exactly what was shown, the level of yes and what that yes means, when it was asked, due and answered, and a comment. Its lifecycle is the answer: not yet asked, waiting, approved, declined, then out of date, taken back, expired, withdrawn, not needed or used. One record per approver. Its fields come from the new `Decision` trait, and the thing approved composes the new `Approvable` trait: its rule (the levels it declares, what each level is, which change needs which level, how many, whether the asker may answer, which levels an agent's yes may satisfy, whether a yes lapses) and its outcome, `approval_state` and `approval_summary`, two read-only fields your product writes and the thing's page shows. OODS Foundry shows the outcome; it does not work it out, ask anyone, count approvals, expire an ask or stop a change. The page `docs/concepts/approvals-as-decisions.md` explains the model.

A recorded change can point at the approval it rests on and name its level of yes: optional `approval_id` and `approval_level` on `Stateful` history and `Auditable` log entries. Every history prints the level in its line, such as "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval)"; the id stays in the record's data and is not a link. A history without the two fields reads exactly as before. `Stateful` is 2.2.0 and `Auditable` 1.2.0.

On an approval's form, the screen where the answer is given, the thing, exactly what was shown, the level and the meaning are read as facts beside the answer and are not edited there, on the composed screen or in a generated app. A trait's form view marks a field as such a fact with `fact: true`; no earlier form view carries it, so every other form composes as before. `design_compose` holds every screen where an approval's answer can be given to those four facts: a fact the record keeps that the screen leaves out is refused (`OODS-V221`), and a fact the record does not keep at all is a warning in `design_compose`'s reply (`OODS-V222`) while the screen composes. A list's filter, sort and search are not answer controls. The rule checks that each fact is on the screen; it cannot check whether the words are true, current or enough, whether they are above the fold or behind a tab, whether the meaning suits the level, who is looking, or anything changed in generated code afterwards, and it asks for the same four facts at every level.

The lifecycle tone table gains approved and used (success), waiting (info), declined and out_of_date (warning, not critical: a decline is an answer, not a failure), and not_required, not_yet_asked, taken_back, expired, withdrawn and not_needed (neutral). A state of any of these names, on your own object or an imported one, now takes that tone where it fell back to neutral with "Status not found in registry".

`object_import` recognises another system's approval records where the schema carries the evidence. A record with a single reference to a person or other principal beside an answer enum is proposed `Decision` at medium. An answer enum has an approve value and a reject, decline or request-changes value; any other value is the wait for an answer or how an ask ends. The person is the one asked, and the record's lifecycle is its answer. The asker, the thing, the dates, the comment and the version shown are bound where the record names them, and every other fact stays out. Either fact alone proposes nothing, and the importer never proposes `Approvable`. Accepting the proposal never fails for a fact the source lacks; the warning naming it appears when the answer screen is composed with `design_compose`. A reference wrapped in `allOf` beside annotations, the way OpenAPI 3.0 writes a described reference, is now followed as that reference. A principal's name is read with one technical suffix off (DTO, Model, Entity and the like) and with a plural s, so Jira Service Management's `ApproverDTO` keeps its approver as a link to `UserDTO`, read as a person. Where an enum's first value is an answer, a pending value is now the proposed initial state, so Jira's approvals start at pending. Every OpenAPI 3.0 file that wraps references this way now drafts differently: on Jira's, 174 wrapped references become relationships and three records that had nothing to project now draft. Measured on Jira Service Management, Gitea and Bitbucket Cloud; `IMPORTING-OBJECTS.md` has the rule and the grades.

Changed: `Transaction` composes `Approvable` and is 1.2.0: a resend needs an approval, and each sample says its outcome; the Billing Agent's resend now points at its approval and its history line names the level. `Article` composes `Approvable` and is 1.1.0: a guide or an announcement needs an approval to publish, each sample says its outcome, and "Introducing usage-based billing" was edited after its approval, which is now out of date. Their forms, lists and other screens are unchanged; the outcome reads on their detail pages. `CapturedArtifact`'s detail now reads its provenance rows in the order `Provenanced` declares them: Source, Obtained by, Read from, Record. `catalog_list` names `Decision` and `Approvable` among the traits that place `Text` and `StatusBadge`. A team's own trait named `Decision` or `Approvable` is no longer used, because shipped traits now have those names; a team's own object named `Approval` replaces the shipped one and is reported, as before.

Fixed: binding a trait's fields now carries the name a reference shows. When an imported table bound an id and left its kept name out, as Jira Service Management's approver is, composing its screens stopped with "Invalid reference label" and accepting the import rolled back; the id now shows as itself. A kept name bound under another field name is shown wherever the id is.

Fixed: a form no longer asks for one field twice. A field slot left empty took a field another slot already edits.

Fixed: `object_import` reads Swagger 2.0's `file` type as a binary string. Gitea's API description was refused whole at draft.

Fixed: accepting an import no longer rolls back when a field is named like a built-in member, as Jira Service Management's `ChangeDetails.toString` is.

Fixed: a record that names no identifier is keyed on its first field that can tell records apart, not its first field. An imported approval's answer read "sample-1" on its list and detail previews, because a preview makes its key unique; an enum, a flag or a date is never the key now.

## 0.12.0

An agent is an actor, not a user. `Agent` is the twelfth public object: an AI agent that acts inside a product, with a required sponsor (a person or a team), roles, a lifecycle (draft, active, paused, retired), what it can do, who it acts for, and its approval rules (allowed, ask first, never). It shares one trait with `User`, the new `Actor` trait: the ability to act. An agent is marked "Agent" beside its name in lists, cards and its own page. The page `docs/concepts/agents-as-actors.md` explains the model.

Every recorded change can name who acted, who it acted for and who approved it: optional `actor_name` and `actor_id`, `actor_kind`, `on_behalf_of_name` and `on_behalf_of_id`, and `approved_by_name` and `approved_by_id` on `Stateful` history and `Auditable` log entries. Timelines, audit summaries, state-transition rows and generated apps print them as one line, such as "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi". A history without names reads exactly as before. `@oods/component-contracts` exports the `historyAttribution` helper they share.

`Authable` memberships can name any actor: `actor_id` with `actor_kind` in place of `user_id`, exactly one of the two. Every membership that validated before still validates. `Relationship` gains the `delegation` type, a grant from a person or organization to the agent acting for them; no field is added.

`object_import` recognizes agents where the schema says so. A proto3 JSON enum (A2A's task states) is read as its values, without its `UNSPECIFIED` sentinel, and a `status` field that references a record holding one state enum takes those states, so A2A's `Task` is proposed `Stateful` with its eight states. Owners and sponsors that reference people or groups, run-as and on-behalf-of references, bot or app flags beside an app reference, and enabled flags propose `Ownerable`, `Actor` (as an agent) and `Stateful`, each graded by its structure. A field's name alone stays weak evidence, and nothing is applied without your acceptance.

`structured_data_fetch` reads Stage1 0.7.0's captures: `drift_report` 2.1.0, which counts the deleted .fig tokens a comparison left out, and `fig_local_tokens` 1.7.0, whose text styles record their font weight, line height and letter spacing. Earlier versions stay readable. `registry_snapshot`'s `names` items now carry a description, which directories check for every advertised property.

Changed: `User` composes `Actor` as a person and is 1.5.0; its fields and screens are unchanged. Two of `Relationship`'s sample records are now delegations, in place of two memberships, and `Transaction`'s third sample is Tidewater Co-op's bank transfer, whose history shows the agent's change. A team's own trait named `Actor` is no longer used, because a shipped trait now has that name; give yours another name.

Fixed: a placed chart drawn by ECharts, such as `Relationship`'s graph, now stops growing at 1.25 times its size like every other chart, so its 10px labels never pass 12.5px. It was drawn at up to 1.27 times, because the width caps took the size of Vega's renders, which are 10px larger than requested. The caps now take each render's requested size (292, 720 and 1,120px), so Vega's charts stop growing 12.5px sooner.

Fixed: HTML screens no longer write an owner's role into the element's ARIA role. `OwnershipSummary` and `OwnershipMeta` show the role as text, as they do in React and Vue; the HTML renderer had also written it as `role="Reseller of record"` on Organization's screens and as an empty `role=""` on Relationship's and Plan's.

Newly generated applications pin 0.12.0.

## 0.11.3

`structured_data_fetch` no longer warns of a "Manifest ETag mismatch" on every tokens reply. The release's tokens export and its manifest always agreed, but the server sorted keys such as a colour scale's "50" and "100" differently from the tool that wrote the manifest. The tokens dataset's ETag now matches its manifest, so a cached `ifNoneMatch` value for tokens is matched once more after one fresh read.

The six Mark trait parameter schemas (MarkArea, MarkBar, MarkLine, MarkPoint, MarkRect and MarkGraph) now carry the same chart declaration as the public compose schema: they name `viz_render`, carry no internal tags, and give the chart `source` a type. Validation is unchanged.

The runtime's MCP SDK moves from 1.31.0 to 1.32.2, body-parser from 2.3.0 to 2.4.0 (with Express 5.3.0) and zod from 3.25.76 to 4.6.7. They fix four high-severity advisories: GHSA-22jm-h49p-29qw and GHSA-46jr-4wx8-v453 in the SDK, GHSA-27r3-jxmh-p828 in body-parser and GHSA-mrhx-c7xc-m3w5 in zod. The runtime's third-party closure is 451 packages (it was 453).

Newly generated applications pin 0.11.3.

## 0.11.2

Generated React and Vue applications now pin the OODS release that generated them. Earlier releases kept their application libraries at 0.6.2, so apps missed the current responsive chart styles. New apps receive the current chart breakpoints and bounded sizing. Date-only fields and readable record labels now use the shared library instead of copies in the generator. Standalone apps use a 16 px phone gutter so charts retain native-sized axis labels at 390 px. Phone charts wrap full dates onto two lines and align the edge labels inside the SVG, keeping every payment and refund visible.

Existing apps can keep their original pins. To upgrade, regenerate the app or move all four OODS library pins together. The generated manifest and install advice agree, and a release check rejects pins that differ from the six published packages.

Mapped Vue timeline entries have the same inner padding as React. Other mapped cards retain their layout. The public demo is regenerated with 0.11.2 pins.

The a11y-tools and Tailwind variant package commands now collect their existing suites. Tailwind context variants resolve the current system tokens while preserving explicit token overrides. Release verification runs every package suite and root verification whole, sequentially.

## 0.11.1

Imported screens use the form's reference labels, readable enum words, joined-record titles and field-specific sort labels. The Cal.com Membership demo accepts timestamps and declines role-as-status; roles stay roles. The public demo is rebuilt from the release candidate.

Charts retain authored text size on phones and tablets. Narrow maps and graphs reserve room for legends; placed charts switch between native renders with bounded growth. ECharts JSON carries currency, precision, locale and UTC format descriptors, restored in browsers by `@oods/foundry/echarts.js`. The relationship diagram and heatmap use distinct, grammatical labels. The advertised `viz_render` schema fits Codex's 5,000-byte limit; full validation remains available as an MCP resource.

`structured_data_fetch` keeps full output by default and adds opt-in summary and lossless inline pages (10 entries by default, maximum 100, bounded by serialized size). **Changed default:** filtered `catalog_list` calls without explicit detail return full pages of 10 with `nextPage`; explicit detail preserves previous unpaged output. Owner metadata uses team role names.

Stage1 0.6.0 contract versions are admitted alongside earlier versions. Missing accessibility scores remain absent; stroke eligibility and token alias/mode metadata are shown without regrading. Retire the lossy `tools/stage1-dtcg` adapter: use Stage1's native `dtcg-export`, then review and explicitly accept a `brand_create` draft.

## 0.11.0

Read-only tool actions have their own registered boundaries. Moved actions refuse without writing and name the replacement tool. The default roster is 26 tools; a11y_scan is the 27th on demand. The hosted site's object_registry remains the read tool, with its existing action/allOf contract.

| Previous tool | Read actions in 0.11.0 | Write actions in 0.11.0 |
| --- | --- | --- |
| object_registry | object_registry: list, show, validate, reload | object_register: register |
| schema_store | schema_read: list, load | schema_store: save, delete |
| component_map | component_map_read: list, resolve, show | component_map: draft, apply, create, update, delete |
| brand_create | brand_read: template, validate, derive, show | brand_create: draft, create, apply |
| object_import | object_import_read: show | object_import: draft, apply |
| design_preview | design_versions: versions | design_preview: render, compare, edit, accept |
| schema_render | schema_render: validate, render | — |

Read-only calls may create oversized reply payloads. They never stage drafts, change project files, save definitions or versions, or start a preview host. Drafting remains a write. tokens_build, brand_apply and a11y_scan remain write tools, including their preview modes. schema_store no longer advertises ignored apply flags; component_map removes them on update/delete.

Imported screens choose names and subjects as headings, preserve prose summaries, vary related samples independently, and order shipping dates after order dates. Currency can be explicitly declared when accepting an import. Timelines no longer emit a false missing-extension warning. GraphQL mutation input types remain in the import report instead of becoming record objects.

The complete brand template uses compact JSON to fit Claude Code's inline display. Split input schemas remain below Codex's 5,000-byte compaction threshold. The discovery budget remains 85,000 UTF-8 bytes.

## 0.10.2

- First start: the server answers your client at once while it unpacks its runtime in the background, so Claude Code no longer gives up on a first install (it waits 30 seconds; the unpack can take a minute). Tool calls wait until the runtime is ready. An unpack finishes even if the client gives up, a second start waits for it instead of unpacking again, and folders left by interrupted unpacks are removed. With `MCP_EXTRA_TOOLS` set, the first start still waits for the unpack.
- Charts take inline data only: a chart spec with a `url` or `href` anywhere outside its inline rows, or an image URL in chart options, is refused with `OODS-V126`, which names the field. No chart tool fetches a URL or reads a file because of its input, and a link in a spec can no longer stop the server.
- Tool listings: every tool carries its title in `annotations.title` as well, which directory portals read. Every parameter has a type, and every array says what it holds. Schema ids live at `https://oods-foundry.com/schemas/<file>`. Schema text uses the tools' real names and plain language.
- The server describes itself in `instructions`, which clients such as Claude Code read when they search tools, and it answers `resources/templates/list`.
- Clients: Gemini CLI's added `wait_for_previous` argument is ignored instead of failing validation. A tool schema no longer advertises the custom `oods-brand` format, which strict validators reject. `pipeline_run` and `dashboard_render` advertise schemas small enough that Codex keeps their parameter descriptions.
- `structured_data_fetch` writes an export larger than 100,000 characters to a file and lists it, unless you ask for `payloadMode: "inline"`, as `code_generate`, `schema_render` and `pipeline_run` do. The components export is about 1.1 million characters.
- `pipeline_run` gives warning `OODS-W004` when it writes the page and the generated files to files, as 0.10.1 said it would.
- `code_generate` is marked as able to destroy work: identical output reuses its folder and overwrites the files there, edits included.
- Imported objects: composing a screen from an object that declares no view extensions, such as a fresh import, no longer warns "Available contexts: none". Samples read like real data for titles, handles, display names, roles, departments and categories, and an end or due date falls after its start date. A field the generator cannot place still gets a distinct, numbered label.
- The hub schema that ships beside `IMPORTING-OBJECTS.md`, `object-hub.schema.json`, is the contract the importer checks. From 0.9.0 to 0.10.1 that copy was older: it refused `fieldBindings` and fourteen field annotations the importer accepts, such as `label`, `titleField` and `listColumns`. Packing now fails if the two copies differ.
- Claude Code plugin: the listing has a display name, an icon, and documentation, support and privacy links. Its README gives example prompts, says where the plugin works, discloses everything it runs, fetches and writes, and has a troubleshooting section. Its skill links only files it bundles.

## 0.10.1

- Install lines: the public repository's README installs the current release with `npx -y @oods/foundry`, and its Docker commands name no version. A release check now fails when a release document names an older `@oods/foundry`.
- Release notes: this changelog adds the 0.10.0 entry it shipped without, and a release check fails when it does not open with the package's version. The `@oods/tokens` changelog is up to date.
- Tool reference: TOOL-REFERENCE.md describes every action the tools accept, including the draft, show and apply actions of `component_map` and `brand_create`.
- Counts and measurement versions: the guides count 11 business objects, plus 5 internal capture objects (16 in the runtime), and name the version each measurement was made on.
- Links: the README's guide links open the rendered guides in the public repository at this release. The hosted endpoint is shown as an address, not a link, and the README says how the hosted connector, this package and the Claude Code plugin relate.
- Contacts: questions go to GitHub Issues, or to the address in the license FAQ. Security reports go to the address in SECURITY.md, which now lists the advisory identifiers of earlier fixes.
- Listing: the MCP Registry entry has a title, OODS Foundry, and an icon.
- Compact replies: `registry_snapshot` answers with a summary by default, each trait and object without its schema, view extensions and tokens: about 45,000 characters instead of about 410,000. Pass `detail: "full"` for complete definitions, and `names` to limit them to the traits and objects you name.
- Large output goes to files: `code_generate`, `schema_render` and `pipeline_run` write output larger than 100,000 characters to files and list them, unless you ask for `payloadMode: "inline"`. Warning `OODS-W004` says when that happened.
- Imported samples: objects imported without examples get sample values that read like real data, such as emails, people's names, cities, ISO currency and country codes, amounts and record codes, instead of "email 3" or "cu3". Every value still meets the field's constraints.
- `MCP_EXTRA_TOOLS` accepts the listed name `a11y_scan` as well as `a11y.scan`, and names any entry that matches no on-demand tool.
- Docker: `OODS_FOUNDRY_HOME` now moves everything the server keeps, so the image keeps registered objects, traits, brands, mappings and saved schemas on its `/data` volume across runs.
- A draft or import id that does not exist gets an error naming the id and saying to draft again, instead of a file-system error.
- `health_check` and `catalog_list` name build-record receipts by file instead of citing paths that are not in the package.
- The design preview page is titled "OODS Foundry design preview", and the server's own information carries the title, website and icon.

## 0.10.0

- `component_map` drafts mappings from a local shadcn/ui or shadcn-vue project, or from a built Storybook. `show` lists each proposal with its evidence and prop translations, and what stayed unmatched; `apply` writes only the proposals you accept, all at once. Drafting never runs project code or fetches anything.
- `brand_create` drafts a brand from a local DTCG token file and keeps your token names, aliases and light and dark values in the CSS of generated apps. `show` and `apply` review and accept it. Values it cannot use are reported, and token names alone never decide which OODS slot a token fills.
- Sixteen shadcn-vue adapters on Reka UI ship under `shadcn/vue/`. Vue previews and routed workflow apps use your mapped components, and the React and Vue registry files can be installed from version-pinned URLs. React Aria is still not supported.
- Imported objects bind accepted traits to their own fields. Related-record labels, enum and array samples, OData text references, lifecycle controls and timestamps read better, and unsupported trait facts and empty panels are left out.
- The contrast of static button states and the non-text contrast threshold for progress indicators are corrected. Accessibility reports keep the results that were not measured or are incomplete.
- Fixes empty Vue filters, saving and reopening custom controls, style collisions between team controls, and badge semantics for assistive technology. React and Vue Membership workflows from Cal.com's public schema were rehearsed in public shadcn projects using Primer token names, at 1440 and 390 pixels wide in light and dark.

Generated apps still pin the tested 0.6.2 set of OODS libraries. A component proposal is structural evidence, not proof of behaviour; Storybook entries without a local defining source stay unmatched.

## 0.9.0

- The default roster remains 20 tools. Its compact `tools/list` is 82,520 UTF-8 bytes (0.8.0: 82,191), measured from the JSON tool array.

- Import Postgres DDL and ordered Prisma, Drizzle, Flyway or golang-migrate migrations, including keys, constraints, comments and read-only views.
- Import Prisma models and multi-file schemas with relations, native types, source mappings and declared defaults.
- Import dbt manifests and properties folders, including column tests, static semantic declarations and snapshot history. No SQL or Jinja is evaluated.
- Import OData v2/v4 CSDL XML or JSON with declared titles, list columns, detail sections, display text, currency, value lists and read-only capabilities.
- Import GraphQL SDL or introspection with enums, input objects, relationships and declared scalar formats. Resolvers are never run.
- Every format uses the same draft/show/explicit-acceptance flow. Trait suggestions now use structural and declared evidence across the trait library; counts include each proposed trait. Accepted-trait fields are distinguished from source removals on re-import.
- Imported screens use record titles or identifiers, varied valid samples, source help, date-only formatting and relationship pickers. Lifecycle/history traits add timelines; read-only sources omit forms. Hand-written objects can declare list columns too.
- Unreachable references are reported and skipped without fetching them. Folder escapes still refuse the import. Streamed, hashed staging handles large schema sets without building one giant JSON string.

## 0.8.0

- npm package repository and issue links now point to the public Apache-2.0 source. The first-change quickstart uses `object_registry` throughout.
- The eight pre-0.7 tool-name aliases are removed; use the names listed by your client.
- Generated application library dependencies remain pinned to 0.6.2, their retained tested implementation. Those pins move only with a separately measured library update; the tool release version does not change them.
- The 200 retained runtime cells are a projection of the 0.4.1 sweep onto the current public objects. They are not a new 0.8.0 runtime sweep.
- Adds a Docker stdio image and the importer contract, hub schema and export recipes.
- Updates the bundled MCP SDK to 1.31.0 for GHSA-6qxp-vccf-f47h.

- Adds `object_import` with draft/show/apply. The default roster grows from 19 to 20 tools; its compact `tools/list` is 82,191 UTF-8 bytes (previously 79,716), measured from the JSON tool array.

- Object validation now checks trait parameter values against their parameter schemas, including defaults and cross-parameter enum membership. Invalid values are errors; shipped objects remain valid.

## 0.7.0

- Tools have consistent names, short titles, complete behavior hints and descriptions that explain when to choose a related tool. Full input schemas remain available on demand; server validation is unchanged.
- The initial tool list is smaller. The detailed parameter and return reference ships in TOOL-REFERENCE.md.
- OODS Foundry ships 11 business objects, plus 5 internal capture objects (16 in the runtime). The 12 research, delivery and intelligence objects are no longer shipped.
- The Claude Code plugin includes installation instructions and a README. OODS Foundry remains free under Apache-2.0.

### Tool renames

| Previous name | Current name |
| --- | --- |
| `structuredData_fetch` | `structured_data_fetch` |
| `brand_intake` | `brand_create` |
| `pipeline` | `pipeline_run` |
| `health` | `health_check` |
| `map` | `component_map` |
| `schema` | `schema_store` |
| `object` | `object_registry` |
| `repl` | `schema_render` |

Old names answered with a warning through 0.7.x; those eight aliases are removed in 0.8.0. Existing objects, traits, brands and mappings remain compatible.

## 0.6.2

- The ECharts adapter honors declared number formats and currency on axes and tooltips, and caps categorical bars at 48 pixels with the existing exclusions. The bar cap survives MCP JSON; money formatting still requires consumer-provided formatters because JSON does not carry callbacks.
- A standalone Subscription component chart uses the same authored sample as its preview and application: eleven EUR payments, including the refund, matching the header and payments panel.
- OODS-V218 now explains both unmet component contracts and React-only shadcn mappings that keep the OODS Foundry component in Vue or HTML output; the components guide names that behavior.
- Source verification keeps explicit measured time limits, gives nested claims checks enough time under load, and reports an ignored stale package instead of checking its license against a newer source tree.

## 0.6.1

- Destructive shadcn Button, StatusBadge and Banner text uses solid backgrounds and foregrounds from the team's tokens. The Radix and Base UI fixtures measure 4.77:1 in light and 6.85:1 in dark. This fixes the reported light-theme Delete (3.98:1) and Past Due (3.66:1) cases.
- Native trait-form placeholders keep the input placeholder token at full opacity when a host stylesheet supplies translucent placeholder text.
- Copied shadcn sources compile in their consuming projects.
- A first shadcn preview accepts the composition's returned version before a package snapshot exists. Already frozen previews keep their stored bytes.
- COMPONENTS.md installs the local OODS Foundry package before its adapter files are used, and gives the tested Vite/Radix and Next.js/Base UI routes through derive, map, compose, preview, generate and run.
- OBJECTS-AND-TRAITS.md explains why Plan's equivalent period date fields can select DatePicker and native date Input during form composition.
- Narrow payment charts keep date labels horizontal and omit overlapping labels, leaving room for the plot while preserving every payment and its full accessible date.
- Governed line and area samples group the existing A/B categories into separate series, removing vertical joins between unrelated observations.

## 0.6.0

OODS Foundry is an object-oriented design system that extends the one you already have.

- Dark previews, standalone documents and generated application shells set the `dark` class beside `data-theme="dark"`. Component output names that ancestor requirement; shadcn parts keep their light palette in high contrast.
- React component output declares only the bindings it reads, so generated screens pass the shadcn Vite template's strict unused-code checks. Rich Tabs panels keep state and dismiss guards as valid TSX and JSX.
- Brand derivation finds light theme declarations inside nested `@layer` and `@media` blocks and selector lists. Metadata-only mapping updates work after the source project moves. Unquoted CSS imports and local fonts are hashed and copied into generated apps; binary files declare base64 encoding in inline artifacts and decode in file payloads.
- Vue and HTML generation warn when dropping React-only shadcn mappings. Payment-list numbering survives Tailwind preflight. Built Tailwind CSS filenames can depend on the surrounding git checkout; the generated artifact's content hash stays stable.
- shadcn/ui supports the Radix and Base UI bases. React Aria and unknown styles are refused at map creation with OODS-V219. The preview handles CommonJS dependencies that use its React runtime; Select, Tabs and Pagination preserve labels, selection and link semantics on both supported bases.
- Dependencies resolve from their importing files, including pnpm's isolated layout and hoisted npm workspaces. Tailwind 4 works through Vite or PostCSS. Mapped component output begins with `'use client'` for Next.js App Router; application output remains a Vite app. Yarn PnP, Bun and Turbopack-only development servers are not proven.
- Sixteen shadcn adapters ship in one mapping file: the original eight plus Input, Textarea, Checkbox, DatePicker, TagInput, StatusSelector, CardHeader and PriceBadge. COMPONENTS.md names each adapter's limits, the layout and text components that stay OODS, and why trait-panel internals are not substituted. Contract reports remain advisory. Vue shadcn sources, React Aria, shadcn workflows and a hosted shadcn registry remain outside this release.
- Form headings use the screen title instead of an arbitrary numeric field. Generated app native date controls follow the chosen theme. DatePicker and Checkbox keep native uncontrolled values and form-reset behavior.
- The README links the website, trait-change and Harbor demos, chart playground and the website's read-only MCP endpoint with its allow-list. The MCP Registry entry includes the website URL and Streamable HTTP remote.

## 0.5.0

- React mappings accept a shadcn project and module on the Radix base with Tailwind 4. Creation and update check the export and its imports. Preview uses the project's theme; generated applications carry the source files, aliases, CSS and exact dependencies they need, and component output imports the project's module.
- Eight shadcn registry adapters ship for Button, Card, StatusBadge, Tabs, Select, SearchInput, PaginationBar and Banner, with a mapping file and explicit compatibility limits. Contract reports name met, unmet and unchecked obligations.
- `brand_create` derive reads a shadcn CSS theme as text or an absolute file path and returns a recipe with custom-property provenance and gaps. The DTCG path remains supported.
- A mapping may rename a catalog event such as Button's `onActivate` to `onClick`; event value maps are refused.
- Explicit colour alpha 1 is opaque during brand derivation. Neutral hue medians wrap around the colour circle.
- Mapping lists refuse case-variant duplicates; saving through a symlink preserves the link and writes its target, while a dangling link is refused.
- Compare reports a tab rename once without reporting its unchanged fields as moved.

## 0.4.6

- Compare matches fields by their identity and place on screen. Inserting a field no longer reports unchanged fields as removed and added because their node counters shifted.
- Killing the launcher closes its native children and the consumer connection; finished tool calls clear their timers, and the adapter relays child stderr through its own pipe.
- Dashboard panels and each chart render in generated screens scope their SVG identifiers and style selectors independently.
- `component_map` create accepts `mappings` or a checked JSON `mappingsPath`, validates every entry before one write, and reports each entry's outcome. Duplicate component mappings and invalid local package exports fail at creation.
- `brand_create` derive accepts a team's DTCG tokens, resolves aliases, and returns a recipe with each value's source and any gaps. It writes nothing; review the recipe before creating the brand. Team token names are not carried into generated apps.

## 0.4.5

- `design_preview` compare now reports changed props on and inside slots and changed object-definition fields in a
  new `definition` category. Different schema hashes can no longer receive an “identical” answer; a screen may
  stay visually the same while its definition changes.
- Temperature fields ending in `_temperature_c`, `_temperature_f`, `_temp_c` or `_temp_f` now read “(°C)” or “(°F)”.
  Other fields ending in `_c` or `_f`, such as `option_c`, keep ordinary wording. Other unit labels are unchanged.
- The security note names this release, and all package guides use the OODS Foundry name.
- The QUICKSTART opens with 23 calls that change one trait, compare four screens, and restore the original.
  ColdRoom ships beside Warehouse with authored example values. Compare prepares both screens so its links open
  even when the versions have only been composed.
- GENERATED-APPS.md explains which generated files to replace, where application wiring belongs, and how to
  compare file hashes and action contracts. Generation produces complete output; it merges nothing and detects
  no edits. Generated applications and workflows include a README pointing to the guide.

## 0.4.4

- Chart-accessibility results now emit `OODS-A11Y-R-NN`. Agents matching `OODS-A11Y-A11Y-R-NN` must use
  the new spelling; each of the 16 entries in `errors.json` lists its historical spelling in `aliases`.
- Definition validation and registration refuse declared conflicts between unbound traits and non-semantic
  header versions. These change an agent's result from valid to invalid. Bound chart marks stay exempt,
  and previously stored definitions continue to load. Unknown top-level keys warn with the nearest spelling.
- Run records add `capture_note`; the screen says "Capture note" over its recorded capture settings.
  `auth_provenance_note` remains in records for existing readers but is unavailable to views.
- Media labels its dimensions "Width (px)" and "Height (px)". Only the closed list of trailing unit tokens
  receives parentheses; other shipped field labels retain their wording.
- The guides consistently say OODS Foundry and explain that a new process draws its first chart more slowly.
  The adapter's startup line identifies the runtime version and digest without naming its host directory.

## 0.4.3

- A trait's status badge on a detail page says what it describes, including when the object has no Stateful trait.
  A ColdRoom made with Stockable now shows "Stock level" beside "Full", with its record fields in order. Header
  status and grouped detail fields keep their existing presentation. This changes the composed schema and generated
  code for previously unlabelled trait badges; Warehouse's existing label is unchanged.
- `viz_render` accepts `output.includeVegaSpec: true` and returns `vegaSpec`, the exact Vega specification used to
  draw its SVG, including high-contrast symbol legends and requested sizing. `spec` remains the Vega-Lite source
  before those renderer adjustments. The default output, SVG and chart content hash are unchanged.
- The package ships `errors.json` beside `facts.json`. Each runtime code has its severity, canonical message, cause,
  fix, retryability and the tools whose shipped module graphs can return it. Reserved codes are identified separately.
  The API reference's error tables come from this data.
- A handler timeout now returns retryable `OODS-S002`; an unexpected exception returns `OODS-S003`. An agent matching
  the former literal `BAD_REQUEST` must use the OODS code instead. The optional HTTP bridge keeps its transport codes.
- Stage1 0.4.0 captures open in the run view: `run_manifest` 1.7.0, `a11y_report` 2.5.0 and accessibility evidence 1.4.0
  are admitted by Stage1's committed contract at release source `08c73e0d37b06da71f10329d4619c17c25541f04`,
  confirmed against its final capture and analysis. The capture label states the recorded stage, sampling depth, Stage1 build and browser;
  fields absent from older captures remain unknown. Unreviewed versions remain refused.

- Stage1 0.4.0 comparisons also open: analysis 1.1.0, drift report through 1.4.0 and design tokens 1.5.0.
  The view distinguishes exact matches from separately explained values, labels the 1.4 measurement, follows
  recomputed fingerprint provenance and shows spacing and shadow signals.

## 0.4.2

Every finding the website and the 0.4.1 review reported, fixed, and the sentences that describe OODS Foundry made exact.
Nothing was removed.

**Upgrading**

- A brand made at 0.4.1 loads and renders as before. One made from the dark-minimal preset now fails `brand_create`'s
  chart grading: its light theme's series 3 and 5, inherited from brand A, measure 2.15:1 and 1.74:1 on its dark canvas.
  `brand_apply` refuses a change to it until the change sets those two colours, and says so. Making the brand again
  from the 0.4.2 preset sets them.

**Screens**

- The Tabs "More" button and the items in its menu look like tabs: no grey browser-button fill or bevel, the tab's
  secondary text that hover raises to primary, and the tab's focus ring, in light, dark and high contrast. The open menu
  floats under the button instead of pushing the tab row down. React and Vue write the same markup for it
  (`data-tabs-overflow-trigger`, `aria-current="true"` and both class families).
- A detail page no longer shows an Archive Summary that only says "Archived: No", or a Cancellation Summary that only
  says "Cancel at period end: No". The card appears once a record is archived, or has a cancellation scheduled or
  recorded. ArchiveSummary and CancellationSummary take a new prop, `hideWhenDefault`, which Archivable's and
  Cancellable's detail recipes set, in React, Vue and HTML.

**Charts**

- Line and area charts keep their rows' order on a category axis, so rows for Jan and Feb no longer draw as "Feb, Jan"
  and a rising line no longer reads as falling. Bar charts, a declared sort and a time axis keep their order, and a
  declared `sort: "none"` now compiles to the rows' order.
- An exported dashboard (`dashboard_render` with HTML) draws each Vega chart a second time at 332×180 and shows it
  below 600px, so on a phone its axis text draws at its authored size: 10px, where it drew at 5.5px. Desktop pages are
  unchanged. ECharts panels, such as the maps, still scale down with their panel.

**Brands** (`@oods/tokens`, `@oods/foundry`)

- The three presets carry chart colours made from their own recipe, 27 slots per theme beside their 69 colour roles.
  dark-minimal's charts now read at 3.87:1 to 14.95:1 on its dark canvas in its light theme too, where they started
  from brand A's light palette.
- `brand_create` grades each theme's one-series chart colour and six categorical series at 3:1 against the theme's
  canvas, beside the 84 pairs it already grades. `validate` and `create` report them under `charts`; a failing colour
  says whether the brand authored it or inherited it from brand A; and `create` refuses a brand whose chart marks would
  not read (OODS-V216).

**Guides, notices and tool descriptions** (`@oods/foundry`)

- The licence sentences say exactly what applies. OODS Foundry's code is under the Apache License 2.0. The fonts it
  bundles (Geist, Geist Mono and DM Sans) are under the SIL Open Font License 1.1, and its colour scales adapt Radix
  Colors (MIT); NOTICE carries both. What OODS Foundry generates is still yours under any terms you choose, and the
  bundled fonts stay under the SIL OFL 1.1 wherever they go.
- Generated HTML that embeds the fonts carries their copyright lines and the SIL OFL 1.1 text in its stylesheet. It
  said "see NOTICE", and a standalone page has no NOTICE beside it. A page grows by about 4 KB.
- `viz_render`'s description says the input schema refuses the retired linked-brush-scatter pattern with OODS-V001.
  OODS-V174 is what a caller that skips the schema gets.
- `code_generate`'s description says a generated application pins the @oods packages its code imports; `@oods/tokens`
  arrives through `@oods/component-styles`.
- OBJECTS-AND-TRAITS.md documents `ui_hints.format` (percent and quantity) and `ui_hints.component` (Switch,
  SegmentedControl and Combobox in generated forms). The README and QUICKSTART name `facts.json` and
  `quickstart/expected.json`.
- npm shows the package's whole description. At 284 characters, npm stored it cut at 255; it is now 249.

**Release data** (`@oods/foundry`)

- `health_check` reports 0.4.1's runtime measurement, 356 of 356 cells, stamped as measured on 0.4.1, and says it was not
  made on this build (`thisBuild: false`). 0.4.1 reported the measurement made on 0.3.0.
- A measurement's `measuredOn.sourceHead` is the commit it was measured at. The chart census is stamped in the
  release's last commit, and a commit cannot record its own hash, so the census names that commit's parent, which
  differs from it only by the stamp and `facts.json`.

## 0.4.1

0.4.0's screens and charts, polished; two new components; and the numbers people quote about OODS Foundry, shipped in the
package as data. Nothing was removed.

**Screens**

- A card's price, owner and tags sit in its body under the title and status, on the title's left edge. They were in the
  footer, which is end-aligned for actions, so they sat indented or flush right. The body no longer adds a second 24px
  inset, and a footer left empty is removed, so a card ends where its content ends.
- Ownership on a card is one phrase: "Owned by Pricing and packaging · team". With no name to show, it reads by type
  ("User-owned"). OwnershipMeta takes the owner's name in a new `ownerLabel` prop; it read "Ownership  Owner Type: team".
- A card shows its tags as pills, at most three and then "+N", as its list row does. It showed a "Tags" heading over a
  "Tag Count" row.
- An event card with no events renders nothing in React, Vue and HTML, so the "No events recorded" cards are gone.
  ArchivePill and CancellationBadge take a new prop, `hideWhenFalse`. Archivable's and Cancellable's card recipes set it,
  so a card no longer shows "Not archived" or "No cancellation scheduled"; an archived or cancelling record still says so.
- A field can declare how its number reads with `ui_hints.format`: `percent` (12.5 reads 12.5%) or `quantity` (86420
  reads 86,420). React, Vue and HTML print the same text. A number that declares nothing keeps the digits it was stored
  with. Usage's quantities read grouped and its trend with its % sign.
- Usage has a `currency` field, and each of its samples is billed in its subscription's currency, so its money reads
  €97.00, where it read a bare 0.
- HTML writes Text as a `span.oods-text`, as React and Vue do (it was a `p`), so a text row on an HTML detail page sits
  like a money row.
- An address panel on a single screen shows the record's addresses through its summary, and says "None recorded" when
  there are none.

**Charts**

- Money in a chart is money. A chart binding can carry an axis number format (`format`, a d3-format string) and a
  currency (`currency`, an ISO code), and the axis prints the currency's symbol: $, € and £. Invoice's line items and
  Subscription's payments are drawn in major units on an axis in the record's currency. They were drawn against
  0–1,000,000 "Amount (minor units)". A missing or invalid currency code fails generation; it printed "in UNDEFINED".
- A bar on a category axis is at most 48px thick and centred in its band. One line item used to draw one bar across the
  whole plot.
- No chart in the shipped objects is titled or captioned "Example" or "Synthetic". Usage's chart is "Usage readings",
  with each record's unit ("API calls") as its y axis title, through a new `titleField` on a declared binding.
- An exported dashboard's charts shrink to their panel, so at 390px the page no longer scrolls sideways.
- High-contrast bubble maps use the grey steps 05, 07 and 09. The smallest bubbles were about 1.2:1 on white.

**Components** (`@oods/components-react`, `@oods/components-vue`, `@oods/component-styles`, `@oods/component-contracts`)

- **SegmentedControl:** one choice from two to five options, drawn as joined segments, in React, Vue and HTML, at the
  button's four heights. It is native radios in a named radio group, so the arrow keys move the choice, Tab leaves the
  group, and HTML needs no script. Labels are never cut: five options at the large size need about 381px, so on a phone
  use md or smaller for five.
- **Combobox:** one value picked from a list you filter by typing, in React, Vue and HTML (HTML's behaviour is an inline
  script scoped to its element). Down opens the list and moves, Enter picks, Escape closes, and a second Escape clears; a
  disabled option is skipped. Its `name` submits the chosen value, never the typed text. It has no multiple selection,
  async loading or creatable values.
- 114 governed components (0.4.0 had 112), each with a contract, a shared scenario, a docs page and gallery rows.
- A generated form edits a field with a Switch, a SegmentedControl (an enum of two to five options) or a Combobox when
  the field's semantics ask for one (`ui_hints.component`), and a generated workflow saves the value. Booleans still
  default to Checkbox and enums to Select.
- An HTML Switch toggles on a click, a click on its label, Space and Enter.
- While a modal Dialog is open the page does not scroll, and on close its own overflow and padding come back exactly. A
  backdrop click closes it, and in HTML its close button does.

**Guides and notices** (`@oods/foundry`)

- BRANDS.md and the theming guide describe the 0.4 brand template: 103 slots in light and 96 in dark and in high
  contrast (they said 49 and 75), how to make a brand from a recipe, and the 84 pairs grading checks in each theme.
  `brand_create`'s own rules now name the control borders and the focus ring among the pairs it grades at 3:1.
- OBJECTS-AND-TRAITS.md documents `samples:`, says `object list` leaves the internal objects out unless asked with
  `includeInternal`, and names Node 24.6.0 and 22.0.0 for the team journey it reports.
- The README explains `dashboard_render`, and its brands paragraph names the recipe flow.
- The NOTICE in `@oods/foundry` carries the SIL Open Font License text and the copyright lines of DM Sans, Geist and
  Geist Mono, which the runtime it carries includes. They were only in `@oods/tokens`' NOTICE.

**Release data** (`@oods/foundry`)

- `facts.json` holds the facts people quote, each with its source: the supported platforms and clients, the install
  command, the plugin's marketplace and install commands, the MCP registry name, `artifact_certify`'s 16 accuracy rule
  codes and 16 equivalence rules, and its certified chart scopes with the census they come from. A check fails the
  build when the README or the tool's description says otherwise.
- `quickstart/expected.json` holds the hashes the documented quickstart produces: the React and Vue apps' and the
  chart's. They come from two release-candidate runs on Node 24.6.0 and 22.0.0, and the release proofs run the packed
  quickstart against them and fail on any difference.
- The runtime manifest records each library tarball's SHA-256 beside its version (`packageTarballs`).
- `health_check` says what each measurement was made on: every product-reality block carries `measuredOn` (the version,
  source head and archive it ran on), and the viz block reports its certified chart types and scopes. A measurement
  older than 0.4.1 says so.

## 0.4.0 — published 2026-09-30

The design reset: OODS Foundry's own output now looks like a product next to shadcn/ui, Radix and Geist.

**Upgrading**

- A brand made from the 0.3 brand template must be made again. The template has 103 slots for the base theme and 96
  each for dark and high contrast (0.3.3 had 49, 75 and 75), and a brand's roles now come from a recipe. Ask `brand_create` for a `template` with `from.recipe` (six
  values: neutral hue and chroma, accent hue, which hue is primary, radius and font) and it returns the complete brand,
  graded, with every adjustment it made.
- Custom properties were removed or renamed; the lists are under **CSS custom properties** below.

**Colour, type and shape** (`@oods/tokens`)

- Every hue is a 12-step scale with a job per step, in light and dark, calibrated on Radix Colors (MIT; see NOTICE).
  Brand A is neutral-first: a near-black primary, a white canvas, grey structure, an indigo accent, Geist, and 6px
  controls with 12px cards. Brand B is the same neutral with a violet primary, DM Sans, and 8px and 16px corners.
- A type scale: display 80, 64 and 48; headings 30, 24, 18 and 16; body 16/24 and 14/20; label 14/20 at 500; caption
  12/16 at 500, no longer uppercase; mono 13/20. Geist and Geist Mono ship in the package, beside DM Sans.
- Controls are 24, 28, 32 and 40px tall with 8, 10, 12 and 16px of side padding; cards have 24px padding and a border
  (no shadow); overlays have a soft shadow under their border; dark surfaces lift with rings.
- High contrast: only the primary action is Highlight on HighlightText. Every other intent is Canvas and CanvasText
  with a 1px CanvasText border, and destructive actions keep their ⚠ mark.
- Grading checks 84 pairs per theme (it checked 65): control borders at rest and hovered, the focus ring on the canvas,
  a raised panel and the primary, and text on the secondary, destructive and solid status fills.

**Components** (`@oods/components-react`, `@oods/components-vue`, `@oods/component-styles`, `@oods/component-contracts`)

- Buttons at the control heights, in six intents; neutral is the outline look.
- Badges are borderless 20px pills in the tone's tint; solid badges are the tone's solid with its own text colour.
  Status marks are OODS's own SVG icons in React, Vue and HTML.
- Status tones come from one table shared by React, Vue and HTML, now with a lifecycle table for the states objects
  use: a settled payment is green, a failed one red, a pending one blue. They were grey outside the subscription and
  invoice tables.
- Tables sit in a bordered container with a caption, muted headers and 44px rows (36 compact); fields, tabs, headings
  and panels are on the type roles.
- Switch and Dialog are new, in contracts, React, Vue and HTML: 112 components.
- The HTML renderer writes React's markup for Button, Badge, StatusBadge, Banner, Table and lists, so HTML looks the same.

**Charts**

- Each brand's charts use its own palette, from its recipe: brand A leads with indigo and brand B with violet. Marks
  keep 3:1 against their background in every theme, and dark ladders are brightest at the high end.
- A generated app's charts carry light, dark and high-contrast renders and show the one for the page's theme.
- A chart given no size fits 300px tall for up to 12 categories, with date labels level when they fit.

**Screens**

- Lists are one bordered list with hairline dividers. Each row shows the record's title over a muted secondary line,
  with its status, its amount and its time on the right.
- A detail page opens with the record's title, its status and key amount, and the actions on the right. Each section
  sits on the page or on one card, never a card inside a card.
- Cards are titled by the record, with its status and its amount.
- A timeline lists the record's own events on a rail: its history, payments, creation, archive and cancellation
  request. The "State transitions", "Archive events" and "Cancellation event" sections are gone from timelines.
- Every row button is named by the record's title for screen readers.
- An empty time reads "Unknown time" in React, Vue and HTML.

**Objects and traits**

- The 11 business objects (User, Organization, Product, Subscription, Transaction, Relationship, Article, Media,
  Invoice, Plan and Usage) carry 8 realistic sample records each, in a `samples:` list your own objects can use
  too. Generated apps and previews show them; nothing is invented.
- The 17 objects that model OODS's own research and delivery work are marked internal and left out of `object list`,
  `catalog_list`, `structured_data_fetch` and `registry_snapshot` unless you ask with `includeInternal`.
- Stateful, Archivable and Cancellable no longer declare timeline recipes, nor do Timestampable, Addressable,
  Preferenceable, Authable and Communicable. The billing traits declare their amounts for rows, headers and cards.

**Tools**

- `code_generate` says how a generated app installs its packages: from npm, at the exact versions its install block
  names. A generated workflow's `package.json` lists every package the app imports.
- The package README's Limits section states each tool's rate limit, read from the server's policy.

**CSS custom properties**

Removed from `@oods/tokens` (90):
- `--ref-color-{accent,archive,critical,info,success,warning}-{50,100,200,300,400,500,600,700,800,900,950}`: each
  family is now the 12-step `--ref-color-<family>-1` to `-12`, with `--ref-color-<family>-dark-1` to `-12`.
- `--ref-color-neutral-{0,50,100,200,300,400,500,600,700,800,900,950}`: now `--ref-color-neutral-1` to `-12` and
  `--ref-color-neutral-dark-1` to `-12`.
- `--ref-color-primary-{50,100,200,300,400,500,600,700,800,900,950}`: a brand's primary is one of its scales
  (brand A's neutral, brand B's accent); use the `--sys-*` roles, not a primary ramp.
- `--ref-typography-families-display`: display text uses `--ref-typography-families-sans`.

No longer set by `@oods/component-styles` (3):
- `--oods-button-min-block-size`: a button's height comes from its size.
- `--oods-table-cell-padding-block`: a row's height comes from its density.
- `--oods-button-padding-block`: still read (default 0), so a value you set still applies.

## 0.3.3 — published 2026-09-30

**Screens**

- Action bars follow the record's state. Cancel appears only while the record can still be cancelled, and never on an
  archived record. A workflow's archiving action says Archive (it said Delete) and is gone once the record is archived.
- A detail screen lists the object's own fields first, in the order they are written, then the fields its traits add,
  then the record's times. At 48rem and wider, a panel of read-only fields takes two columns. The quickstart's Warehouse
  opens with Code. The composer no longer wraps those fields in stacks of their own, so some detail screens fill fewer
  slots.
- A stack set to space-between spreads its children in React and Vue, as it does in HTML; they wrote the invalid
  `align-items: space-between`.
- In Vue, an action that needs input from your application is disabled, with the title "This action needs input from
  your application.", as it is in React.
- Text is set in DM Sans, which now ships in `@oods/tokens`. SortIndicator's button and a Table's row action take the
  page's font; they were the browser's own buttons, in Arial.
- High-contrast themes: secondary and muted text, status text and icons, accent text, the focus ring and focus text are
  CanvasText. They were GrayText, HighlightText or Highlight, which lose contrast when forced colours are off. Disabled
  text stays GrayText, and text on the interactive surface stays HighlightText on Highlight.
- A brand and theme set together on any element (`data-brand` and `data-theme`) theme everything inside it. A panel
  themed differently from its page kept up to 61 of the page's colour roles, so its buttons, badges and cards painted in
  the page's colours.
- HTML documents embed DM Sans. They no longer write an empty `data-intent` or `data-max-columns` attribute, so a Grid
  with no column count lays out its columns as React and Vue do; it fell back to one column. A Grid in an HTML fragment
  carries the shipped Grid rules and lays out in columns too.

**Charts**

- Facet headings (the facet title and each panel's label) take the chart's text colours. They were black, which a dark
  theme could not show.
- Points are filled, at size 60 and opacity 0.85, and lines are 2.5px wide. They were hollow rings at 0.7 opacity and
  1.5px lines. A spec's own `fill`, `size`, `opacity` or `strokeWidth` still wins.
- A chart that encodes size draws its size legend's symbols in the neutral text colour.
- The grouped-bar pattern draws each quarter's segments side by side, one panel per quarter; it drew them stacked.

**Components** (`@oods/components-react`, `@oods/components-vue`, `@oods/component-styles`, `@oods/component-contracts`)

React and Vue now render the same root element and `oods-*` classes for every component. What moved:

- Badge, and every badge built on it: Vue wraps the label in `span.oods-badge__label` and names the icon
  `oods-badge__icon` (it was `oods-badge-icon`). React no longer carries the `statusable-badge*` classes or the
  `--statusable-badge-*` variables. StatusBadge carries `oods-status-badge` in React too, and ColorizedBadge carries
  `oods-colorized-badge` in Vue too.
- Banner: Vue's root is a `div` (it was a `section`), with `oods-banner__content`, `__title`, `__detail`, `__body`,
  `__actions` and `__dismiss` (they were `oods-banner-content`, `-title`, `-detail`, `-body` and `-actions`). React no
  longer carries the `statusable-banner*` classes. The dismiss button keeps `oods-banner-dismiss`. A status icon takes
  its own column, and the title, detail, body and actions stack without paragraph margins, so React's banner no longer
  squeezes its content beside the dismiss button.
- StatusTimeline and AuditTimeline: Vue gains React's classes (`oods-timeline`, `oods-status-timeline` or
  `oods-audit-timeline`, and `__title`, `__current`, `__events`, `__event`, `__label`, `__detail`, `__actor` and
  `__reason`), and React gains Vue's `data-timeline-*` attributes.
- Table: Vue wraps the table in `div.oods-table__container`, with the part classes `oods-table__caption`, `__header`,
  `__body`, `__row`, `__header-cell` and `__cell`, and puts your attributes on the table, as React does. A caption
  renders only when it has content. React's header row carries `oods-table__row`.
- SearchInput: Vue's root is a `div` with `role="search"`; it was a `form`, which cannot sit inside yours. Enter still
  searches at once and never submits an enclosing form. The input carries `oods-search-input__control` and the clear
  button `oods-search-input__clear` in both frameworks. Vue's Input gains `inputClass`.
- DatePicker: React frames the field in `div.oods-date-picker` with `data-oods-component="DatePicker"`, as Vue does, and
  `className` and `style` apply to that frame.
- The Vue chart previews (Graph, Heatmap, Line, Mark, Point and Scatter) declare the `svgNarrow` and `svgWide` props
  their contract lists.
- `@oods/component-styles` no longer styles `.oods-banner-title` or `.oods-badge-icon`, which no component renders. It
  styles `oods-banner__icon`, `__content`, `__detail`, `__body` and `__actions`, and `oods-badge__icon` and `__label`.
  Its high-contrast rules stop at a nested panel that sets another theme.
- `@oods/component-contracts` lists a contract's composition directives (field bindings and a pattern's parts) in
  `directives`, apart from `props`: Stack's `patternComponent` and `fields`, and the `*Field` and `*Parameter` directives
  of AuditTimeline, CancellationSummary, PaginationBar, PriceBadge, RelativeTimestamp, SearchInput, StatusBadge and
  StatusTimeline. `contract-props.v1.json` records the props React or Vue declares beyond a contract.

If your stylesheet targets `.statusable-badge`, `.statusable-banner`, `.oods-badge-icon` or `.oods-banner-title`, move
it to the classes above.

**Install and dependencies**

- The runtime's `brace-expansion` moves from 5.0.9 to 5.0.12, which fixes two high-severity advisories
  (GHSA-6j4f-fj2g-mc7p, GHSA-qhr7-859c-m2p7) and a moderate one (GHSA-q2hr-2g5m-vwhr), published after 0.3.2's release
  check; 0.3.2's runtime carries 5.0.9. See SECURITY.md.

**Tokens**

- DM Sans ships in `@oods/tokens` under the SIL Open Font License 1.1, loaded by an `@font-face` rule in `tokens.css`
  from beside the stylesheet, never from the network. A bundler must emit `.woff2` files: Vite does, esbuild needs
  `--loader:.woff2=file` and webpack an asset rule.
- The high-contrast colours, and the restated custom properties that let any element carry a theme, are described in
  the `@oods/tokens` changelog.

**Tools**

- `brand_create` grades high-contrast pairs of system colours as Chromium resolves them without forced colours (macOS
  and Linux, light and dark); a pair passes only if it passes in all four. It no longer reports them exempt:
  `contrast.hc` names `systemColoursResolvedIn`, and a failing issue names its resolutions. A brand of yours whose
  high-contrast theme puts GrayText or HighlightText text on Canvas is now refused; move those slots to CanvasText, as
  the quickstart's Harbor brand did (15 slots).
- `catalog_list` labels its `propSchema` as the HTML renderer's (`propSchemaTarget: "html"`) and adds `propTypes`: each
  component's React and Vue props, read from the published type declarations.
- `design_preview`'s `measured.notMeasured` names every scope the page can be measured in: each brand the server
  renders and the preview's own brand, in light, dark and hc. It named brands A and B only, so a brand of yours never
  appeared. The preview's measurement panel shows a brand of yours as well.
- `a11y_scan`'s description says what it checks: every text and icon pair the component stylesheet declares, at 4.5:1
  for text and 3:1 for icons, in every built brand and theme, and, given a UiSchema, the rendered screen's document
  rules. It described an older check of 18 fixed token pairs.
- `structured_data_fetch` reads capture runs whose manifest is schema version 1.0.0 through 1.6.0 (it read 1.0.0 only)
  and refuses later ones. A suite's root manifest, which records its target runs, is refused with the path of those
  runs, instead of being read as its first target.
- A comparison of a capture counts every live font size with no design match: "16 of 18 live font sizes have no design
  match: 14 match no size the design declares for their typeface, and the 2 set in Merriweather Web had no design size to
  compare with." It said 14 of 18. One such size reads "1 font size needs review".
- An MCP app view cannot fetch font files, so its text falls back from DM Sans; the `tokens.json` it loads names the
  hash of the CSS it carries.

**Generated apps**

- Code generated around a component of yours declares `__Mapped<Name>`, `__Contract<Name>`, `__mappedProps`,
  `__vueDefineComponent` and `__vueH`. They replace earlier internal identifiers.
- The quickstart's example team buttons take the page's font.

**Objects**

- The capture objects (Run, Finding, CapturedArtifact, Comparison and ComparisonSignal) describe themselves without
  naming internal tools. Four of Run's sample runs use neutral stand-ins (`app.example.com`), sample ids read
  `capture-…`, and sample provenance reads "Capture tool". Their fields are unchanged.

**Documents and package metadata**

- The package description, the Claude Code plugin, its marketplace, the MCP registry entry and the skill open with
  "OODS Foundry is the object-oriented design system that builds your screens from your objects." The keyword
  `agentic-design-system` is dropped.
- The component reference pages list a contract's directives on their own row.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.3.

## 0.3.2 — published 2026-09-29

**Screens**

- A Subscription's payment chart draws one bar per recorded payment on an axis of payment dates, instead of one solid
  block.
- New billing terms on an active Subscription start a new billing period at the change, with its payment due and
  pending, so the price, the billing cycle, the payment dates and the chart agree. A cancellation at period end
  records the request and drops the renewal.
- A timeline given no events lists the record's own events, instead of "No events yet" above them.
- The archive badge reads Archived or Not archived instead of a raw `false`. Pricing terms on cards read in words
  ("One Time").
- One Subscription definition ships, `objects/core`; `health_check` no longer reports a duplicate.

**Install and dependencies**

- Node.js 22.0.0 or newer is required; it was 20.11.1. Style Dictionary 5, which the token build now uses, needs it.
  On an older Node, the launcher says so in one sentence before it unpacks anything.
- The token build uses Style Dictionary 5.5.5 and `@tokens-studio/sd-transforms` 2.0.3 (they were 4.4.0 and 1.3.0).
  The runtime no longer ships the three packages with high-severity advisories that 0.3.1 carried; see SECURITY.md.
- A token transform that fails now fails the build, so no brand is built with a value its transform never produced.
- Built tokens, your brands' included: the sans and display font stacks name "Helvetica Neue" and "Times New Roman"
  correctly (0.3.1 quoted them twice, so those fallbacks never matched). Transition timing functions hold their values
  instead of referencing the easing tokens, so a stylesheet that overrides `--oods-motion-easing-*` no longer changes
  them. The `@oods/tokens` JavaScript and Tailwind exports carry a `key` on each token and drop five entries that held
  no token; see the `@oods/tokens` changelog.

**Generated apps**

- `code_generate`'s install block installs the `@oods` libraries from npm at exact versions. The steps that packed them
  from the runtime are gone, with the `directory` and `tarball` fields of each package entry. An application's
  package.json pins every package, so `npm install` fetches them.

**Documents and package metadata**

- The documents call the product OODS Foundry, and their license, notice and version links work from npm and follow
  the release.
- The README documents the published Claude Code plugin and MCP registry entry, installs the package before copying the
  skill, and says where mappings are kept: `~/.oods-foundry/mappings`, `OODS_MAPPINGS_DIR` and `MCP_MAPPINGS_PATH`.
- Every package has a homepage, a support email, a description and keywords.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.2.

## 0.3.1 — published 2026-09-27

- The quickstart's Warehouse example shows its authored opening history, dates, manager email and organization.
- Generated apps use the brand's typeface, as the preview does.
- Subscription and Transaction samples are coherent, references show readable labels, the DatePicker keeps its required
  behaviour, and Subscription's meter, history, empty chart and currency help are fixed.
- The `oods-foundry` agent skill ships in the package at `skills/oods-foundry/`, alongside a Claude Code plugin and an
  entry in the official MCP registry, `com.oods-foundry/foundry`.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.1.

## 0.3.0 — published 2026-09-26

- Transaction screens say “Cancel record”; subscription cancellation keeps its subscription-specific meaning.
- Generated prices use currency minor units and useful deterministic samples. Explicit zero values remain zero.
- References use declared display labels when available. Missing labels stay unavailable; technical details retain
  the original IDs, and edits and actions keep those IDs intact.
- Dashboard tabs use meaningful labels, chips agree across React and Vue, narrow lineage timestamps fit, and billing
  meters show the consumed portion consistently across light, dark and forced-colors modes.
- Single-series charts use a governed muted blue in light and dark themes. Caller colors and multi-series palettes
  remain intact; forced-colors uses system paint.
- The package adds the public homepage, support contact and discovery keywords. Certification documentation reflects
  the measured 13 chart types and 78 brand/theme scopes, with high-contrast contrast grading explicitly exempt.
- Bring your own tokens, objects, traits and React/Vue component implementations using the shipped quickstart.
- Generate data-bound HTML screens, object relationship diagrams and screen wireframes as well as React/Vue apps.
- The default MCP surface has 19 tools. Four former tools are removed: `billing.reviewKit`, `billing.switchFixtures`,
  `release.tag` and `diag.snapshot`. Update clients that called those tools before upgrading.
- The package and its five component dependencies ship under Apache 2.0 at exact version 0.3.0.
- Preview was observed in the MCP Apps SDK basic-host with an explicit UI override. Claude Desktop and Cursor remain
  untested. See the README for the measured preview, chart, HTML and accessibility limits.

## 0.2.0 — published 2026-09-23

The first version installed from npm, and the first under the name OODS Foundry.

**Install**

- Every client starts it with `npx -y @oods/foundry` and registers it as `oods-foundry`. The first start unpacks the
  runtime once into `~/.oods-foundry/runtime/`.
- Your saved schemas, composed versions and file-mode output are kept in `~/.oods-foundry`, so they survive upgrades.
- The runtime archive, `oods-foundry-runtime.tar.gz`, is still available for installing without a package manager.

**See the work**

- `design_preview` opens the generated React or Vue app running, under brand, theme and width controls, with the
  lineage, versions and measurements one toggle below it. Claude Desktop (with Developer Mode on) and Cursor 2.6 and
  later show it inside the conversation.
- Every composition keeps its versions. You can edit one (reorder regions or fields, swap a component, reseed the
  sample data), compare two versions side by side, and accept one.
- The generation receipt, chart certification and accessibility results sit beside the running app, and anything not
  measured says so.

**Screens**

- Screens share one left edge. Subscription detail leads with its status and price, then its actions as design-system
  buttons, and its chart is drawn from the record on the page.
- A small bar chart is landscape, with horizontal labels when they fit.
- Tabs keep each label whole on a phone.
- New objects for delivery work (Decision, Sprint, Session), a followed cohort (Person, Cluster) and captured runs
  (Run, Finding, CapturedArtifact, Comparison, ComparisonSignal). Records OODS Foundry only reads get read-only screens.

**Answers**

- The tool list shows each action's own arguments for `schema_render`, `schema_store`, `object_registry` and `component_map`.
- `health_check` reports the release version.
- A `schema_render` render without `apply: true` says it was a dry run and how to get the HTML.
- A dotted tool name such as `design.compose` gets a hint to use `design_compose`.
- `catalog_list` answers with a brief list by default: name, categories and one readiness label per component.
- A generated app's result says where its `@oods` packages come from and how to install them.

**Security**

- The local servers refuse requests that name a foreign host.
- Apache ECharts 6.1.0 fixes a moderate cross-site scripting issue (see SECURITY.md).
- Chart specification addresses (`$schema`, `$id`) moved to `https://oods-foundry.com/`. They are identifiers; nothing
  is fetched from them.

## 0.1.0 — 2026-09-15

The first release, as a runtime archive downloaded and extracted by hand. It composed screens from an object and a
context, generated React, Vue and HTML, rendered charts and dashboards from your data, and certified charts against
accuracy, accessibility, contrast and determinism rules.
