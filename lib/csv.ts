// A small CSV parser for the batch upload (R3). Handles a header row, quoted
// fields (with embedded commas and "" escapes), and CRLF/LF line endings. It is
// intentionally minimal — enough for a pasted or exported prospect list, not a
// full RFC-4180 engine — and pure, so it is unit tested like the rest of the
// judgment-adjacent code.

export interface ProspectRow {
  name: string;
  company: string;
  role?: string;
  hint?: string;
}

// Parse the WHOLE CSV text into rows of fields in ONE quote-aware pass, so a
// quoted field may contain commas AND line breaks ("" is an escaped quote). This
// is why we do not split on newlines first: a newline INSIDE quotes is field
// content, not a row break — splitting line-by-line first would tear a multi-line
// cell (common in spreadsheet exports) in half and silently drop a prospect.
function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // "" is an escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++; // treat CRLF as one break
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Flush the trailing field/row (the file may not end with a newline).
  row.push(field);
  rows.push(row);

  // Trim every field, then drop fully-blank rows (e.g. from a trailing newline).
  return rows
    .map((r) => r.map((f) => f.trim()))
    .filter((r) => r.some((f) => f.length > 0));
}

// Accepted header spellings → the canonical field they map to (case-insensitive).
const HEADER_ALIASES: Record<string, keyof ProspectRow> = {
  name: "name",
  "full name": "name",
  prospect: "name",
  company: "company",
  organisation: "company",
  organization: "company",
  employer: "company",
  role: "role",
  title: "role",
  "job title": "role",
  hint: "hint",
  linkedin: "hint",
  "linkedin url": "hint",
  email: "hint",
};

// Parse CSV text into prospect rows. Requires a header row that includes at least
// a name column and a company column (under any accepted alias). Rows missing
// either are dropped. Empty / header-only input returns [].
export function parseProspectCsv(text: string): ProspectRow[] {
  const rows = splitRows(text);
  if (rows.length < 2) return []; // need a header plus at least one data row

  const headers = rows[0].map((h) => h.toLowerCase());
  const colFor = (field: keyof ProspectRow): number =>
    headers.findIndex((h) => HEADER_ALIASES[h] === field);

  const nameCol = colFor("name");
  const companyCol = colFor("company");
  const roleCol = colFor("role");
  const hintCol = colFor("hint");
  if (nameCol === -1 || companyCol === -1) return []; // required columns absent

  const out: ProspectRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const name = cells[nameCol] ?? "";
    const company = cells[companyCol] ?? "";
    if (!name || !company) continue; // skip incomplete rows rather than running them

    const row: ProspectRow = { name, company };
    const role = roleCol >= 0 ? cells[roleCol] : "";
    const hint = hintCol >= 0 ? cells[hintCol] : "";
    if (role) row.role = role;
    if (hint) row.hint = hint;
    out.push(row);
  }
  return out;
}
