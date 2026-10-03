import React from 'react';
import { LegalPage } from '../components/legal/LegalPage';
import { PRIVACY } from '../lib/legal';

export default function PrivacyPage() {
  return <LegalPage kind="privacidad" title="Política de privacidad y tratamiento de datos" intro={PRIVACY.intro} sections={PRIVACY.sections} />;
}
