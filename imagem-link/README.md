# Imagem por Link — extensão do Owlbear Rodeo

Coloca no mapa imagens e vídeos **por link**, sem fazer upload pro Owlbear. O Owlbear só conta no limite da conta
os arquivos enviados pra ele; um item que aponta pra outro site não gasta nada.

Criado por: Lobynh

## Instalar

No Owlbear: perfil → *Extensions* → **+** → cole o link abaixo e depois ative a extensão na sala.

```
https://zlobinh.github.io/mapas/imagem-link/manifest.json
```

## Aba Link

1. Clique no ícone da extensão (no topo da sala).
2. Cole o link da imagem (ou vídeo `.webm`/`.mp4`, que toca em loop). A prévia avisa se o link funciona.
3. Escolha a camada (Mapa, Objeto, Personagem) e o tamanho:
   - **Quadrados de largura**: quantos quadrados do grid a imagem ocupa de lado a lado; ou
   - **Pixels por quadrado na imagem**: se o mapa foi desenhado com quadrados de 70 px, coloque 70 e o grid casa.
4. *Colocar no centro da tela*. Mapa já entra travado (dá pra destravar no menu do Owlbear).

**Trocar link da imagem** (botão direito numa imagem, só o mestre): troca o arquivo mantendo o tamanho no mapa.
Serve pra trocar um mapa enviado por upload por um com link (depois apague o arquivo do armazenamento do Owlbear
pra liberar espaço) ou pra trocar a versão de um mapa sem mexer em mais nada.

## Aba Pokémon

Quase 2000 sprites animados de Pokémon, incluindo Mega Evoluções e formas Primal, com busca por nome, número da
Pokédex (exato) ou forma ("fêmea", "voando", "mega", "primal"...).

- **Colocar:** clique num Pokémon e depois clique no mapa onde ele vai ficar (ele segue o mouse e encaixa no
  quadrado). Segure **Shift** no mapa pra colocar vários; **Esc** cancela; **Ctrl+clique** no Pokémon coloca
  direto no centro da tela.
- **Tamanho:** 1 a 4 quadrados, ou *Sprite* (proporcional ao desenho, então Pokémon grandes ficam maiores).
  A escolha fica salva no navegador.
- **Trocar a imagem do token selecionado:** marque, selecione o token no mapa e clique no Pokémon novo. Muda só o
  sprite, mantendo tamanho, nome e o resto do token (bom pra evolução, forma ou fêmea/macho).

## Aba Carros (tokens com vários ângulos)

Veículos (ou qualquer modelo 3D) que entram no mapa já com todos os ângulos:

- **Colocar:** clique no carro e depois no mapa (Shift: vários; Esc cancela). O tamanho é o comprimento em quadrados.
- **Girar:** botão direito no token → **Girar pra direita (E)** / **Girar pra esquerda (Q)**. Com o token
  selecionado, as teclas E e Q também giram. Funciona em qualquer token com variantes do
  [Changr](https://extensions.owlbear.rodeo/changr) ("Change Image"), e os ângulos aparecem no menu dele também.
- Os ângulos ficam no token no formato do Changr (`com.missing-link-dev.changr/metadata` → `imageOptions`).

Cada carro é uma pasta `carros/<nome>/` do repositório com um PNG transparente por ângulo, na ordem do sentido
horário, e um `carro.json`:

```json
{ "nome": "Carro", "pasta": "carro", "largura": 512, "altura": 300, "angulos": ["carro_1.png", "carro_2.png"] }
```

O jeito fácil de gerar é o botão **Pacote Owlbear** do visualizador isométrico do Sketchfab: ele gira o modelo,
tira 8 (ou 4) prints na mesma escala, recorta o fundo e salva tudo em `Downloads/carros/<nome>/`. Copie essa pasta
pra `carros/` do repositório e publique; a aba lista as pastas sozinha (pela API do GitHub) ou por um
`carros/index.json` opcional (`["pasta1", "pasta2"]`).

## Onde hospedar imagens pesadas

O Owlbear desenha as imagens com a placa de vídeo, então o site precisa liberar a imagem pra outros sites (CORS).
A prévia da extensão testa isso.

- **GitHub Pages** (grátis): crie um repositório público, suba as imagens e ative o Pages em
  *Settings → Pages*. Link: `https://seu-usuario.github.io/repositorio/mapa.webp`. Até 100 MB por arquivo e
  1 GB por site. Link de arquivo do github.com (`.../blob/main/...`) é convertido sozinho.
- **Imgur**: link direto `i.imgur.com/...` (link da página é convertido).
- **Google Drive**: compartilhado como "qualquer pessoa com o link"; o link é convertido, mas o Drive às vezes
  bloqueia arquivos grandes.
- **Dropbox**: link de compartilhamento é convertido.
- **Discord**: não use, os links expiram.

Prefira WEBP ou JPG. Até ~8000 px de lado aparece em quase todo PC; acima de 16384 px muitas placas de vídeo não
mostram (a extensão avisa). Um mapa muito comprido pode ser dividido em pedaços colocados lado a lado.

## Para quem mantém a extensão

- Os caminhos do `manifest.json` começam com `/mapas/imagem-link/` (repositório `mapas`, pasta `imagem-link`).
  Se a extensão mudar de lugar, troque esses 4 caminhos.
- Os sprites ficam na pasta `pokemon/` da raiz do repositório. Pra adicionar ou trocar, junte tudo numa pasta
  (nomes no formato `0006_Charizard_voando.gif`) e rode na raiz do repositório:

  ```bash
  python imagem-link/tools/montar_pokemon.py "Pokémons" "Mega=Megas" "Mega+=Megas/Estáticos/Refeitos" "Mega+=Megas/Estáticos"
  ```

  Ele copia as imagens pra `pokemon/` com nomes sem acento e refaz o `pokemon/index.json`. `Mega=` dá o nome
  "Mega ..." ("Primal ..." pro Kyogre e o Groudon); `Mega+=` é reserva, só entra quem ainda não tem imagem de Mega
  (assim os GIFs têm prioridade e os estáticos completam o que faltar). Passe sempre todas as pastas: o que não
  vier de nenhuma é apagado de `pokemon/`.
- Testar fora do Owlbear: na raiz do repositório, `python -m http.server 8792` e abra
  `http://localhost:8792/imagem-link/tools/preview.html`.
