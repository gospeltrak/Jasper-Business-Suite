import { AlertTriangle, ArrowLeft, Home, LockKeyhole, RefreshCw, SearchX, ShieldX } from 'lucide-react';
import { useTranslation, type LanguageType } from '../LanguageContext';

export type SystemErrorStatus = 401 | 403 | 404 | 500;

type SystemErrorPageProps = {
  status: SystemErrorStatus;
  onHome?: () => void;
  onBack?: () => void;
  onRetry?: () => void;
};

const copy: Record<LanguageType, Record<SystemErrorStatus, { title: string; message: string }>> = {
  en: {
    401: { title: 'Please sign in again', message: 'Your session has ended. Sign in to continue securely.' },
    403: { title: 'Access not allowed', message: 'Your account does not have permission to open this page.' },
    404: { title: 'Page not found', message: 'The page you are looking for is unavailable or has moved.' },
    500: { title: 'Something went wrong', message: 'The system could not complete this request. Please try again.' },
  },
  sw: {
    401: { title: 'Tafadhali ingia tena', message: 'Muda wako wa kuingia umeisha. Ingia ili uendelee kwa usalama.' },
    403: { title: 'Huruhusiwi kufungua hapa', message: 'Akaunti yako haina ruhusa ya kufungua ukurasa huu.' },
    404: { title: 'Ukurasa haujapatikana', message: 'Ukurasa unaoutafuta haupatikani au umehamishwa.' },
    500: { title: 'Mfumo umepata changamoto', message: 'Ombi hili halijakamilika. Tafadhali jaribu tena.' },
  },
  fr: {
    401: { title: 'Veuillez vous reconnecter', message: 'Votre session est terminée. Connectez-vous pour continuer en toute sécurité.' },
    403: { title: 'Accès non autorisé', message: "Votre compte n’est pas autorisé à ouvrir cette page." },
    404: { title: 'Page introuvable', message: 'La page demandée est indisponible ou a été déplacée.' },
    500: { title: 'Un problème est survenu', message: "Le système n’a pas pu terminer cette demande. Veuillez réessayer." },
  },
};

const icons = { 401: LockKeyhole, 403: ShieldX, 404: SearchX, 500: AlertTriangle } as const;

export default function SystemErrorPage({ status, onHome, onBack, onRetry }: SystemErrorPageProps) {
  const { lang } = useTranslation();
  const text = copy[lang]?.[status] || copy.en[status];
  const Icon = icons[status];
  const homeLabel = lang === 'sw' ? 'Nenda nyumbani' : lang === 'fr' ? "Retour à l’accueil" : 'Go home';
  const backLabel = lang === 'sw' ? 'Rudi nyuma' : lang === 'fr' ? 'Retour' : 'Go back';
  const retryLabel = lang === 'sw' ? 'Jaribu tena' : lang === 'fr' ? 'Réessayer' : 'Try again';

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-5 py-10 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-9">
        <img src="/jb-logo.png" alt="Orvix" className="mx-auto h-12 w-12 object-contain" />
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-black tracking-[0.22em] text-emerald-700 dark:text-emerald-400">ERROR {status}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{text.title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{text.message}</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {status === 500 && onRetry ? (
            <button type="button" onClick={onRetry} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
              <RefreshCw className="h-4 w-4" />{retryLabel}
            </button>
          ) : (
            <button type="button" onClick={onHome || (() => window.location.assign('/'))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
              <Home className="h-4 w-4" />{homeLabel}
            </button>
          )}
          <button type="button" onClick={onBack || (() => window.history.back())} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" />{backLabel}
          </button>
        </div>
      </section>
    </main>
  );
}
