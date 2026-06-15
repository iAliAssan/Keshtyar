'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { createClient } from '@/lib/supabase';
import type { User, Relay, AutomationRule, AlertRule, SensorData, WeatherForecast } from '@/types';

// ==================== Theme Provider ====================
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProviderInner>
      {children}
    </ThemeProviderInner>
  );
}

function ThemeProviderInner({ children }: { children: React.ReactNode }) {
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
}>({ user: null, loading: true, signOut: async () => {}, refreshUser: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => fetchUser());
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ====================== Custom Hooks ====================
export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-up');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal-on-scroll').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ==================== UI Components ====================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const baseStyles = 'rounded-xl font-medium transition-all duration-200 hover:translate-y-[-2px] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  const variantStyles = {
    primary: 'bg-[#9CB080] text-white hover:bg-[#7A8F60] shadow-lg hover:shadow-xl',
    secondary: 'bg-[#6C91B3] text-white hover:bg-[#5A7A9A] shadow-lg hover:shadow-xl',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    warning: 'bg-yellow-500 text-black hover:bg-yellow-600',
    outline: 'border-2 border-[#9CB080] text-[#9CB080] bg-transparent hover:bg-[#9CB080] hover:text-white',
  };
  return (
    <button className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`} disabled={disabled || loading} {...props}>
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

export function Card({ children, className = '', hover = true, onClick }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-[var(--card-bg)] transition-all duration-300 ${hover ? 'hover:translate-y-[-5px] hover:shadow-2xl' : ''} ${className}`}
      style={{ boxShadow: 'var(--card-shadow)' }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="bg-[var(--card-bg)] rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)]">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-2xl hover:text-[#9CB080]">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="mb-4">
      {label && <label className="block mb-2 font-medium text-[var(--text-primary)]">{label}</label>}
      <input
        className={`w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[#9CB080] focus:ring-2 focus:ring-[#9CB080]/20 transition-all ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="mb-4">
      {label && <label className="block mb-2 font-medium text-[var(--text-primary)]">{label}</label>}
      <select
        className={`w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[#9CB080] ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ==================== Layout Components ====================
export function Sidebar() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const menuItems = [
    { href: '/dashboard', icon: 'fas fa-tachometer-alt', label: 'داشبورد' },
    { href: '/history', icon: 'fas fa-chart-line', label: 'تاریخچه' },
    { href: '/relays', icon: 'fas fa-plug', label: 'رله‌ها' },
    { href: '/rules', icon: 'fas fa-cogs', label: 'قوانین اتوماسیون' },
    { href: '/alerts', icon: 'fas fa-bell', label: 'هشدارها' },
    { href: '/settings', icon: 'fas fa-user-cog', label: 'تنظیمات' },
    { href: '/device-config', icon: 'fas fa-microchip', label: 'تنظیمات دستگاه' },
  ];

  return (
    <>
      <button onClick={() => setIsMobileOpen(true)} className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-xl bg-[#9CB080] text-white shadow-lg">
        <i className="fas fa-bars text-xl"></i>
      </button>
      <aside className={`
        fixed right-0 top-0 h-full w-72 z-40 transition-all duration-300
        bg-[var(--card-bg)] border-l border-[var(--border-color)] shadow-xl
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <div className="text-center mb-8">
            <i className="fas fa-leaf text-4xl text-[#9CB080]"></i>
            <h2 className="text-2xl font-bold mt-2">AURON</h2>
            <p className="text-sm text-[var(--text-secondary)]">Intelligent Systems</p>
          </div>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <a key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#9CB080]/10 transition-all hover:translate-x-[-4px] group">
                <i className={`${item.icon} w-5 text-[#9CB080]`}></i>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
          <div className="absolute bottom-20 left-0 right-0 px-6 space-y-3">
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[#9CB080]/10">
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
              <span>{isDark ? 'حالت روشن' : 'حالت تاریک'}</span>
            </button>
            <button onClick={signOut} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-red-500 border border-red-500/30 hover:bg-red-500/10">
              <i className="fas fa-sign-out-alt"></i>
              <span>خروج</span>
            </button>
          </div>
        </div>
      </aside>
      {isMobileOpen && <div className="fixed inset-0 bg-black/50 z-35 lg:hidden" onClick={() => setIsMobileOpen(false)}></div>}
    </>
  );
}

export function Footer() {
  return (
    <footer className="py-6 text-center border-t border-[var(--border-color)] mt-8">
      <p className="text-[var(--text-secondary)]">
        <i className="fas fa-seedling text-[#9CB080] ml-1"></i>
        AURON · Intelligent Systems · <a href="https://auron.ir" target="_blank" rel="noopener noreferrer" className="text-[#9CB080] hover:underline">auron.ir</a>
      </p>
      <p className="text-xs text-[var(--text-secondary)] mt-1">۱۴۰۵ · تمامی حقوق محفوظ است</p>
    </footer>
  );
}
