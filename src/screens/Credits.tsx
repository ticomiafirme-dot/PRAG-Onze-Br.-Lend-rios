import { CLUBS } from '../data/clubs';
import { BackLink } from '../components/ui';

export function Credits() {
  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow">Transparência</div>
          <h1>Fontes e créditos</h1>
        </div>
        <BackLink to="/" />
      </div>
      <div className="stack prose">
        <section className="panel">
          <h2>Dados históricos</h2>
          <p>
            As passagens dos jogadores pelos clubes (anos, jogos e gols) foram extraídas das infobox dos artigos da{' '}
            <a href="https://pt.wikipedia.org" target="_blank" rel="noreferrer">
              Wikipédia em português
            </a>{' '}
            (e, quando o artigo em português não tinha a infobox de futebolista, da{' '}
            <a href="https://en.wikipedia.org" target="_blank" rel="noreferrer">
              Wikipédia em inglês
            </a>
            ). Cada jogador do banco tem um link para o artigo usado como fonte, na página do clube.
          </p>
          <p>
            Um jogador só é elegível para uma década se a fonte registra passagem pelo clube naquela década. Nenhuma passagem foi criada
            manualmente. Títulos dos clubes: listas de campeões do Campeonato Brasileiro (com a unificação de 2010), da Copa do Brasil e da Copa
            Libertadores, até a temporada 2025.
          </p>
        </section>
        <section className="panel">
          <h2>Notas dos jogadores</h2>
          <p>
            As notas (1 a 99) são avaliações editoriais do jogo, não notas oficiais. Ídolos e jogadores marcantes têm nota definida pela curadoria
            considerando qualidade técnica, importância histórica no clube, desempenho na passagem, títulos e auge. Os demais recebem a nota
            pela fórmula editorial: 61 + peso dos jogos pelo clube (até 13) + gols (até 7) + jogos pela seleção principal (até 14), limitada a 86.
          </p>
        </section>
        <section className="panel">
          <h2>Escudos e identidade</h2>
          <p>
            Os emblemas exibidos são desenhos originais do jogo, feitos com as cores de cada clube; não reproduzem os escudos oficiais, que são
            marcas registradas. Nomes de clubes e jogadores são usados apenas para referência histórica. Este é um projeto de fã, sem vínculo com
            clubes, federações ou com o site Perfect Season FC, cujas mecânicas inspiraram o jogo.
          </p>
        </section>
        <section className="panel">
          <h2>Clubes</h2>
          <ul className="credits-clubs">
            {CLUBS.map((c) => (
              <li key={c.id}>
                <a href={c.sources[0]} target="_blank" rel="noreferrer">
                  {c.fullName}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Avatares dos jogadores</h2>
          <p className="muted">
            Os avatares são ilustrações originais do jogo, desenhadas por código em estilo vetorial. Não usam fotos. Cada jogador tem um avatar para cada
            clube e época em que aparece, com a camisa daquele clube e a gola típica da década. Os personagens lembram traços gerais e públicos dos
            jogadores mais conhecidos (cabelo, barba, faixa), sem reproduzir rostos reais; os demais recebem um visual gerado, coerente com a época. Os
            escudos e uniformes são versões originais nas cores de cada clube.
          </p>
        </section>
      </div>
    </div>
  );
}
