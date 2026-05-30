import { describe, it, expect } from "vitest";
import { parseProspectCsv } from "@/lib/csv";

describe("parseProspectCsv", () => {
  it("parses a header row plus data rows", () => {
    const csv = "name,company,role\nAmy Hood,Microsoft,CFO\nRuth Porat,Alphabet,President";
    expect(parseProspectCsv(csv)).toEqual([
      { name: "Amy Hood", company: "Microsoft", role: "CFO" },
      { name: "Ruth Porat", company: "Alphabet", role: "President" },
    ]);
  });

  it("respects quoted fields containing commas", () => {
    const csv = 'name,company\n"Smith, John",Acme';
    expect(parseProspectCsv(csv)).toEqual([{ name: "Smith, John", company: "Acme" }]);
  });

  it("maps header aliases case-insensitively (Title -> role, LinkedIn -> hint)", () => {
    const csv = "Full Name,Employer,Title,LinkedIn\nJane Doe,Globex,VP Finance,linkedin.com/in/jane";
    expect(parseProspectCsv(csv)).toEqual([
      { name: "Jane Doe", company: "Globex", role: "VP Finance", hint: "linkedin.com/in/jane" },
    ]);
  });

  it("omits optional fields when their columns are blank or absent", () => {
    const csv = "name,company,role\nNo Role,Initech,";
    expect(parseProspectCsv(csv)).toEqual([{ name: "No Role", company: "Initech" }]);
  });

  it("drops rows missing a required name or company", () => {
    const csv = "name,company\nAmy Hood,Microsoft\n,Orphan Co\nNo Company,";
    expect(parseProspectCsv(csv)).toEqual([{ name: "Amy Hood", company: "Microsoft" }]);
  });

  it("returns [] when required columns are missing", () => {
    expect(parseProspectCsv("first,last\nAmy,Hood")).toEqual([]);
  });

  it("returns [] for empty or header-only input", () => {
    expect(parseProspectCsv("")).toEqual([]);
    expect(parseProspectCsv("name,company")).toEqual([]);
  });

  it("tolerates CRLF line endings and surrounding whitespace", () => {
    const csv = " name , company \r\n Amy Hood , Microsoft \r\n";
    expect(parseProspectCsv(csv)).toEqual([{ name: "Amy Hood", company: "Microsoft" }]);
  });
});
