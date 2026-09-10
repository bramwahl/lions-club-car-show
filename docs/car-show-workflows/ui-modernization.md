# UI/UX modernization

The application retains Next.js App Router, TypeScript, Tailwind CSS, Supabase, and its Vercel deployment structure. This pass changes presentation and navigation, not scoring, awards, database schema or authorization. No deployment was performed.

## Design system and pages

- Responsive application shell: desktop sidebar with active-route indication; phone menu with expanded navigation and account controls. Admin order is Dashboard, Participants, Registrations, Scores, Awards, Events, Users. Judge navigation stays focused on judging.
- Selected event name/year and historical/current treatment appear throughout the Admin shell. Event selectors remain available on event-focused screens; historical notices remain explicit.
- Shared `PageHeader`, `StatusBadge`, `StatCard`, `EmptyState`, `RegistrationCard`, `AppNavigation`; updated shared `StaffShell`, `EventPicker`, `Progress`, `HistoryTable`, and form styling. Shared responsive table rules preserve semantic tables and attach mobile field labels. Native accessible disclosures provide expandable forms/sections without a new modal framework.
- Neutral surfaces, stronger headings, consistent rounded controls, restrained borders/shadows, compact status colors, keyboard focus indicators and 44px minimum action targets. Judging score controls are 60px tall.
- Dashboard: updated stat cards, check-in/payment/judging attention links and workflow shortcuts.
- Participants: polished searchable table/mobile list, contact summary, expandable Edit Participant/Add Car, saved vehicles, and registrations grouped by event. The last item adds a read-only multi-event projection using existing guarded RPCs; directory mutations are unchanged.
- Registrations: mobile cards prioritize public car number, vehicle, participant, status/payment, progress/score and View/Judge actions. Existing bulk check-in controls remain available. Registration detail has a prominent number and snapshot hero, badges, scoring summary, print/judge actions and responsive history.
- Judging: six expandable section cards, Submitted/Pending history state, large numeric inputs, preserved maxima and explicit save action. First section starts open; other sections can be opened independently. Submitted means a historical section submission exists; a later Quick Edit can still leave fields incomplete.
- Scores: responsive labeled cards preserve sorting, filtering, duplicate colors, manual marking, Quick Edit and details links.
- Awards: Best in Show hero, clear Best in Class/category/Top 40 group headings, responsive winner cards and separate Lions Choice. Iteration preserves the original engine array order and all 51 historical award entries, including tie markers. Five-second refresh behavior is unchanged.
- Events, Users, CSV import and staff/sign-in screens inherit consistent controls/layout. Admin loading skeleton and retry error boundary are included. Streaming redirects remain enforced and are accounted for in the HTTP authorization test.
- Printable car sheet remains separate from app chrome. Phone preview stacks the QR layout; print styles retain the vehicle sheet layout and registration-specific QR destination.

## Responsive review and validation

Reviewed loaded Dashboard, Participants, Registrations, Scores, Awards, Events, Users, participant detail, registration detail, judging detail, print preview and CSV import at **390px phone, 820px tablet and 1440px desktop**. All 36 page/width combinations had document scroll width equal to viewport width. Also opened the phone navigation and an active judging section using disposable test records: six sections, 60px score controls, no phone page overflow. Screenshots visually checked phone events, registration cards and judging controls, plus desktop awards.

Checks passed:

- ESLint and TypeScript.
- 19 automated tests covering the existing scoring, history, RLS, event reuse, CSV and awards contracts.
- Production Webpack build.
- Live Admin/Judge HTTP workflow checks after the visual changes; disposable accounts/data removed afterward.
- Exact historical reconciliation: 256 registrations, 71 scores, 486 history records, Lions Choice total 2, 51 award fixtures / 204 numeric values with zero differences.
- All 17 preserved baseline file hashes unchanged; no changes to the validated scoring/award engine or original Phase 0 package.

## Remaining mobile considerations

- Large all-score comparisons are easier on desktop; phone cards expose every value but prioritize one car at a time. Tablet tables may scroll within their table region for wide comparisons; phone tables become cards.
- CSV file selection and Save as PDF depend on the device/browser's native file and print dialogs. Mobile layouts were reviewed, but physical iOS/Android keyboard and printer behavior were not tested on hardware.
- QR codes still need a reachable event-day origin before use on attendees' phones. This pass does not deploy the app or change the existing public registration deferral.
- No offline scoring or offline queue was introduced; saving still requires the existing authenticated network connection.
