# Painel da Campanha — extensão do Owlbear Rodeo

Monta, em volta do mapa, a identidade visual da campanha: os **cartões dos treinadores** (sempre iguais às fichas
da planilha) e a **moldura do mapa** (título, os dois lados passado/futuro e a legenda), com o mapa aparecendo
por dentro da fenda de raio.

Criado por: Lobynh

## Instalar

```
https://zlobinh.github.io/mapas/painel-campanha/manifest.json
```

Precisa do **⚙ GitHub** configurado (o mesmo repositório e chave da Imagem por Link): as imagens que o painel
desenha vão pra pasta `painel/` do seu repositório.

## Como usar (só o mestre)

1. Cole o link da **planilha das fichas** (compartilhada como "qualquer pessoa com o link pode ver").
2. Em **Jogadores**, um por aba da planilha: o nome da aba, o visual e o retrato (imagem sem fundo; se vier com
   fundo branco, o painel tira o branco das bordas sozinho). Os retratos da pasta `retratos/` da extensão podem
   ser usados como `retratos/noah.webp`.
3. **Atualizar cartões**: lê as fichas, desenha os cartões que mudaram, manda pro GitHub e coloca ao lado do mapa.
   Depois de colocados, você pode mover os cartões: eles ficam onde você deixar.
4. **Montar a moldura do mapa**: uma vez só (ou quando mudar o título).

Com **Conferir a planilha sozinho** ligado, o painel olha as fichas a cada 5 minutos enquanto o mestre está na
sala e só redesenha o cartão de quem mudou. O jogador só mexe na planilha.

### O que vem da planilha

| No cartão | Na aba do jogador |
|---|---|
| Nome | a célula logo acima de "Treinador de X • Nível N" |
| Região e nível | "Treinador de X • Nível N" |
| Dinheiro | a célula que começa com ₽ |
| Insígnias | as duas linhas de 4 caixinhas em "Caixa de Insígnias" (1 a 4, depois 5 a 8) |
| Equipe | a lista embaixo de "Tera" ("Raichu (Gelo)"), coluna F |

A equipe entra como sprites animados por cima do cartão, tirados da biblioteca da Imagem por Link. Pokémon com
**apelido** (ex.: "Snow") aparece numa lista pra você dizer a espécie ou colar o link de uma imagem, uma vez só.

### Equipe pela PA Liga

Com o link do **site dos jogadores da PA Liga** no campo "Site da PA Liga", a equipe de cada cartão passa a ser o
time atual do treinador na liga: o que o site carrega mais as trocas que o próprio jogador faz online (as mesmas
que o site aplica). O treinador é achado pelo nome da ficha (ou pelo "Nome na PA Liga" do jogador, se for
diferente). Quem não for achado continua com a equipe da planilha. Formas regionais ("Vulpix de Alola") usam o
sprite da forma.

### Visuais

- **Futuro (verde / ciano)**: neon e hexágonos.
- **Passado (papel claro)**: tinta e papel.
- **Passado escuro (com brilho)**: papel escuro, lua e faíscas douradas.
- **Passado frio (relógio)**: papel acinzentado, um relógio ao fundo e um fio de rachadura no canto.

## Para quem mantém

- `desenho.js`: os desenhos em SVG (cartão e moldura), em unidades do layout de referência.
- `planilha.js`: leitura da planilha (Google guarda um tipo por coluna: listas de texto em colunas de caixinhas
  são pedidas em faixas separadas).
- `paliga.js`: leitura dos times da PA Liga (site publicado + `ig_rosters` do banco dela).
- `motor.js`: SVG → imagem, envio pro GitHub (`../imagem-link/gh.js`), itens da cena.
- Testar fora do Owlbear (na raiz do repositório, `python -m http.server 8792`):
  `painel-campanha/tools/ver.html` (os cartões de verdade, lendo a planilha), `ver.html?moldura` (a moldura) e
  `tools/preview.html` (a tela, com um Owlbear de mentira).
