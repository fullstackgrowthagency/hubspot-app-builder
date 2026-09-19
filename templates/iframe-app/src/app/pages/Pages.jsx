import { hubspot } from '@hubspot/ui-extensions';
import { createPageRouter, PageRoutes } from '@hubspot/ui-extensions/pages';
import { HomePage } from './HomePage.jsx';

const PageRouter = createPageRouter(
  <PageRoutes>
    <PageRoutes.IndexRoute component={HomePage} />
  </PageRoutes>
);

hubspot.extend(() => <PageRouter />);
