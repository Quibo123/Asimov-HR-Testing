import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function ApplySuccess() {
  const { t } = useTranslation('careers')
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">{t('success.title')}</h1>
      <h2 className="text-lg font-semibold">{t('success.next')}</h2>
      <ol className="list-decimal pl-5 flex flex-col gap-1">
        <li>{t('success.step1')}</li>
        <li>{t('success.step2')}</li>
        <li>{t('success.step3')}</li>
      </ol>
      <Link to="/careers" className="underline">{t('success.back')}</Link>
    </div>
  )
}