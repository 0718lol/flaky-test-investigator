import { Code2, ExternalLink, Heart, Info, Scale } from 'lucide-react'
import React from 'react'
import { useTranslation } from '../../i18n'
import Section from './Section'

interface Props {
  appVersion: string
}

export default function AboutTab({ appVersion }: Props): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Section title={t('settings.about')} icon={Info}>
      <p className="mb-2 text-sm leading-6 text-content-secondary">
        {t('settings.about.description')}
      </p>
      <p className="mb-5 text-xs leading-5 text-content-faint">
        {t('settings.about.forkNotice')}
      </p>

      <div className="mb-5 flex items-center gap-2 text-xs text-content-faint">
        <span>{t('settings.about.madeWith')}</span>
        <Heart size={12} fill="#be123c" stroke="#be123c" />
        <span className="rounded-full bg-surface-tertiary px-2 py-0.5 font-medium">v{appVersion}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href="https://github.com/liketrek/TREK"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-lg border border-edge bg-surface-card px-5 py-4 no-underline transition-colors hover:bg-surface-muted"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-content-secondary">
            <Code2 size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-content">{t('settings.about.upstream')}</div>
            <div className="text-xs text-content-faint">github.com/liketrek/TREK</div>
          </div>
          <ExternalLink size={14} className="ml-auto shrink-0 text-content-faint" />
        </a>
        <a
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-lg border border-edge bg-surface-card px-5 py-4 no-underline transition-colors hover:bg-surface-muted"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-content-secondary">
            <Scale size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-content">AGPL-3.0</div>
            <div className="text-xs text-content-faint">{t('settings.about.license')}</div>
          </div>
          <ExternalLink size={14} className="ml-auto shrink-0 text-content-faint" />
        </a>
      </div>
    </Section>
  )
}
