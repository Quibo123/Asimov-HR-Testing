import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  useReactTable, type ColumnFiltersState, type OnChangeFn, type SortingState,
} from '@tanstack/react-table'
import { formatInZone } from '../lib/time'
import { EmptyState, ErrorState, ShareCareersLink, SkeletonList } from '../components/states'
import { useCandidates } from './queries'
import { useAuth } from '../auth/authContext'
import { formatPoints, localZone, maskStatus, parseSort, parseStatus, serializeSort, visibleStatuses } from './logic'
import type { CandidateSummary } from './types'
import CandidatePanel from './CandidatePanel'

const columnHelper = createColumnHelper<CandidateSummary>()

export default function CandidatesPage() {
  const { t } = useTranslation('ats')
  const [params, setParams] = useSearchParams()
  const { data, isPending, isError, refetch } = useCandidates()

  const { me } = useAuth()
  const role = me?.role

  const status = parseStatus(params.get('status'))
  const job = params.get('job') ?? ''
  const sorting = parseSort(params.get('sort'))
  const openId = params.get('c')

  // Filters, sort and the open candidate all live in the URL
  const setParam = (key: string, value: string, push = false) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: !push },
    )

  const clearFilters = () =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('status')
        next.delete('job')
        return next
      },
      { replace: true },
    )

  const rows = useMemo(
    () => (data ?? []).map(r => ({ ...r, status: maskStatus(r.status, role) })),
    [data, role],
  )
  const jobs = useMemo(() => {
    const seen = new Map<string, string>()
    rows.forEach(r => seen.set(r.jobId, r.jobTitle))
    return Array.from(seen)
  }, [rows])

  const zone = localZone()
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: t('columns.name'), enableSorting: false }),
      columnHelper.accessor('jobId', {
        header: t('columns.job'),
        enableSorting: false,
        filterFn: 'equalsString',
        cell: info => info.row.original.jobTitle,
      }),
      columnHelper.accessor('score', {
        header: t('columns.score'),
        sortingFn: 'basic',
        cell: info => formatPoints(info.getValue()),
      }),
      columnHelper.accessor('mustHaveFailed', {
        header: t('columns.mustHave'),
        enableSorting: false,
        cell: info =>
          info.getValue() ? (
            <span className="rounded border border-amber-500 bg-amber-100 px-2 py-0.5 text-sm text-amber-900">
              {t('table.flag')}
            </span>
          ) : (
            t('table.none')
          ),
      }),
      columnHelper.accessor('status', {
        header: t('columns.status'),
        enableSorting: false,
        filterFn: 'equalsString',
        cell: info => t(`status.${info.getValue()}`),
      }),
      columnHelper.accessor('appliedAt', {
        header: t('columns.applied'),
        cell: info => formatInZone(info.getValue(), zone, 'd MMM yyyy'),
      }),
    ],
    [t, zone],
  )

  const columnFilters: ColumnFiltersState = [
    ...(status ? [{ id: 'status', value: status }] : []),
    ...(job ? [{ id: 'jobId', value: job }] : []),
  ]

  const onSortingChange: OnChangeFn<SortingState> = updater => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    setParam('sort', serializeSort(next))
  }

  // TanStack Table v8 is not React Compiler compatible; this component opts out of memoization.
  // oxlint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibleRows = table.getRowModel().rows

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('filters.status')}
          <select
            className="h-11 rounded-lg border bg-transparent px-2"
            value={status}
            onChange={e => setParam('status', e.target.value)}
          >
            <option value="">{t('filters.all')}</option>
            {visibleStatuses(role).map(s => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('filters.job')}
          <select
            className="h-11 rounded-lg border bg-transparent px-2"
            value={job}
            onChange={e => setParam('job', e.target.value)}
          >
            <option value="">{t('filters.all')}</option>
            {jobs.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        </label>

        {(status || job) && (
          <Button variant="flat" className="min-h-11" onPress={clearFilters}>{t('filters.clear')}</Button>
        )}
      </div>

      {isPending && <SkeletonList rows={5} height="h-12" />}

      {isError && <ErrorState message={t('error')} onRetry={() => void refetch()} />}

      {!isPending && !isError && rows.length === 0 && (
        <EmptyState message={t('empty')}>
          <ShareCareersLink />
        </EmptyState>
      )}

      {rows.length > 0 && visibleRows.length === 0 && (
        <EmptyState message={t('noMatch')}>
          <Button variant="flat" className="min-h-11" onPress={clearFilters}>{t('filters.clear')}</Button>
        </EmptyState>
      )}

      {visibleRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              {table.getHeaderGroups().map(group => (
                <tr key={group.id}>
                  {group.headers.map(header => {
                    const sorted = header.column.getIsSorted()
                    const ariaSort = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                    return (
                      <th key={header.id} className="p-2" aria-sort={ariaSort}>
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center gap-1 font-semibold"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === 'asc' && <ArrowUp size={14} aria-hidden="true" />}
                            {sorted === 'desc' && <ArrowDown size={14} aria-hidden="true" />}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {visibleRows.map(row => (
                <tr key={row.id} className={`border-t ${row.original.id === openId ? 'bg-black/5' : ''}`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-2">
                      {cell.column.id === 'name' ? (
                        <button
                          type="button"
                          className="min-h-11 text-left underline"
                          onClick={() => setParam('c', row.original.id, true)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </button>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <CandidatePanel key={openId} id={openId} onClose={() => setParam('c', '')} />}
    </div>
  )
}