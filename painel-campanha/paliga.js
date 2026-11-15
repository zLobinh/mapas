// Reads the trainers' current teams from the PA Liga: the players' site (the published "visão do jogador",
// which carries the league's data and the address of its online database) plus the rosters the players
// change themselves online (one row per trainer, applied on top, like the site itself does).
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// the data the site carries: window.__PALIGA_PLAYER__ = {...};</script>
function payloadOf(html) {
  const mark = "window.__PALIGA_PLAYER__ = ";
  const a = html.indexOf(mark);
  if (a < 0) throw new Error("esse link não é o site dos jogadores da PA Liga (não achei os dados nele)");
  const b = html.indexOf(";</script>", a);
  return JSON.parse(html.slice(a + mark.length, b));
}
// display name from the app's code (species + variant), like the PA Liga does
function appName(code) {
  const s = code?.species?.current, v = code?.variant;
  if (!s) return null;
  if (!v) return s;
  return v.startsWith(s) ? v : `${s} ${v}`;
}

// -> { find(name) -> { name, team: [{ name, role }] } | null, trainers: [names], at }
export async function readPaliga(siteUrl) {
  const res = await fetch(siteUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`o site da PA Liga respondeu ${res.status}`);
  const data = payloadOf(await res.text());
  const state = data.state ?? {};
  const byId = new Map();
  for (const region of Object.values(state.regions ?? {})) {
    for (const team of region.teams ?? []) for (const tr of team.trainers ?? []) byId.set(tr.id, { name: tr.name, club: team.name, pokemon: [...(tr.pokemon ?? [])], rosterAt: tr.rosterAt || 0 });
  }
  // the rosters the players changed online, when they are newer than what the site carries
  const cloud = state.config?.cloud;
  if (cloud?.url && cloud?.key) {
    try {
      const r = await fetch(`${cloud.url.replace(/\/+$/, "")}/rest/v1/rpc/ig_rosters`, {
        method: "POST", cache: "no-store", body: "{}",
        headers: { apikey: cloud.key, Authorization: `Bearer ${cloud.key}`, "Content-Type": "application/json", Accept: "application/json" },
      });
      for (const row of (r.ok ? await r.json() : []) ?? []) {
        const tr = byId.get(row.trainer_id), at = Date.parse(row.updated_at) || 0;
        if (!tr || tr.rosterAt >= at) continue;
        const old = new Map(tr.pokemon.map((p) => [p.id, p]));
        const next = (row.pokemon ?? []).map((e) => {
          const o = old.get(e.id);
          if (o) return { ...o, role: e.role || undefined };
          const name = appName(e.app);
          return name ? { id: e.id, name, role: e.role || undefined } : null;
        }).filter(Boolean);
        if (next.length || !(row.pokemon ?? []).length) { tr.pokemon = next; tr.rosterAt = at; }
      }
    } catch (err) { console.warn("[painel] times online da PA Liga:", err.message); }
  }
  const list = [...byId.values()].map((t) => ({ name: t.name, club: t.club, team: t.pokemon.map((p) => ({ name: p.name, role: p.role })) }));
  return {
    at: data.at,
    trainers: list.map((t) => t.name),
    // exact name, then the first name ("Noah" finds "Noah Saviere"), when only one trainer matches
    find(name) {
      const k = fold(name);
      if (!k) return null;
      const exact = list.filter((t) => fold(t.name) === k);
      if (exact.length) return exact[0];
      const first = k.split(/\s+/)[0];
      const loose = list.filter((t) => fold(t.name).split(/\s+/)[0] === first || fold(t.name).includes(k) || k.includes(fold(t.name)));
      return loose.length === 1 ? loose[0] : null;
    },
  };
}
