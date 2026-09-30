# Memory Timeline

## Goal

Browse actual family material by known dates or supplied chapters. Dates may be uncertain; the interface should reflect that rather than manufacture precision. Do not assume travel, hobbies or major life events.

## UX

Chronological vertical list with optional year/decade filters; no horizontal drag-only timeline. Each event has title, approved story and asset(s). Label approximate dates “Around 1990” or “Date unknown”. Unknown-date collection is first-class. No automatic anniversary reminders, especially around sensitive events. Curator can tag “Do not resurface”; such content stays browsable where authorised but excluded from optional memory prompts.

States: no dated material → show existing approved items under “Memories”; active filter with no matches → clear filter action; media failure retains story. Event detail returns to previous list location.

## Data

`memory_events(id,family_id,title,story text,date_start date?,date_end date?,date_precision enum(day,month,year,range,unknown),date_label_override?,source_note private text?,resurface_allowed bool default false,status enum(draft,published,withdrawn),position_override?)`.
`memory_event_assets(event_id,family_id,asset_id,position)`.

Precision validation: day needs exact date; month/year do not expose invented day; range end >= start; unknown needs no dates. Source note is curator-only. Viewer sees published content; contributor may propose own event, curator publishes.

## Acceptance and prerequisites

Use supplied dates or explicitly unknown; editorial order must not imply unsupported chronology. Test approximate ranges, events without photos and filters using keyboard/phone. No analytics exports private dates/names. Cross-family asset attachment fails. Withdrawal updates book/newspaper references if linked. Launch only when enough genuine organised material makes navigation useful; a handful of photos is better as an album than an empty elaborate timeline.
