import { copy } from '../i18n'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'

const c = copy.templates

export default function TemplatesPage() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4 py-24">
      <div>
        <EmptyState icon="📚" message={c.empty} />
        <div className="mt-4">
          <Badge variant="neutral">{c.comingSoon}</Badge>
        </div>
        <h2 className="text-base font-semibold text-ink mt-3">{c.title}</h2>
      </div>
    </div>
  )
}
