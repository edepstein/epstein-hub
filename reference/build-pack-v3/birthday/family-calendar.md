# Private Family Calendar

## Goal

A modest companion for real family plans, not the main birthday gift. Initial scope is read-only for viewers, curator-managed events. Do not import work/personal calendars or request broad permissions by default.

## UX and scope

Upcoming agenda first; monthly grid optional. Each event has supplied title, local date/time, timezone, optional location and organiser note. Clearly label all-day events and uncertain/tentative plans. No assumption that an event is an invitation. Optional RSVP must be explicitly enabled per event; attending/not attending/maybe responses visible only as configured. No pressure to explain refusal.

Empty state says “No family plans have been added.” Do not invent family birthdays or repeat guessed dates. Event cancelled remains visibly marked rather than silently vanishing if previously shown. Overdue invitations show closed state. Filters and controls keyboard/phone accessible.

## Data

`family_events(id,family_id,created_by,title,description?,starts_at timestamptz?,ends_at timestamptz?,all_day_date date?,timezone text,status enum(draft,published,tentative,cancelled),location_text?,rsvp_enabled bool default false,rsvp_deadline?,updated_at,version)`.
`event_rsvps(family_id,event_id,user_id,response enum(yes,no,maybe),updated_at)`.

Validation: either all-day date or valid start/end, IANA timezone, end > start; DST behaviour explicit. Curator publishes; contributors can propose drafts if enabled. Only member can set own RSVP. Location is private and optional; no map third party by default.

## Export/reminders

Defer calendar subscription feeds; long-lived private feed URLs create additional access/revocation risk. One-event `.ics` download may be offered after authorisation with explanation that local copies persist. Never embed media secrets. Email reminders off by default; implement only with preference, cancellation changes and delivery/opt-out testing.

## Acceptance and prerequisites

Publish only actual supplied events approved by organiser. Test UK DST boundaries, all-day event dates across device timezone, cancellation/version conflicts and other-family isolation. RSVP visibility documented and tested. Unsupported location map or recurring rule not shown as working. In absence of genuine events, omit module from gift navigation.
