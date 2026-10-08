import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { useOrg } from './orgQueries'
import { buildOrg, idsWithChildren, type OrgNode } from './orgLogic'

type NodeProps = {
  node: OrgNode
  isOpen: (id: string) => boolean
  toggle: (id: string) => void
}

function OrgNodeView({ node, isOpen, toggle }: NodeProps) {
  const { t } = useTranslation('people')
  const { person } = node
  const hasTeam = node.children.length > 0
  const open = isOpen(person.id)

  return (
    <li>
      <div className="flex min-h-11 items-start gap-2">
        {hasTeam ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={t(open ? 'org.collapse' : 'org.expand', { name: person.name })}
            onClick={() => toggle(person.id)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
          >
            {open ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          </button>
        ) : (
          <span aria-hidden="true" className="w-11 shrink-0" />
        )}

        <div className="min-w-0 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/people/${person.id}`} className="font-semibold wrap-break-word underline">
              {person.name}
            </Link>
            {person.status === 'exited' && (
              <span className="rounded border border-red-400 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                {t('org.exited')}
              </span>
            )}
          </div>
          <p className="text-sm wrap-break-word">{person.designation}</p>
          <p className="text-sm opacity-70">
            {t('org.code', { code: person.code })}
            {node.total > 0 && ` · ${t('org.manages', { count: node.total })}`}
          </p>
        </div>
      </div>

      {hasTeam && open && (
        <ul className="ml-5 flex flex-col border-l pl-2">
          {node.children.map(c => (
            <OrgNodeView key={c.person.id} node={c} isOpen={isOpen} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function OrgPage() {
  const { t } = useTranslation('people')
  const { data, isPending, isError, refetch } = useOrg()
  const tree = useMemo(() => buildOrg(data ?? []), [data])

  // null means "the default": top-level people are open, everyone else is closed
  const [expanded, setExpanded] = useState<Set<string> | null>(null)
  const rootIds = new Set(tree.map(n => n.person.id))
  const isOpen = (id: string) => (expanded ? expanded.has(id) : rootIds.has(id))

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev ?? rootIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('org.title')}</h1>
      <p className="text-sm opacity-80">{t('org.intro')}</p>

      {isPending && <SkeletonList rows={6} height="h-14" />}
      {isError && <ErrorState message={t('org.error')} onRetry={() => void refetch()} />}
      {data && data.length === 0 && <EmptyState message={t('org.empty')} />}

      {data && data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="text-sm opacity-80">{t('org.count', { n: data.length })}</p>
            <Button variant="bordered" className="min-h-11" onPress={() => setExpanded(new Set(idsWithChildren(tree)))}>
              {t('org.expandAll')}
            </Button>
            <Button variant="bordered" className="min-h-11" onPress={() => setExpanded(new Set())}>
              {t('org.collapseAll')}
            </Button>
          </div>

          <ul className="flex flex-col">
            {tree.map(n => (
              <OrgNodeView key={n.person.id} node={n} isOpen={isOpen} toggle={toggle} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}