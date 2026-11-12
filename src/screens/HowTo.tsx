import { BackLink } from '../components/ui';
import { LINK_COLORS } from '../components/Pitch';
import { TIER_LABEL } from '../components/PlayerCard';

export function HowTo() {
  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow">Regras</div>
          <h1>Como jogar</h1>
        </div>
        <BackLink to="/" />
      </div>
      <div className="stack prose">
        <section className="panel">
          <h2>1. Clube, década e formação</h2>
          <p>
            Escolha um dos 20 clubes do Brasileirão (ou um convidado dos estaduais). Na página do clube você vê as décadas em que ele fez
            história. Escolha <strong>Todas as décadas</strong> para o modo Clássico ou uma década específica para a <strong>Era Única</strong>.
            Depois, escolha entre 6 formações: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 4-1-4-1 e 3-4-3.
          </p>
        </section>
        <section className="panel">
          <h2>2. O draft</h2>
          <ul>
            <li>A cada rodada o jogo sorteia uma década (no modo Mistura, um clube e uma década).</li>
            <li>
              As posições são divididas em quatro categorias: <strong>Goleiros (GOL)</strong>, <strong>Defensores (DEF)</strong>,{' '}
              <strong>Meio-campistas (MEI)</strong> e <strong>Atacantes (ATA)</strong>.
            </li>
            <li>As vagas do campo cuja categoria tem jogadores daquela década brilham em dourado. Escolha a categoria (ou toque na vaga) para ver as opções.</li>
            <li>Escolha um jogador para preencher a vaga. São 11 rodadas até completar o time titular.</li>
            <li>
              Você tem <strong>5 novos sorteios</strong> por draft. Eles não voltam.
            </li>
            <li>
              Um jogador nunca aparece duas vezes no seu time e só atua na categoria em que jogou de verdade. Dentro da categoria, ocupa qualquer vaga:
              um defensor pode ser zagueiro ou lateral; um meio-campista, volante ou meia; um atacante, ponta ou centroavante.
            </li>
            <li>Na Era Única, a década é fixa e o sorteio define quais três jogadores aparecem para cada categoria.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>3. Notas (overall)</h2>
          <p>
            Cada jogador tem uma nota de 1 a 99 por década em que atuou pelo clube. As notas são <strong>avaliações editoriais</strong> do jogo,
            não notas oficiais. Níveis das cartas: {Object.values(TIER_LABEL).join(', ')}.
          </p>
        </section>
        <section className="panel">
          <h2>4. Química e capitão</h2>
          <p>Jogadores vizinhos no campo formam ligações. Cada ligação vale de 0 a 3 pontos:</p>
          <ul>
            <li>+1 se atuaram no mesmo clube (o clube da carta ou qualquer clube da base em que ambos passaram);</li>
            <li>+1 se são da mesma década;</li>
            <li>+1 se têm a mesma nacionalidade.</li>
          </ul>
          <p className="row wrap" style={{ gap: 12 }}>
            {LINK_COLORS.map((c, i) => (
              <span key={c} className="row" style={{ gap: 6 }}>
                <i style={{ display: 'inline-block', width: 22, height: 4, background: c, borderRadius: 2 }} /> {i} ponto(s)
              </span>
            ))}
          </p>
          <p>
            A química individual (0–10) muda o overall em até ±2, e a química do time (0–100) soma até ±2,5 em cada setor. O{' '}
            <strong>capitão</strong> ganha +3 de overall, usa a faixa e suas ligações e sua química individual contam em dobro. Ele pode ser
            trocado até o início da temporada.
          </p>
        </section>
        <section className="panel">
          <h2>5. A temporada</h2>
          <ul>
            <li>Brasileirão com 20 clubes, 38 rodadas em turno e returno: 3 pontos por vitória, 1 por empate.</li>
            <li>Cada rival escala jogadores históricos do próprio clube, de uma década sorteada (ou a seleção de todos os tempos, no Lendário).</li>
            <li>
              O motor de simulação considera overall, química, formação, força de ataque, meio e defesa, fator casa e uma dose de imprevisibilidade.
            </li>
            <li>Assista às partidas em 1x, 2x ou 4x, ou pule direto para o resultado. O resultado de cada jogo é definitivo.</li>
            <li>O objetivo máximo: a campanha perfeita, com 38 vitórias, 0 empates e 0 derrotas.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>6. Modos</h2>
          <ul>
            <li>
              <strong>Clássico</strong>: você escolhe o clube; as décadas são sorteadas.
            </li>
            <li>
              <strong>Era Única</strong>: clube e década fixos.
            </li>
            <li>
              <strong>Mistura Brasileira</strong>: clube e década sorteados a cada rodada.
            </li>
            <li>
              <strong>Desafio Diário</strong>: mesmo clube, década, formação e sorteios para todos; uma tentativa por dia.
            </li>
            <li>
              <strong>Desafio Semanal</strong>: um clube por semana, nível Difícil.
            </li>
            <li>
              <strong>Tríplice Coroa</strong>: estadual, Copa do Brasil (mata-mata de ida e volta, com pênaltis) e Brasileirão na mesma temporada.
            </li>
          </ul>
          <p className="dim">O progresso é salvo automaticamente neste navegador. O ranking também fica salvo neste dispositivo.</p>
        </section>
      </div>
    </div>
  );
}
