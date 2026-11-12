import { useRoute } from './router';
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

export function App() {
  const route = useRoute();
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
    default:
      screen = <Home />;
  }
  return (
    <div className="app">
      <Header />
      <main key={route.path + (route.params.id ?? '')}>{screen}</main>
    </div>
  );
}
