import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const btnVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400',
  secondary:
    'bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-500 border border-slate-700',
  ghost:
    'bg-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white disabled:text-slate-600',
  danger:
    'bg-rose-600/90 text-white hover:bg-rose-500 disabled:bg-slate-700 disabled:text-slate-400',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400',
};

const btnSizes: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-md',
  md: 'text-sm px-4 py-2.5 rounded-lg',
  lg: 'text-sm px-5 py-3 rounded-lg font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed',
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  as: Tag = 'div',
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag
      className={cn(
        'bg-[var(--surface)] border border-[var(--border)] rounded-xl',
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
        {description ? (
          <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'money';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  danger: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  money: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'money' | 'info';
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-400'
      : tone === 'warning'
        ? 'text-amber-400'
        : tone === 'money'
          ? 'text-amber-400'
          : tone === 'info'
            ? 'text-cyan-400'
            : 'text-slate-50';
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p className={cn('text-2xl font-bold tabular mt-1', valueClass)}>{value}</p>
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </Card>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-400 mb-1.5">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-rose-400 mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-slate-500 mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        'w-full bg-slate-900/80 border border-slate-700 text-slate-100 rounded-lg px-3.5 py-2.5 text-sm',
        'placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full bg-slate-900/80 border border-slate-700 text-slate-100 rounded-lg px-3.5 py-2.5 text-sm',
        'focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto w-10 h-10 rounded-full border border-dashed border-slate-600 flex items-center justify-center text-slate-500 mb-3">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-4l-2 2h-4l-2-2H4"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description ? (
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin h-4 w-4', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'success' | 'warning' | 'info';
  children: ReactNode;
}) {
  const tones = {
    danger: 'border-rose-800/60 bg-rose-950/40 text-rose-200',
    success: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-200',
    warning: 'border-amber-800/60 bg-amber-950/40 text-amber-200',
    info: 'border-cyan-800/60 bg-cyan-950/40 text-cyan-200',
  };
  return (
    <div className={cn('border rounded-lg px-3.5 py-3 text-sm', tones[tone])} role="status">
      {children}
    </div>
  );
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main id="main" className="min-h-screen">
      <div className="signal-rule" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </main>
  );
}
