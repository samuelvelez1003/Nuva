import React from 'react';
import { LegalPage } from '../components/legal/LegalPage';
import { TERMS } from '../lib/legal';

export default function TermsPage() {
  return <LegalPage kind="terminos" title="Términos y condiciones de uso" intro={TERMS.intro} sections={TERMS.sections} />;
}
