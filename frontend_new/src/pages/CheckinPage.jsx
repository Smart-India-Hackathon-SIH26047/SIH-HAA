import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PageShell from '../components/PageShell';
import CheckinForm from '../components/CheckinForm';

export default function CheckinPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();

  const personId = searchParams.get('person_id') || user?.id || 'P101';

  return (
    <PageShell footer>
      <div className="min-h-full flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          {/* Section label */}
          <div className="text-xs font-bold uppercase tracking-widest text-brand mb-4 text-center">
            Check in
          </div>

          {/* Large heading */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink leading-tight mb-2 text-center">
            {t('checkinTitle')}
          </h1>
          <p className="text-sm text-muted mb-8 max-w-md leading-relaxed text-center mx-auto">
            You can share as much or as little as feels comfortable.
          </p>

          <CheckinForm initialPersonId={personId} />
        </div>
      </div>
    </PageShell>
  );
}
