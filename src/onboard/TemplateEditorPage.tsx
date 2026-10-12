import { Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ErrorState, SkeletonList } from '../components/states'
import { can } from '../lib/permissions'
import { useAuth } from '../auth/authContext'
import { useOnboardOptions, useOnboardTemplate } from './queries'
import TemplateBuilder from './TemplateBuilder'
import type { OnboardTemplate } from './types'

const blank: OnboardTemplate = {
  name: '', isDefault: false, departments: [], locations: [], tasks: [], runningCount: 0,
}

export default function TemplateEditorPage() {
  const { t } = useTranslation('onboard')
  const { id = '' } = useParams()
  const { me } = useAuth()
  const options = useOnboardOptions()
  const template = useOnboardTemplate(id)

  // After all hooks. Other roles never see this page, and the API answers 403 too.
  if (!can(me?.role, 'onboard.templates')) return <Navigate to="/" replace />

  const failed = options.isError || (id !== '' && template.isError)
  if (failed) {
    return (
      <ErrorState
        message={t('builder.error')}
        onRetry={() => {
          void options.refetch()
          if (id) void template.refetch()
        }}
      />
    )
  }

  const optionsData = options.data
  const initial = id ? template.data : blank
  if (!optionsData || !initial) return <SkeletonList rows={4} height="h-20" />

  // The key rebuilds the form when another template is opened
  return <TemplateBuilder key={id || 'new'} initial={initial} options={optionsData} />
}