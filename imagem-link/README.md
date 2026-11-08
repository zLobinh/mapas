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

## Aba 🐾 Pokémon

Todos os sprites da pasta `pokemon/` do repositório, com busca por nome, número da Pokédex (exato) ou forma
("fêmea", "voando"...). Clique num Pokémon pra colocá-lo no centro da tela, na camada de personagens.

- **Tamanho:** 1 a 4 quadrados, ou *Sprite* (proporcional ao desenho: 50 px do sprite = 1 quadrado, então Pokémon
  grandes ficam maiores). A escolha fica salva no navegador.
- **Trocar a imagem do token selecionado:** marque, selecione o token no mapa e clique no Pokémon novo. Muda só o
  sprite, mantendo o tamanho, o nome e a ficha (bom pra evolução, forma ou fêmea/macho).

Pra adicionar ou trocar sprites: junte tudo numa pasta (nomes no formato `0006_Charizard_voando.gif`) e rode, na
pasta do repositório `mapas`:

```bash
python imagem-link/tools/montar_pokemon.py "C:/caminho/da/pasta"
```

Ele copia as imagens pra `pokemon/` com nomes sem acento e refaz o `pokemon/index.json`. Depois suba pelo
GitHub Desktop.

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

A extensão mora na pasta `imagem-link` do repositório `mapas` (Pages ligado, branch `main`, pasta `/ (root)`).
Os caminhos do `manifest.json` começam com `/mapas/imagem-link/`; se mudar de lugar, troque esses 4 caminhos.

No Owlbear: perfil → *Extensions* → **+** → `https://zlobinh.github.io/mapas/imagem-link/manifest.json`,
e ative na sala. As imagens podem ficar na raiz do mesmo repositório: `https://zlobinh.github.io/mapas/rally.webp`.

## Testar fora do Owlbear

Na pasta do repositório `mapas`: `python -m http.server 8792` e abra
`http://localhost:8792/imagem-link/tools/preview.html`.
