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

// Split one CSV line into fields, respecting double-quoted segments so a comma
// inside "Smith, John" is not treated as a separator.
function splitLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
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
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
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
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return []; // need a header plus at least one data row

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const colFor = (field: keyof ProspectRow): number =>
    headers.findIndex((h) => HEADER_ALIASES[h] === field);

  const nameCol = colFor("name");
  const companyCol = colFor("company");
  const roleCol = colFor("role");
  const hintCol = colFor("hint");
  if (nameCol === -1 || companyCol === -1) return []; // required columns absent

  const rows: ProspectRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const name = cells[nameCol] ?? "";
    const company = cells[companyCol] ?? "";
    if (!name || !company) continue; // skip incomplete rows rather than running them

    const row: ProspectRow = { name, company };
    const role = roleCol >= 0 ? cells[roleCol] : "";
    const hint = hintCol >= 0 ? cells[hintCol] : "";
    if (role) row.role = role;
    if (hint) row.hint = hint;
    rows.push(row);
  }
  return rows;
}
