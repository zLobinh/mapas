# Imagem por Link — extensão do Owlbear Rodeo

Coloca no mapa imagens e vídeos **por link**, sem fazer upload pro Owlbear. O Owlbear só conta no limite da conta
os arquivos enviados pra ele; um item que aponta pra outro site não gasta nada.

## Como usar

1. Clique no ícone da extensão (no topo da sala).
2. Cole o link da imagem (ou vídeo `.webm`/`.mp4`, que toca em loop). A prévia avisa se o link funciona.
3. Escolha a camada (Mapa, Objeto, Personagem) e o tamanho:
   - **Quadrados de largura**: quantos quadrados do grid a imagem ocupa de lado a lado; ou
   - **Pixels por quadrado na imagem**: se o mapa foi desenhado com quadrados de 70 px, coloque 70 e o grid casa.
4. *Colocar no centro da tela*. Mapa já entra travado (dá pra destravar no menu do Owlbear).

**Trocar link da imagem** (botão direito numa imagem, só o mestre): troca o arquivo mantendo o tamanho no mapa.
Serve pra trocar um mapa enviado por upload por um com link (depois apague o arquivo no seu armazenamento do
Owlbear pra liberar espaço) ou pra mudar a fase do mapa da corrida sem mexer em nada.

## Onde hospedar

O Owlbear desenha as imagens com a placa de vídeo, então o site precisa liberar a imagem pra outros sites (CORS).
A prévia testa isso.

- **GitHub** (recomendado, mesmo esquema da PMP Fichas): crie um repositório (ex.: `mapas`), suba as imagens e ative
  o Pages. Link: `https://SEU-USUARIO.github.io/mapas/rally.webp`. Até 100 MB por arquivo e 1 GB por site.
  Link de arquivo do github.com (`.../blob/main/...`) é convertido sozinho.
- **Imgur**: link direto `i.imgur.com/...` (link da página é convertido).
- **Google Drive**: compartilhado como "qualquer pessoa com o link"; o link é convertido, mas o Drive às vezes
  bloqueia arquivos grandes.
- **Dropbox**: link de compartilhamento é convertido.
- **Discord**: não use, os links expiram.

Prefira WEBP ou JPG. Até ~8000 px de lado aparece em quase todo PC; acima de 16384 px muitas placas de vídeo não
mostram (a extensão avisa). Um mapa de rally comprido pode ser dividido em pedaços colocados lado a lado.

## Publicar no GitHub Pages

1. Crie um repositório chamado `imagem-link` e envie **o conteúdo desta pasta** pra raiz dele
   (os caminhos do `manifest.json` começam com `/imagem-link/`).
2. *Settings → Pages → Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. No Owlbear: perfil → *Extensions* → **+** → `https://SEU-USUARIO.github.io/imagem-link/manifest.json`,
   e ative na sala.

## Testar fora do Owlbear

Na pasta `negocio`: `python -m http.server 8792` e abra `http://localhost:8792/imagem-link/tools/preview.html`.
