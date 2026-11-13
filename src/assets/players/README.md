# Ilustrações próprias dos jogadores (opcional)

Por padrão, todo avatar é gerado pelo jogo (veja `docs/AVATARES.md`). Para usar uma ilustração própria em uma combinação jogador + clube, coloque a imagem aqui:

```
src/assets/players/<id-do-jogador>/<id-do-clube>.png
src/assets/players/<id-do-jogador>/<id-do-clube>-<década>.png   (só para aquela época)
```

Exemplos: `pele/santos.png`, `socrates-futebolista/corinthians.png`, `ronaldinho-gaucho/gremio-1990s.png`.

- O id do jogador é o campo `id` em `src/data/players/<clube>.json` (único por pessoa, então homônimos não se confundem).
- Formatos: PNG, WebP, JPG ou SVG. Use fundo transparente e enquadramento quadrado com cabeça, ombros e parte do peito: o jogo põe o fundo e o aro na cor da carta.
- Se a imagem não carregar, o jogo volta para o avatar gerado.
