// Reads the trainers' sheets straight from Google Sheets (the spreadsheet has to be shared as "anyone with
// the link can view"): no key needed. Each player is one tab; the cells are found by their labels, so
// adding rows to the sheet doesn't break the reading.

// a share link or a bare id -> the spreadsheet id
export function sheetId(link) {
  const s = String(link || "").trim();
  return s.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? (/^[\w-]{20,}$/.test(s) ? s : "");
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  row.push(cell); rows.push(row);
  return rows;
}

// (Google guesses one type per column and drops the cells of the other types: a column of checkboxes loses
// its texts. So lists of text that share a column with checkboxes are asked for in their own range.)
async function tabRows(id, tab, range = "A1:S60") {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=0&range=${range}&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`a planilha respondeu ${res.status} (ela está compartilhada como "qualquer pessoa com o link"?)`);
  const text = await res.text();
  if (/^\s*<!doctype html|<html/i.test(text)) throw new Error("a planilha não está pública: compartilhe como \"qualquer pessoa com o link pode ver\"");
  return parseCSV(text);
}

const isBool = (v) => /^(TRUE|FALSE|VERDADEIRO|FALSO)$/i.test(String(v).trim());
const isTrue = (v) => /^(TRUE|VERDADEIRO)$/i.test(String(v).trim());

// one trainer: { tab, name, sub, region, level, money, badges[8], team[{ name, tera }] }
export async function readTrainer(id, tab) {
  const rows = await tabRows(id, tab);
  const find = (test) => { for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (test(String(rows[r][c]).trim())) return [r, c]; return null; };
  const flat = rows.flat().map((v) => String(v).trim()).filter(Boolean);
  if (!flat.length) throw new Error(`a aba "${tab}" veio vazia (o nome da aba está certo?)`);
  // the name is the cell right before "Treinador de X • Nível N"
  const hi = flat.findIndex((v) => /n[ií]vel\s*\d+/i.test(v));
  const head = hi >= 0 ? flat[hi] : "";
  const name = (hi > 0 ? flat[hi - 1] : "") || tab;
  const level = head.match(/n[ií]vel\s*(\d+)/i)?.[1] ?? "";
  const region = head.match(/treinador[a]?\s+d[eoa]\s+(.+?)\s*[•·|-]/i)?.[1]?.trim() ?? "";
  const money = (flat.find((v) => /^₽/.test(v)) ?? "").replace(/^₽\s*/, "");
  // the badge box: the two rows of 4 checkboxes under "Caixa de Insígnias" (1-4, then 5-8)
  const badges = [];
  const box = find((v) => /caixa de ins[ií]gnias/i.test(v));
  if (box) {
    for (let r = box[0] + 1; r < Math.min(rows.length, box[0] + 14) && badges.length < 8; r++) {
      const four = rows[r].slice(box[1], box[1] + 4);
      if (four.length === 4 && four.every(isBool)) badges.push(...four.map(isTrue));
    }
  }
  while (badges.length < 8) badges.push(false);
  // the team: the list under "Tera" ("Raichu (Gelo)")
  const team = [];
  const col = (await tabRows(id, tab, "F34:F60").catch(() => [])).map((r) => String(r[0] ?? "").trim());
  const ti = col.findIndex((v) => /^tera$/i.test(v));
  if (ti >= 0) {
    for (let r = ti + 1; r < col.length && team.length < 6; r++) {
      const v = col[r];
      if (!v) break;
      const m = v.match(/^(.+?)\s*\((.+)\)\s*$/);
      team.push({ name: (m ? m[1] : v).trim(), tera: m ? m[2].trim() : "" });
    }
  }
  return { tab, name, sub: [region, level && `Nível ${level}`].filter(Boolean).join(" · "), region, level, money, badges, team };
}
