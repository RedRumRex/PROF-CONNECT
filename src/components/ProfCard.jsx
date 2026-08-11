import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  available: 'bg-green-500',
  busy:      'bg-amber-500',
  away:      'bg-rose-600',
}

export default function ProfCard({ id, name, department, hIndex, status, tags, bio, avatar, saved }) {
  const navigate = useNavigate()

  return (
    <article className="glass-card p-6 rounded-2xl flex flex-col group">
      <div className="flex justify-between items-start mb-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <img
              src={avatar}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <span
            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface-container-highest ${STATUS_COLORS[status] ?? 'bg-stone-500'}`}
            title={status}
          />
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold block">
            H-Index
          </span>
          <span className="text-2xl font-black text-primary leading-none">{hIndex}</span>
        </div>
      </div>

      <h3 className="font-headline text-lg font-bold text-on-surface mb-0.5">{name}</h3>
      <p className="text-on-surface-variant text-sm mb-4">{department}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-surface-container-lowest/60 text-[11px] px-2.5 py-1 rounded text-stone-300 border border-outline-variant/10"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-xs text-stone-500 leading-relaxed line-clamp-2 mb-6 flex-grow">{bio}</p>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/profile/${id}`)}
          className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">person</span>
          Full Profile
        </button>
        <button
          className="px-3 rounded-xl border border-outline-variant/20 hover:bg-surface-container-high
                     transition-colors text-on-surface-variant active:scale-90"
          aria-label="Save"
        >
          <span
            className="material-symbols-outlined scale-90"
            style={saved ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            bookmark
          </span>
        </button>
      </div>
    </article>
  )
}