// GitHub access shared by the tabs that send files from the PC ("Enviar do PC" in the Link tab, "＋ Carro do
// PC" in the Carros tab). Each person uses THEIR OWN public repository: the repository ("owner/name") and the
// key (a fine-grained token with "Contents: read and write" on that repository only) are kept ONLY in this
// browser (localStorage), never in the room. The files are then served by raw.githubusercontent.com, which
// any player can open (right image type and CORS, which Owlbear needs).

// the repository this extension is published from (its read-only car catalog)
export const HOST_OWNER = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "zlobinh";
export const HOST_REPO = location.hostname.endsWith(".github.io") ? location.pathname.split("/")[1] : "mapas";
const TOKEN_KEY = "imagem-link/gh-token";
const REPO_KEY = "imagem-link/gh-repo";
const $ = (id) => document.getElementById(id);

export const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
// { owner, name, branch } of the person's repository, or null
export function repo() {
  try { const r = JSON.parse(localStorage.getItem(REPO_KEY) || "null"); return r?.owner && r?.name ? r : null; } catch { return null; }
}
export const ready = () => !!(token() && repo());
const repoLabel = () => (repo() ? `${repo().owner}/${repo().name}` : "");
const sameAsHost = () => repo() && repo().owner.toLowerCase() === HOST_OWNER.toLowerCase() && repo().name.toLowerCase() === HOST_REPO.toLowerCase();
export { sameAsHost };

// "dono/nome", "https://github.com/dono/nome", "dono.github.io/nome" -> { owner, name } or null
export function parseRepo(s) {
  const t = String(s || "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  let m = t.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i) ?? t.match(/^([\w-]+)\.github\.io\/([\w.-]+)/i) ?? t.match(/^([\w-]+)\/([\w.-]+)$/);
  return m ? { owner: m[1], name: m[2] } : null;
}

async function api(fullPath, body, method, allow404) {
  const res = await fetch(`https://api.github.com${fullPath}`, {
    method,
    // (never the browser's copy: an old branch position makes the commit "not a fast forward")
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && allow404) return null;
  if (res.status === 401) throw new Error("a chave do GitHub não funcionou (errada ou vencida): cole uma nova em ⚙ GitHub");
  if (res.status === 403 || res.status === 404) throw new Error(`a chave não tem permissão de escrever no repositório ${repoLabel()} (precisa de "Contents: Read and write" nele)`);
  if (res.status === 409) throw new Error(`o repositório ${repoLabel()} está vazio: crie ele com "Add a README file" marcado (ou suba qualquer arquivo nele)`);
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}
// a call on the person's repository ("/git/blobs"...); allow404: missing -> null
export async function gh(path, body = null, method = body ? "POST" : "GET", allow404 = false) {
  const r = repo();
  if (!r) throw new Error("escolha o seu repositório em ⚙ GitHub");
  return api(`/repos/${r.owner}/${r.name}${path}`, body, method, allow404);
}

export const base64 = (blob) => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1]);
  r.onerror = () => no(r.error);
  r.readAsDataURL(blob);
});
export const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// file/folder name in the repository: "Carro da Tatu" -> "carro-da-tatu"
export const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arquivo";

export const blobEntry = (path, sha) => ({ path, mode: "100644", type: "blob", sha });
export const removeEntry = (path) => ({ path, mode: "100644", type: "blob", sha: null });
const enc = (path) => path.split("/").map(encodeURIComponent).join("/");
// a file as a commit left it: available right away and forever
export const rawUrl = (commit, path) => `https://raw.githubusercontent.com/${repo().owner}/${repo().name}/${commit}/${enc(path)}`;
// a file as it is now on the person's branch (raw.githubusercontent.com caches a few minutes)
export const rawBranchUrl = (path) => `https://raw.githubusercontent.com/${repo().owner}/${repo().name}/${repo().branch || "main"}/${enc(path)}`;

// one commit: tree on top of the current one -> commit -> move the branch. If someone pushed in the middle
// (GitHub Desktop), it is built again on top of the new position, up to 3 times (files are uploaded once).
export async function commitTree(message, build, say = () => {}) {
  const branch = repo().branch || "main";
  let tree = null;
  for (let attempt = 1; ; attempt++) {
    const ref = await gh(`/git/ref/heads/${branch}`);
    const head = await gh(`/git/commits/${ref.object.sha}`);
    tree ??= await build(head.tree.sha);
    const newTree = await gh("/git/trees", { base_tree: head.tree.sha, tree });
    const commit = await gh("/git/commits", { message, tree: newTree.sha, parents: [ref.object.sha] });
    try {
      await gh(`/git/refs/heads/${branch}`, { sha: commit.sha }, "PATCH");
      return commit.sha;
    } catch (err) {
      if (attempt >= 3 || !/422/.test(err.message)) throw err;
      say("O repositório mudou no meio do envio; tentando de novo…");
    }
  }
}

// what is in a folder of the repository at a tree ("carros/x") -> [{ path, type, sha, size }] ([] when missing)
export async function listDir(rootSha, dir) {
  let sha = rootSha;
  for (const part of dir.split("/").filter(Boolean)) {
    const t = await gh(`/git/trees/${sha}`);
    sha = t.tree.find((x) => x.path === part && x.type === "tree")?.sha;
    if (!sha) return [];
  }
  return (await gh(`/git/trees/${sha}`)).tree;
}
// a folder on the person's branch right now (contents API) -> [{ name, path, size, type }] ([] when missing)
export async function listNow(dir) {
  return (await gh(`/contents/${enc(dir)}?ref=${encodeURIComponent(repo().branch || "main")}`, null, "GET", true)) ?? [];
}

// the "⚙ GitHub" box (same ids on every page that has it): repository + key
export function wireKeyBox(say, onChange = () => {}) {
  if (!$("ghBox")) return;
  const show = () => {
    const ok = ready();
    $("ghState").textContent = ok ? `✓ ${repoLabel()}` : token() || repo() ? "incompleto" : "não configurado";
    $("ghForget").hidden = !(token() || repo());
    if (repo() && !$("ghRepo").value) $("ghRepo").value = repoLabel();
    $("ghToken").placeholder = token() ? "chave salva (cole outra pra trocar)" : "github_pat_...";
    onChange(ok);
  };
  $("ghSave").onclick = async () => {
    const r = parseRepo($("ghRepo").value);
    if (!r) { say("Escreva o repositório como seu-usuario/nome-do-repositorio."); return; }
    const t = $("ghToken").value.trim();
    const oldToken = token(), oldRepo = localStorage.getItem(REPO_KEY);
    if (!t && !oldToken) { say("Cole a chave do GitHub."); return; }
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(REPO_KEY, JSON.stringify(r));
    } catch { say("Este navegador não deixou guardar a chave."); return; }
    try {
      const info = await api(`/repos/${r.owner}/${r.name}`, null, "GET", true);
      if (!info) throw new Error(`não achei o repositório ${r.owner}/${r.name} (confira o nome e se a chave tem acesso a ele)`);
      if (info.permissions && !info.permissions.push) throw new Error(`a chave não pode escrever em ${r.owner}/${r.name} (precisa de "Contents: Read and write")`);
      localStorage.setItem(REPO_KEY, JSON.stringify({ owner: info.owner.login, name: info.name, branch: info.default_branch || "main" }));
      $("ghToken").value = "";
      $("ghBox").open = false;
      show();
      say(info.private
        ? `⚠ Salvo, mas ${info.full_name} é PRIVADO: os outros jogadores não vão ver as imagens. Deixe ele público (Settings → General → Danger Zone → Change visibility).`
        : `✓ Pronto: os arquivos vão pro repositório ${info.full_name}.`);
    } catch (err) {
      try { oldToken ? localStorage.setItem(TOKEN_KEY, oldToken) : localStorage.removeItem(TOKEN_KEY); oldRepo ? localStorage.setItem(REPO_KEY, oldRepo) : localStorage.removeItem(REPO_KEY); } catch {}
      show();
      say(`Não funcionou: ${err.message}`);
    }
  };
  $("ghForget").onclick = () => {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REPO_KEY); } catch {}
    $("ghRepo").value = "";
    show();
    say("Chave e repositório apagados deste navegador.");
  };
  show();
}
// asks for the setup when it's missing; true when ready
export function needKey(say) {
  if (ready()) return true;
  $("ghBox").open = true;
  say("Primeiro configure o seu repositório e a chave do GitHub em ⚙ GitHub (só uma vez).");
  return false;
}
