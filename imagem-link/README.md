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

1. Clique no ícone da extensão (no topo da sala) e escolha o tipo: **Mapa**, **Objeto** ou **Token**.
2. Cole o link da imagem (ou vídeo `.webm`/`.mp4`, que toca em loop), **ou envie do PC** (veja abaixo).
   A prévia avisa se o link funciona.
3. Escolha o tamanho:
   - **Quadrados de largura**: quantos quadrados do grid a imagem ocupa de lado a lado; ou
   - **Pixels por quadrado na imagem**: se o mapa foi desenhado com quadrados de 70 px, coloque 70 e o grid casa.
4. *Colocar no centro da tela*. Mapa já entra travado (dá pra destravar no menu do Owlbear).

## Seu repositório do GitHub (pra enviar do PC)

As abas Link e Carros mandam arquivos do PC pro **seu próprio repositório** do GitHub (grátis); cada pessoa usa o
seu. Os arquivos ficam em aw.githubusercontent.com, que qualquer jogador abre. Uma vez só, em **⚙ GitHub**
(nas duas abas, o passo a passo está lá):

1. Crie um repositório **público** no GitHub (ex.: owlbear-imagens) com **Add a README file** marcado.
2. Crie uma chave *fine-grained* com acesso **só a esse repositório** e **Contents: Read and write**.
3. Escreva o repositório (seu-usuario/owlbear-imagens, ou cole o link dele) e a chave, e clique em **Salvar**.
   A extensão confere se a chave escreve nele e avisa se ele estiver privado (privado, os outros não veem).

O repositório e a chave ficam **só neste navegador**: não vão pra sala nem pros outros jogadores. "Apagar" tira os
dois.

### Enviar do PC (mapas, tokens, objetos)

Com o **⚙ GitHub** configurado, clique em **Enviar do PC**, arraste
um arquivo pra janela da extensão ou cole uma imagem com **Ctrl+V** (um print, por exemplo). A prévia aparece na
hora; ao colocar no mapa, a extensão faz um commit com o arquivo em `imagens/mapas/`, `imagens/tokens/` ou
`imagens/objetos/` (pelo tipo escolhido) e o item já entra apontando pra ele, na hora.

- **Converter pra WEBP**: vem marcado em PNG/JPG acima de 1 MB. Deixa o arquivo bem mais leve e mantém a
  transparência. Só troca se o WEBP ficar menor.
- Até ~95 MB por arquivo (limite do GitHub). Nome repetido ganha um número (`floresta-2.webp`).
- **Imagens enviadas pro GitHub** (no fim da aba): lista tudo o que já está no seu repositório, com busca. **Usar** põe o link
  no campo pra colocar de novo; **✕** (dois cliques) apaga do repositório. Apagar tira a imagem de todos os
  mapas que usam ela.

**Trocar link da imagem** (botão direito numa imagem, só o mestre): troca o arquivo mantendo o tamanho no mapa.
Também aceita arquivo do PC.
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

Cada carro é uma pasta `carros/<nome>/` de um repositório com um PNG transparente por ângulo, na ordem do sentido
horário, e um `carro.json`:

```json
{ "nome": "Carro", "pasta": "carro", "largura": 512, "altura": 300, "angulos": ["carro_1.png", "carro_2.png"] }
```

O jeito fácil de gerar é o botão **Pacote Owlbear** do visualizador isométrico do Sketchfab: ele gira o modelo,
tira 8 (ou 4) prints na mesma escala, recorta o fundo e salva tudo em `Downloads/carros/<nome>/`.

A aba lista os carros do **seu repositório** (com ✕ pra apagar) e os do repositório onde a extensão está publicada
(catálogo, só pra usar; `carros/index.json` opcional com `["pasta1", "pasta2"]`).

### Carro direto do PC (envia pro GitHub pela própria aba)

Sem copiar pasta nem usar o GitHub Desktop:

1. Uma vez só: configure o **⚙ GitHub** (veja *Seu repositório do GitHub* acima).
2. **＋ Carro do PC** → escolha uma pasta com **um ou vários carros**: a de um carro só, a `Downloads/carros`
   inteira ou uma pasta onde os downloads caíram todos misturados (até com nomes aleatórios). A extensão separa
   cada carro sozinha:
   - pelo `carro.json` de cada pacote: os nomes dos arquivos; se o navegador salvou com nomes aleatórios, o
     tamanho em bytes de cada PNG (pacotes novos) ou o tamanho da imagem e a ordem em que foram salvos (antigos);
   - imagens sem `carro.json` viram um carro por pasta e tamanho de imagem.
3. Aparece a lista do que foi achado pra conferir: desmarque o que não quer, troque o nome, e clique numa imagem
   pra passar ela pra frente na ordem (a 1ª é a que entra no mapa). Pacote repetido ou com ângulo faltando vem
   desmarcado.
4. **Enviar**: um commit só com todos os carros em `carros/<nome>/` (com nomes de arquivo limpos). Eles já
   aparecem na lista e entram no mapa pelo endereço exato desse commit (`raw.githubusercontent.com`), sem esperar
   o GitHub Pages atualizar. Os outros jogadores também veem eles na lista.

Mandar de novo um carro com o mesmo nome substitui o antigo (os ângulos que sobrarem são apagados).

**Apagar um carro:** com o ⚙ GitHub configurado, cada carro do seu repositório tem um **✕** no canto; dois cliques apagam a pasta dele do
repositório (um commit). Pode levar uns minutos pra sumir do GitHub Pages, mas some da lista na hora.

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

- O acesso ao GitHub (repositório da pessoa, chave, commits, listagem) fica em `gh.js`, usado pelas abas Link e Carros.
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
