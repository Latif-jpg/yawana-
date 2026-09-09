import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalSession = async () => {
    setSession(null);
    setUser(null);

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('[auth] local session cleanup skipped:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (error || !data.session) {
          if (error || data.session === null) {
            await clearLocalSession();
          }
          setIsLoading(false);
          return;
        }

        setSession(data.session);
        setUser(data.session.user ?? null);
      } catch (error) {
        if (isMounted) {
          await clearLocalSession();
        }
        console.warn('[auth] session load failed:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) {
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (nextSession) {
        setSession(nextSession);
        setUser(nextSession.user ?? null);
        setIsLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        await clearLocalSession();
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await clearLocalSession();
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
