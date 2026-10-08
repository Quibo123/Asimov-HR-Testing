import { useState, type ChangeEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { ApiError } from '../lib/api'
import { can } from '../lib/permissions'
import { downloadCsv } from '../lib/downloadCsv'
import { useAuth } from '../auth/authContext'
import {
  IMPORT_COLUMNS, buildErrorCsv, buildTemplateCsv, parseImportError, validateImportFile, type FilePickError,
} from './importLogic'
import { useCommitImport, usePreviewImport } from './importQueries'

const SHOW_LIMIT = 100

export default function ImportPage() {
  const { t } = useTranslation('people')
  const { me } = useAuth()
  const preview = usePreviewImport()
  const commit = useCommitImport()
  const [file, setFile] = useState<File | null>(null)
  const [pickError, setPickError] = useState<FilePickError | null>(null)
  const [inputKey, setInputKey] = useState(0) // changing the key empties the file input

  // The Import tab does not exist for other roles, and neither does this page
  if (!can(me?.role, 'people.import')) return <Navigate to="/people/org" replace />

  const reason = (code: string) => t(`import.reasons.${code}`, { defaultValue: code })
  const data = preview.data
  const result = commit.data

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    setInputKey(k => k + 1) // so the same file can be chosen again after fixing it
    commit.reset()
    const problem = validateImportFile(picked) // checked here, before anything is sent
    if (problem) {
      setPickError(problem)
      setFile(null)
      preview.reset()
      return
    }
    setPickError(null)
    setFile(picked)
    preview.mutate(picked)
  }

  const previewError =
    preview.error instanceof ApiError ? parseImportError(preview.error.message) : { kind: 'generic' as const }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('import.title')}</h1>
      <p>{t('import.intro')}</p>
      <p className="text-sm opacity-80 wrap-break-word">
        {t('import.columns', { list: IMPORT_COLUMNS.join(', ') })}
      </p>

      <div className="flex flex-col gap-2">
        <Button
          variant="bordered"
          className="min-h-11 self-start"
          onPress={() => downloadCsv('employee-import-template.csv', buildTemplateCsv())}
        >
          {t('import.template')}
        </Button>

        <label className="flex flex-col gap-1 text-sm">
          {data ? t('import.chooseAgain') : t('import.choose')}
          <input
            key={inputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={onPick}
            disabled={preview.isPending || commit.isPending}
            className="min-h-11 rounded-lg border p-2"
          />
        </label>
        <p className="text-sm opacity-70">{t('import.hint')}</p>
        {file && <p className="text-sm wrap-break-word">{t('import.fileName', { name: file.name })}</p>}
        {pickError && <p role="alert" className="text-red-600">{t(`import.fileErrors.${pickError}`)}</p>}
      </div>

      {preview.isPending && <p role="status">{t('import.checking')}</p>}

      {preview.isError && (
        <p role="alert" className="text-red-600 wrap-break-word">
          {previewError.kind === 'columns'
            ? t('import.missingColumns', { list: previewError.columns.join(', ') })
            : t('import.previewError')}
        </p>
      )}

      {result && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border-2 border-(--brand) p-4">
          <p className="text-lg font-semibold">{t('import.successTitle', { count: result.imported })}</p>
          {result.skipped > 0 && <p>{t('import.skipped', { n: result.skipped })}</p>}
          <Link to="/people/directory" className="inline-flex min-h-11 items-center underline">
            {t('import.goDirectory')}
          </Link>
        </div>
      )}

      {data && (
        <section aria-label={t('import.summary', { ready: data.ready, bad: data.invalid })} className="flex flex-col gap-4">
          <p role="status" className="text-lg font-semibold">
            {t('import.summary', { ready: data.ready, bad: data.invalid })}
          </p>

          {data.invalid === 0 && <p>{t('import.allGood')}</p>}
          {data.ready === 0 && <p>{t('import.noneReady')}</p>}

          {data.ready > 0 && !result && (
            <div className="flex flex-col gap-2">
              <Button
                color="primary"
                className="min-h-11 self-start"
                isLoading={commit.isPending}
                onPress={() => file && commit.mutate(file)}
              >
                {commit.isPending ? t('import.importing') : t('import.importReady', { n: data.ready })}
              </Button>
              {commit.isError && <p role="alert" className="text-red-600">{t('import.importError')}</p>}
            </div>
          )}

          {data.invalid > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{t('import.badTitle')}</h2>

              <Button
                variant="bordered"
                className="min-h-11 self-start"
                onPress={() => downloadCsv('import-errors.csv', buildErrorCsv(data.badRows, reason))}
              >
                {t('import.downloadErrors')}
              </Button>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="p-2">{t('import.cols.row')}</th>
                      <th className="p-2">{t('import.cols.code')}</th>
                      <th className="p-2">{t('import.cols.name')}</th>
                      <th className="p-2">{t('import.cols.problems')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.badRows.slice(0, SHOW_LIMIT).map(r => (
                      <tr key={r.row} className="border-t align-top">
                        <td className="p-2">{r.row}</td>
                        <td className="p-2 wrap-break-word">{r.values.code}</td>
                        <td className="p-2 wrap-break-word">{r.values.name}</td>
                        <td className="p-2">
                          <ul className="list-disc pl-4">
                            {r.errors.map(code => (
                              <li key={code}>{reason(code)}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.badRows.length > SHOW_LIMIT && (
                <p className="text-sm opacity-80">
                  {t('import.showing', { shown: SHOW_LIMIT, total: data.badRows.length })}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}