'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { createClient } from '@/lib/supabase';
import type { User } from '@/types';

// ==================== Theme Provider ====================
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{children}</>;
  return <>{children}</>;
}

export function useTheme() {
  const { theme, setTheme } = useNextTheme();
  return { theme, setTheme, isDark: theme === 'dark' };
}

// ==================== Auth Context ====================
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setUser(data as User);
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => fetchUser());
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signOut, refreshUser: fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ==================== UI Components ====================
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'rounded-xl font-medium transition-all duration-200 hover:translate-y-[-2px] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  const variantStyles = {
    primary:
      'bg-[#9CB080] text-white hover:bg-[#7A8F60] shadow-lg hover:shadow-xl',
    secondary:
      'bg-[#6C91B3] text-white hover:bg-[#5A7A9A] shadow-lg hover:shadow-xl',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    warning: 'bg-yellow-500 text-black hover:bg-yellow-600',
    outline:
      'border-2 border-[#9CB080] text-[#9CB080] bg-transparent hover:bg-[#9CB080] hover:text-white',
  };
  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <i className="fas fa-spinner fa-spin ml-2"></i> : null}
      {children}
    </button>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className = '',
  hover = true,
  onClick,
}: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-[var(--card-bg)] transition-all duration-300 ${
        hover ? 'hover:translate-y-[-5px] hover:shadow-2xl' : ''
      } ${className}`}
      style={{ boxShadow: 'var(--card-shadow)' }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block mb-2 font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[#9CB080] focus:ring-2 focus:ring-[#9CB080]/20 transition-all ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ==================== Layout Components (بدون Sidebar خودکار) ====================
export function Footer() {
  return (
    <footer className="py-6 text-center border-t border-[var(--border-color)] mt-8">
      <p className="text-[var(--text-secondary)]">
        <i className="fas fa-seedling text-[#9CB080] ml-1"></i>
        AURON · Intelligent Systems ·{' '}
        <a
          href="https://auron.ir"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#9CB080] hover:underline"
        >
          auron.ir
        </a>
      </p>
      <p className="text-xs text-[var(--text-secondary)] mt-1">
        ۱۴۰۵ · تمامی حقوق محفوظ است
      </p>
    </footer>
  );
}
