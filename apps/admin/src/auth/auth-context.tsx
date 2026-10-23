import { useQueryClient } from '@tanstack/react-query';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useApi } from '@/api/api-provider';
import { ApiError, unwrap } from '@/api/errors';
import type { AdminMe } from '@/api/types';
import type { SessionStore } from './session';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface Auth {
  status: AuthStatus;
  me: AdminMe | undefined;
  /** Signs in with email and password. Throws an {@link ApiError}; a valid account without admin access is refused. */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Reloads who is signed in (name, photo) after they changed their own details. */
  reload: () => Promise<void>;
  /** Takes a new access token for the SAME session (the second step was just proved) and reloads who is signed in. */
  adoptAccessToken: (accessToken: string) => Promise<void>;
  /** The screen that asks for a fresh authenticator code registers here; returns the way to unregister. */
  registerStepUp: (handler: () => Promise<boolean>) => () => void;
  /**
   * Does the signed-in administrator hold this permission — for this drawer, when given? A convenience for the UI
   * only: the server checks every request again.
   */
  can: (permission: string, drawerId?: string) => boolean;
}

const AuthContext = createContext<Auth | undefined>(undefined);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

export function canWith(me: AdminMe | undefined, permission: string, drawerId?: string): boolean {
  if (!me) return false;
  if (me.superAdmin) return true;
  if (!me.permissions.includes(permission)) return false;
  const scope = me.drawerScopes.find((s) => s.permission === permission);
  if (!scope || drawerId === undefined) return true; // unrestricted, or "some drawer" is enough
  return scope.drawerIds.includes(drawerId);
}

export function AuthProvider({
  session,
  children,
}: {
  session: SessionStore;
  children: ReactNode;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<AdminMe | undefined>(undefined);
  const started = useRef(false);

  const loadMe = useCallback(async (): Promise<void> => {
    const loaded = unwrap(await api.GET('/v1/admin/me'));
    setMe(loaded);
    setStatus('authenticated');
  }, [api]);

  const endSession = useCallback(() => {
    setMe(undefined);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // Restore a session after a reload: the browser still has the HttpOnly refresh cookie, the access token is gone.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const fresh = unwrap(await api.POST('/v1/auth/session/refresh'));
        session.setAccess(fresh.accessToken);
        await loadMe();
      } catch (error) {
        // No cookie or a refused one means signed out; a network error just leaves the person signed out for now.
        if (error instanceof ApiError) session.clear();
        setStatus('anonymous');
      }
    })();
  }, [api, session, loadMe]);

  useEffect(() => session.onForcedSignOut(endSession), [session, endSession]);

  const adopt = useCallback(
    async (tokens: { accessToken: string }) => {
      session.setAccess(tokens.accessToken);
      try {
        await loadMe();
      } catch (error) {
        session.clear();
        setStatus('anonymous');
        if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
          throw new ApiError(
            403,
            'NO_ADMIN_ACCESS',
            'This account has no access to the admin panel.',
          );
        }
        throw error;
      }
    },
    [session, loadMe],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = unwrap(
        await api.POST('/v1/auth/session/login', { body: { email, password } }),
      );
      await adopt(tokens);
    },
    [api, adopt],
  );

  const signOut = useCallback(async () => {
    session.clear();
    endSession();
    try {
      await api.POST('/v1/auth/session/logout');
    } catch {
      // The session is gone locally either way.
    }
  }, [api, session, endSession]);

  const value = useMemo<Auth>(
    () => ({
      status,
      me,
      signIn,
      signOut,
      reload: loadMe,
      registerStepUp: (handler: () => Promise<boolean>) => session.setStepUpHandler(handler),
      adoptAccessToken: async (accessToken: string) => {
        session.setAccess(accessToken);
        await loadMe();
      },
      can: (permission, drawerId) => canWith(me, permission, drawerId),
    }),
    [status, me, signIn, signOut, loadMe, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
