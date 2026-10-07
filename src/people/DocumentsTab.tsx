import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { formatInZone, zoneLabel } from '../lib/time'
import { localZone } from '../ats/logic'
import { formatBytes, validateUpload, type UploadError } from './profileLogic'
import {
  useDeleteDocument, useDocuments, useOpenDocumentLink, useUploadDocument,
} from './profileQueries'
import type { EmployeeDocument } from './types'

type Props = { employeeId: string; readOnly: boolean }

export default function DocumentsTab({ employeeId, readOnly }: Props) {
  const { t } = useTranslation('people')
  const { data, isPending, isError, refetch } = useDocuments(employeeId)
  const upload = useUploadDocument(employeeId)
  const remove = useDeleteDocument(employeeId)
  const openLink = useOpenDocumentLink(employeeId)

  const [pickError, setPickError] = useState<UploadError | null>(null)
  const [inputKey, setInputKey] = useState(0) // changing the key empties the file input
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [openError, setOpenError] = useState(false)
  const [readyUrl, setReadyUrl] = useState<string | null>(null)

  const zone = localZone()
  const when = (iso: string) => `${formatInZone(iso, zone, 'd MMM yyyy, HH:mm')} ${zoneLabel(zone)}`

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const problem = validateUpload(file) // checked here, before anything is sent
    if (problem) {
      setPickError(problem)
      setInputKey(k => k + 1)
      return
    }
    setPickError(null)
    upload.mutate(file, { onSettled: () => setInputKey(k => k + 1) })
  }

  async function open(doc: EmployeeDocument) {
    setOpenError(false)
    setReadyUrl(null)
    setOpeningId(doc.id)
    // Open the tab now, inside the click, so the browser does not treat it as a pop-up.
    // The address is filled in once the API has made the expiring link.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const link = await openLink.mutateAsync(doc.id)
      if (tab) tab.location.href = link.url
      else setReadyUrl(link.url)
    } catch {
      tab?.close()
      setOpenError(true)
    } finally {
      setOpeningId(null)
    }
  }

  if (isPending) return <SkeletonList rows={3} height="h-20" />
  if (isError) return <ErrorState message={t('profile.documents.error')} onRetry={() => void refetch()} />

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            {t('profile.documents.upload')}
            <input
              key={inputKey}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              onChange={onPick}
              disabled={upload.isPending}
              className="min-h-11 rounded-lg border p-2"
            />
          </label>
          <p className="text-sm opacity-70">{t('profile.documents.hint')}</p>
          {upload.isPending && <p role="status">{t('profile.documents.uploading')}</p>}
          {pickError && (
            <p role="alert" className="text-red-600">{t(`profile.documents.errors.${pickError}`)}</p>
          )}
          {upload.isError && <p role="alert" className="text-red-600">{t('profile.documents.uploadError')}</p>}
        </div>
      )}

      {openError && <p role="alert" className="text-red-600">{t('profile.documents.openError')}</p>}
      {readyUrl && (
        <p role="status" className="flex flex-col gap-1">
          <span>{t('profile.documents.popupBlocked')}</span>
          <a href={readyUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">
            {t('profile.documents.readyLink')}
          </a>
        </p>
      )}
      {remove.isError && <p role="alert" className="text-red-600">{t('profile.documents.deleteError')}</p>}

      {data.length === 0 && <EmptyState message={t('profile.documents.empty')} />}

      {data.length > 0 && (
        <>
          <p className="text-sm opacity-70">{t('profile.documents.linkNote')}</p>
          <ul className="flex flex-col gap-3">
            {data.map(doc => (
              <li key={doc.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="min-w-0">
                  <p className="font-medium wrap-break-word">{doc.name}</p>
                  <p className="text-sm opacity-70">
                    {t('profile.documents.meta', {
                      size: formatBytes(doc.size),
                      who: doc.uploadedBy,
                      when: when(doc.uploadedAt),
                    })}
                  </p>
                </div>

                {confirmId === doc.id ? (
                  <div role="alertdialog" aria-label={t('profile.documents.delete')} className="flex flex-col gap-2">
                    <p className="wrap-break-word">{t('profile.documents.confirmDelete', { name: doc.name })}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        color="danger"
                        className="min-h-11"
                        isLoading={remove.isPending}
                        onPress={() => remove.mutate(doc.id, { onSuccess: () => setConfirmId(null) })}
                      >
                        {t('profile.documents.confirm')}
                      </Button>
                      <Button variant="flat" className="min-h-11" onPress={() => setConfirmId(null)}>
                        {t('profile.documents.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      color="primary"
                      className="min-h-11"
                      isLoading={openingId === doc.id}
                      onPress={() => void open(doc)}
                    >
                      {openingId === doc.id ? t('profile.documents.opening') : t('profile.documents.open')}
                    </Button>
                    {!readOnly && (
                      <Button
                        color="danger"
                        variant="flat"
                        className="min-h-11"
                        onPress={() => { remove.reset(); setConfirmId(doc.id) }}
                      >
                        {t('profile.documents.delete')}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}