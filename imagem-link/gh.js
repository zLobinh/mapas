// GitHub access shared by the tabs that send files from the PC to this repository ("Enviar do PC" in the
// Link tab, "＋ Carro do PC" in the Carros tab). The key (a fine-grained token with "Contents: read and
// write" on this repository only) is kept ONLY in this browser (localStorage): never in the room.

// the repository comes from the address: <owner>.github.io/<repository>/...
export const OWNER = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "zlobinh";
export const REPO = location.hostname.endsWith(".github.io") ? location.pathname.split("/")[1] : "mapas";
const TOKEN_KEY = "imagem-link/gh-token";
const $ = (id) => document.getElementById(id);

export const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };

export async function gh(path, body = null, method = body ? "POST" : "GET") {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    method,
    // (never the browser's copy: an old branch position makes the commit "not a fast forward")
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error("a chave do GitHub não funcionou (errada ou vencida): cole uma nova em ⚙ Chave do GitHub");
  if (res.status === 403 || res.status === 404) throw new Error(`a chave não tem permissão de escrever no repositório ${REPO} (precisa de "Contents: Read and write" nele)`);
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
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
// a file as the commit left it: right image type and CORS (which Owlbear needs), right away, forever
export const rawUrl = (commit, path) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${commit}/${path.split("/").map(encodeURIComponent).join("/")}`;
// the same file on GitHub Pages (a minute or two after the commit)
export const pagesUrl = (path) => `https://${OWNER}.github.io/${REPO}/${path.split("/").map(encodeURIComponent).join("/")}`;

// one commit: tree on top of the current one -> commit -> move the branch. If someone pushed in the middle
// (GitHub Desktop), it is built again on top of the new position, up to 3 times (files are uploaded once).
export async function commitTree(message, build, say = () => {}) {
  const repoInfo = await gh("");
  const branch = repoInfo.default_branch || "main";
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

// the "⚙ Chave do GitHub" box (same ids on every page that has it)
export function wireKeyBox(say, onChange = () => {}) {
  if (!$("ghBox")) return;
  const show = () => {
    const has = !!token();
    $("ghState").textContent = has ? `✓ chave salva neste navegador (repositório ${OWNER}/${REPO})` : "nenhuma chave salva";
    $("ghForget").hidden = !has;
    onChange(has);
  };
  $("ghSave").onclick = async () => {
    const t = $("ghToken").value.trim();
    if (!t) return;
    try { localStorage.setItem(TOKEN_KEY, t); } catch { say("Este navegador não deixou guardar a chave."); return; }
    $("ghToken").value = "";
    try { await gh(""); show(); say("✓ Chave do GitHub salva e funcionando."); $("ghBox").open = false; }
    catch (err) { try { localStorage.removeItem(TOKEN_KEY); } catch {} show(); say(`A chave não funcionou: ${err.message}`); }
  };
  $("ghForget").onclick = () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} show(); say("Chave apagada deste navegador."); };
  show();
}
// asks for the key when there is none; true when there is one
export function needKey(say) {
  if (token()) return true;
  $("ghBox").open = true;
  say("Primeiro cole a sua chave do GitHub em ⚙ Chave do GitHub (só uma vez).");
  return false;
}
