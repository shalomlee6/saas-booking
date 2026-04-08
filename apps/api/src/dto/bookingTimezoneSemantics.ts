/**
 * Canonical semantics for how appointment times are interpreted on the API.
 * (Owner/admin dashboard vs public booking.)
 */
export const BOOKING_TIMEZONE_SEMANTICS = `Owner — POST /api/appointments (and PUT with start/end):
  • Body fields \`start\` / \`end\` MUST be ISO 8601 with explicit UTC (\`Z\`) or numeric offset.
  • The server stores the resulting UTC instant as-is. Business timezone is NOT used to reinterpret these strings.

Public — POST /api/public/appointments:
  • Body fields \`date\` (YYYY-MM-DD) + \`time\` (HH:mm) are wall-clock in the business settings timezone
    (\`settings.localization.timezone\`, default Asia/Jerusalem), then converted to UTC.
  • A slot shown as available in GET …/availability for that date/time is the same UTC instant as booking it here,
    provided the client uses the same date/time strings.

DST: Public booking uses Luxon in the business zone (not the server OS zone). Owner flow relies on explicit offsets in ISO strings from the client.` as const;
