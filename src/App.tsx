import { useEffect } from 'react';
import { useRoute } from './router';
import { cloudEnabled } from './cloud/config';
import { useAuth } from './cloud/auth';
import { initSession } from './cloud/session';
import { backfillRun } from './history/hooks';
import { useGame } from './state/store';
import { UnlockOverlay } from './components/UnlockOverlay';
import { SyncConflictDialog } from './components/SyncConflictDialog';
import { AuthErrorBar } from './components/Account';
import { goPlay } from './components/MainMenu';
import { Perfil } from './screens/Perfil';
import { Historico } from './screens/Historico';
import { Temporada } from './screens/Temporada';
import { Conquistas } from './screens/Conquistas';
import { Recordes } from './screens/Recordes';
import { Hall } from './screens/Hall';
import { Header } from './components/ui';
import { Home } from './screens/Home';
import { ClubSelect } from './screens/ClubSelect';
import { ClubPage } from './screens/ClubPage';
import { FormationSelect } from './screens/FormationSelect';
import { Draft } from './screens/Draft';
import { Lineup } from './screens/Lineup';
import { Captain } from './screens/Captain';
import { Preseason } from './screens/Preseason';
import { Championship } from './screens/Championship';
import { MatchScreen } from './screens/Match';
import { Stats } from './screens/Stats';
import { Final } from './screens/Final';
import { Ranking } from './screens/Ranking';
import { HowTo } from './screens/HowTo';
import { Credits } from './screens/Credits';

let started = false;

/** Recupera a sessão (ou segue como visitante) e registra no histórico a partida salva. */
function startApp(): void {
  if (started) return;
  started = true;
  if (!cloudEnabled) {
    backfillRun(useGame.getState().run);
    return;
  }
  void initSession().then(() => {
    if (useAuth.getState().status !== 'signed-in') backfillRun(useGame.getState().run);
  });
}

export function App() {
  const route = useRoute();
  useEffect(startApp, []);
  useEffect(() => {
    if (route.path === '/jogar') goPlay();
  }, [route.path]);
  let screen;
  switch (route.path) {
    case '/clubes':
      screen = <ClubSelect />;
      break;
    case '/clube/:id':
      screen = <ClubPage id={route.params.id} />;
      break;
    case '/formacao':
      screen = <FormationSelect />;
      break;
    case '/draft':
      screen = <Draft />;
      break;
    case '/escalacao':
      screen = <Lineup />;
      break;
    case '/capitao':
      screen = <Captain />;
      break;
    case '/pre-temporada':
      screen = <Preseason />;
      break;
    case '/campeonato':
      screen = <Championship />;
      break;
    case '/partida':
      screen = <MatchScreen />;
      break;
    case '/estatisticas':
      screen = <Stats />;
      break;
    case '/resultado':
      screen = <Final />;
      break;
    case '/ranking':
      screen = <Ranking />;
      break;
    case '/como-jogar':
      screen = <HowTo />;
      break;
    case '/creditos':
      screen = <Credits />;
      break;
    case '/perfil':
      screen = <Perfil />;
      break;
    case '/historico':
      screen = <Historico />;
      break;
    case '/temporada/:id':
      screen = <Temporada id={route.params.id} />;
      break;
    case '/conquistas':
      screen = <Conquistas />;
      break;
    case '/recordes':
      screen = <Recordes />;
      break;
    case '/hall':
      screen = <Hall />;
      break;
    default:
      screen = <Home />;
  }
  return (
    <div className="app">
      <Header />
      <main key={route.path + (route.params.id ?? '')}>{screen}</main>
      <UnlockOverlay />
      <SyncConflictDialog />
      <AuthErrorBar />
    </div>
  );
}
