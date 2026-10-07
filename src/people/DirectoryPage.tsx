import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@heroui/react'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { useDebounced } from '../lib/useDebounced'
import { useDirectory } from './queries'
import {
  EMPLOYEE_STATUSES, hasFilters, pageWindow, parseEmployeeStatus, parsePage, rangeOf, totalPages,
} from './logic'

const selectClass = 'h-11 rounded-lg border bg-transparent px-2'

export default function DirectoryPage() {
  const { t } = useTranslation('people')
  const [params, setParams] = useSearchParams()

  // Search, filters and page all live in the URL
  const q = params.get('q') ?? ''
  const loc = params.get('location') ?? ''
  const department = params.get('department') ?? ''
  const status = parseEmployeeStatus(params.get('status'))
  const page = parsePage(params.get('page'))

  // The box keeps its own text so typing never jumps. It follows the URL when the URL changes
  // from outside (Back button, Clear filters).
  const [text, setText] = useState(q)
  const [lastQ, setLastQ] = useState(q)
  if (q !== lastQ) {
    setLastQ(q)
    setText(q)
  }

  // Only the server request waits. The URL updates on every keystroke.
  const searchTerm = useDebounced(q.trim(), 300)

  const { data, isPending, isError, isFetching, refetch } = useDirectory({
    q: searchTerm,
    location: loc,
    department,
    status,
    page,
  })

  function update(changes: Record<string, string>, push = false) {
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page') // a new search or filter starts at page 1
        return next
      },
      { replace: !push },
    )
  }

  function onSearch(value: string) {
    setText(value)
    update({ q: value })
  }

  function goToPage(n: number) {
    update({ page: n === 1 ? '' : String(n) }, true)
    window.scrollTo({ top: 0 })
  }

  function clearAll() {
    setParams({}, { replace: true })
  }

  const filtersOn = hasFilters({ q, location: loc, department, status })
  const pages = data ? totalPages(data.total, data.pageSize) : 0
  const outOfRange = data !== undefined && data.total > 0 && page > pages
  const { from, to } = data ? rangeOf(data.page, data.pageSize, data.total) : { from: 0, to: 0 }
  const refreshing = isFetching && !isPending

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('directory.title')}</h1>

      <form role="search" onSubmit={e => e.preventDefault()} className="flex flex-col gap-3">
        <Input
          type="search"
          inputMode="search"
          autoComplete="off"
          label={t('directory.search')}
          value={text}
          onValueChange={onSearch}
          isClearable
          onClear={() => onSearch('')}
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t('directory.filters.location')}
            <select className={selectClass} value={loc} onChange={e => update({ location: e.target.value })}>
              <option value="">{t('directory.filters.all')}</option>
              {data?.facets.locations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            {t('directory.filters.department')}
            <select className={selectClass} value={department} onChange={e => update({ department: e.target.value })}>
              <option value="">{t('directory.filters.all')}</option>
              {data?.facets.departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            {t('directory.filters.status')}
            <select className={selectClass} value={status} onChange={e => update({ status: e.target.value })}>
              <option value="">{t('directory.filters.all')}</option>
              {EMPLOYEE_STATUSES.map(s => (
                <option key={s} value={s}>{t(`directory.status.${s}`)}</option>
              ))}
            </select>
          </label>

          {filtersOn && (
            <Button variant="flat" className="min-h-11" onPress={clearAll}>{t('directory.clear')}</Button>
          )}
        </div>
      </form>

      {isPending && <SkeletonList rows={6} height="h-20" />}

      {isError && <ErrorState message={t('directory.error')} onRetry={() => void refetch()} />}

      {data && data.total === 0 && (
        <EmptyState message={filtersOn ? t('directory.noMatch') : t('directory.empty')}>
          {filtersOn && (
            <Button variant="flat" className="min-h-11" onPress={clearAll}>{t('directory.clear')}</Button>
          )}
        </EmptyState>
      )}

      {outOfRange && (
        <EmptyState message={t('directory.outOfRange')}>
          <Button variant="flat" className="min-h-11" onPress={() => goToPage(1)}>
            {t('directory.firstPage')}
          </Button>
        </EmptyState>
      )}

      {data && data.total > 0 && !outOfRange && (
        <>
          <p role="status" className="text-sm opacity-80">
            {t('directory.count', { from, to, total: data.total })}
          </p>

          <ul aria-busy={refreshing} className={`flex flex-col gap-3 ${refreshing ? 'opacity-60' : ''}`}>
            {data.items.map(e => (
              <li key={e.id} className="flex flex-col gap-1 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 wrap-break-word font-semibold">{e.name}</h2>
                  <span className="rounded border px-2 py-0.5 text-xs">{t(`directory.status.${e.status}`)}</span>
                </div>
                <p className="wrap-break-word">{e.designation}</p>
                <p className="text-sm opacity-80">{`${e.location} · ${e.department}`}</p>
                <p className="text-sm opacity-70">{t('directory.code', { code: e.code })}</p>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label={t('directory.pagination.label')} className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="bordered"
                  className="min-h-11"
                  isDisabled={page <= 1}
                  onPress={() => goToPage(page - 1)}
                >
                  {t('directory.pagination.previous')}
                </Button>

                {pageWindow(page, pages).map(n => (
                  <Button
                    key={n}
                    isIconOnly
                    className="min-h-11 min-w-11"
                    color={n === page ? 'primary' : 'default'}
                    variant={n === page ? 'solid' : 'bordered'}
                    aria-label={t('directory.pagination.page', { n })}
                    aria-current={n === page ? 'page' : undefined}
                    onPress={() => goToPage(n)}
                  >
                    {n}
                  </Button>
                ))}

                <Button
                  variant="bordered"
                  className="min-h-11"
                  isDisabled={page >= pages}
                  onPress={() => goToPage(page + 1)}
                >
                  {t('directory.pagination.next')}
                </Button>
              </div>
              <p className="text-sm opacity-70">{t('directory.pagination.of', { page, pages })}</p>
            </nav>
          )}
        </>
      )}
    </div>
  )
}