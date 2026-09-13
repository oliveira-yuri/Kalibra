import { type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show } from '@clerk/react';
import { ptBR } from '@clerk/localizations';
import { ErrorBoundary } from '@/components/error-boundary';
import { Home } from '@/pages/Home';
import { Portal } from '@/pages/Portal';
import { NovoWorkspace } from '@/pages/NovoWorkspace';
import { NotFound } from '@/pages/NotFound';
import { WorkspaceRouter } from '@/routes/WorkspaceApp';
import { buildClerkAppearance, clerkPubKey, clerkProxyUrl } from '@/config/clerk';
import type { Theme } from '@/types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/portal" />
      </Show>
      <Show when="signed-out">
        <Home theme={theme} onToggleTheme={onToggleTheme} />
      </Show>
    </>
  );
}

function PortalRedirect({ theme, onToggleTheme }: { theme: Theme, onToggleTheme: () => void }) {
  return (
    <>
      <Show when="signed-in">
        <Portal theme={theme} onToggleTheme={onToggleTheme} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function WorkspaceRedirect({ theme, onToggleTheme }: { theme: Theme, onToggleTheme: () => void }) {
  return (
    <>
      <Show when="signed-in">
        <WorkspaceRouter theme={theme} onToggleTheme={onToggleTheme} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkProviderWithRoutes({ theme, onToggleTheme }: { theme: Theme, onToggleTheme: () => void }) {
  const [, setLocation] = useLocation();
  
  if (!clerkPubKey) {
    return <div className="p-8 text-center text-[#ff907d]">Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables.</div>;
  }

  const clerkAppearance = buildClerkAppearance(theme);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={ptBR}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={() => <HomeRedirect theme={theme} onToggleTheme={onToggleTheme} />} />
        <Route path="/sign-in/*?">
          <div className={`flex min-h-[100dvh] items-center justify-center px-4 ${theme === 'dark' ? 'bg-[#10131a] text-[#f0f0e8]' : 'bg-[#f6f8f7] text-[#16232b]'}`}>
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          </div>
        </Route>
        <Route path="/sign-up/*?">
          <div className={`flex min-h-[100dvh] items-center justify-center px-4 ${theme === 'dark' ? 'bg-[#10131a] text-[#f0f0e8]' : 'bg-[#f6f8f7] text-[#16232b]'}`}>
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          </div>
        </Route>
        <Route path="/portal/novo-workspace">
          <Show when="signed-in">
            <NovoWorkspace theme={theme} onToggleTheme={onToggleTheme} />
          </Show>
          <Show when="signed-out">
            <Redirect to="/" />
          </Show>
        </Route>
        <Route path="/portal">
          <PortalRedirect theme={theme} onToggleTheme={onToggleTheme} />
        </Route>
        <Route path="/workspace/:slug/*?">
          <WorkspaceRedirect theme={theme} onToggleTheme={onToggleTheme} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </ClerkProvider>
  );
}

export function AppRoutes({ theme, onToggleTheme }: { theme: Theme, onToggleTheme: () => void }) {
  return (
    <RoutedErrorBoundary>
      <ClerkProviderWithRoutes theme={theme} onToggleTheme={onToggleTheme} />
    </RoutedErrorBoundary>
  );
}
