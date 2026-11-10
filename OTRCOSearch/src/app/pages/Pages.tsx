import { ExtensionPointApiActions, PagesContext } from '@hubspot/ui-extensions';
import { hubspot } from '@hubspot/ui-extensions';
import {
  createPageRouter,
  PageRoutes,
  PageRoutesLayoutProps,
} from '@hubspot/ui-extensions/pages';
import { HomePage, AppContext } from './HomePage.tsx';

interface PagesExtensionProps {
  context: PagesContext;
  actions: ExtensionPointApiActions<'pages'>;
}

const PageLayout = ({ children }: PageRoutesLayoutProps) => {
  return <>{children}</>;
};

const PageRouter = createPageRouter(
  <PageRoutes layoutComponent={PageLayout}>
    <PageRoutes.IndexRoute component={HomePage} />
  </PageRoutes>,
);

const PagesExtension = ({ context, actions }: PagesExtensionProps) => {
  return (
    <AppContext.Provider value={{ context, actions }}>
      <PageRouter />
    </AppContext.Provider>
  );
};

hubspot.extend<'pages'>(({ context, actions }: PagesExtensionProps) => (
  <PagesExtension context={context} actions={actions} />
));