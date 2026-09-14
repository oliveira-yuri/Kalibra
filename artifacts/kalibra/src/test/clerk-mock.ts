import type { ReactNode } from 'react';

export const TEST_USER = { id: 'user_snapshot', firstName: 'Yuri' };

export const clerkReactMock = {
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  Show: ({ when, children }: { when: string; children: ReactNode }) =>
    when === 'signed-in' ? children : null,
  useClerk: () => ({ signOut: () => {} }),
  useUser: () => ({ user: TEST_USER, isLoaded: true, isSignedIn: true }),
};
