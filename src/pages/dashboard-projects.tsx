import type { EngineerProfile } from '../lib/db-engineers'
import type { Project, ProjectFile } from '../lib/db-projects'
import type { Booking } from '../types'
import type { TierConfig } from '../lib/subscriptions'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export function DashboardProjectsPage({
  projects,
  bookings,
  profile,
  tierConfig,
  activeProject,
  files,
  error
}: {
  projects: Project[]
  bookings: Booking[]
  profile: EngineerProfile
  tierConfig: TierConfig
  activeProject?: Project
  files?: ProjectFile[]
  error?: string
}) {
  const storageUsedBytes = profile.storage_used_bytes
  const limitBytes = tierConfig.storageLimitGb * 1024 * 1024 * 1024
  const storagePct = Math.min(100, (storageUsedBytes / limitBytes) * 100)

  // Bookings worth offering in the "attach to a booking" dropdown — anything not
  // cancelled/rejected, most recent first (getBookingsByEngineerProfile already sorts
  // by created_at DESC).
  const attachableBookings = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'rejected')

  if (activeProject) {
    const fileList = files || []
    const linkedBooking = activeProject.booking_id ? bookings.find((b) => b.id === activeProject.booking_id) : null

    return (
      <div class="max-w-3xl mx-auto px-5 py-12">
        <div class="mb-8">
          <a href="/dashboard/projects" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> All Projects</a>
          <h1 class="font-display text-3xl font-bold mt-4">{activeProject.name}</h1>
          {linkedBooking ? (
            <p class="text-muted mt-2">
              Linked to booking #{linkedBooking.id} — {linkedBooking.customer_name}, {linkedBooking.session_date}
            </p>
          ) : (
            <p class="text-muted mt-2">Not linked to a specific booking.</p>
          )}
          {activeProject.notes && <p class="text-muted mt-2 text-sm">{activeProject.notes}</p>}
        </div>

        {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        <div class="bg-surface border border-gold/10 rounded-2xl p-7 mb-6">
          <div class="flex items-center justify-between text-sm mb-2">
            <span class="text-muted">{formatBytes(storageUsedBytes)} used</span>
            <span class="text-muted">{tierConfig.storageLimitGb} GB included ({tierConfig.label} plan)</span>
          </div>
          <div class="w-full h-2 bg-ink rounded-full overflow-hidden mb-5">
            <div class={`h-full rounded-full ${storagePct > 90 ? 'bg-wine' : 'bg-gold'}`} style={`width: ${storagePct}%`}></div>
          </div>

          <form method="POST" action={`/dashboard/projects/${activeProject.id}/upload`} enctype="multipart/form-data" id="upload-form">
            <label
              for="file-input"
              class="block border-2 border-dashed border-gold/30 hover:border-gold/60 rounded-xl px-6 py-10 text-center cursor-pointer transition"
            >
              <i class="fa-solid fa-cloud-arrow-up text-2xl text-gold mb-3"></i>
              <p class="text-cream font-semibold">Drag files here or click to upload</p>
              <p class="text-muted text-xs mt-1">Stems, mixes, masters, session files — up to 2GB per file</p>
            </label>
            <input type="file" id="file-input" name="files" multiple class="hidden" />
            <div id="selected-files" class="text-sm text-muted mt-3 hidden"></div>
            <button type="submit" id="upload-submit" class="hidden mt-4 bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-3 rounded-full transition">
              <i class="fa-solid fa-upload mr-1"></i> Upload Files
            </button>
          </form>
        </div>

        {fileList.length === 0 ? (
          <div class="text-center py-16 text-muted bg-surface border border-gold/10 rounded-2xl">
            <i class="fa-solid fa-folder-open text-3xl mb-4"></i>
            <p>No files uploaded to this Project yet.</p>
          </div>
        ) : (
          <div class="space-y-2">
            {fileList.map((f) => (
              <div class="bg-surface border border-gold/10 rounded-xl p-4 flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="font-medium text-cream truncate">
                    {f.relative_path ? `${f.relative_path}` : f.file_name}
                  </div>
                  <div class="text-xs text-muted mt-0.5">{formatBytes(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString()}</div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <a href={`/dashboard/projects/${activeProject.id}/files/${f.id}`} class="text-sm text-gold hover:underline">
                    <i class="fa-solid fa-download mr-1"></i>Download
                  </a>
                  <form method="POST" action={`/dashboard/projects/${activeProject.id}/files/${f.id}/delete`}>
                    <button type="submit" class="text-sm text-wine-light hover:text-red-400 transition">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <div class="mt-8 border-t border-gold/10 pt-6">
          <form method="POST" action={`/dashboard/projects/${activeProject.id}/delete`} onsubmit="return confirm('Delete this Project and all its files? This cannot be undone.')">
            <button type="submit" class="text-sm text-wine-light hover:text-red-400 transition">
              <i class="fa-solid fa-trash mr-1"></i> Delete this Project
            </button>
          </form>
        </div>

        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var input = document.getElementById('file-input');
              var selected = document.getElementById('selected-files');
              var submit = document.getElementById('upload-submit');
              input.addEventListener('change', function() {
                if (input.files.length > 0) {
                  var names = Array.from(input.files).map(function(f) { return f.name }).join(', ');
                  selected.textContent = input.files.length + ' file(s) selected: ' + names;
                  selected.classList.remove('hidden');
                  submit.classList.remove('hidden');
                } else {
                  selected.classList.add('hidden');
                  submit.classList.add('hidden');
                }
              });
            })();
          `
        }}></script>
      </div>
    )
  }

  return (
    <div class="max-w-3xl mx-auto px-5 py-12">
      <div class="mb-8">
        <a href="/dashboard" class="text-sm text-muted hover:text-gold transition"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Dashboard</a>
        <h1 class="font-display text-3xl font-bold mt-4">Your Projects</h1>
        <p class="text-muted mt-2">Deliver stems, mixes, and masters to your clients — files upload straight to secure storage and your artist can grab them from their booking status page.</p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <div class="bg-surface border border-gold/10 rounded-2xl p-6 mb-8">
        <div class="flex items-center justify-between text-sm mb-2">
          <span class="text-muted">{formatBytes(storageUsedBytes)} used</span>
          <span class="text-muted">{tierConfig.storageLimitGb} GB included ({tierConfig.label} plan)</span>
        </div>
        <div class="w-full h-2 bg-ink rounded-full overflow-hidden">
          <div class={`h-full rounded-full ${storagePct > 90 ? 'bg-wine' : 'bg-gold'}`} style={`width: ${storagePct}%`}></div>
        </div>
        {storagePct > 90 && (
          <p class="text-xs text-wine-light mt-3">
            You're near your storage limit. <a href="/pricing" class="underline">Upgrade your plan</a> for more room.
          </p>
        )}
      </div>

      <form method="POST" action="/dashboard/projects" class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-4 mb-8">
        <h2 class="font-display text-lg font-bold">New Project</h2>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Project Name</label>
          <input type="text" name="name" required placeholder="e.g. 'Midnight Drive — Final Mix'" class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Link to a Booking (optional)</label>
          <select name="booking_id" class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold">
            <option value="">— Not linked to a specific booking —</option>
            {attachableBookings.map((b) => (
              <option value={b.id}>#{b.id} — {b.customer_name} — {b.session_date}</option>
            ))}
          </select>
          <p class="text-xs text-muted mt-1.5">Linking lets that client see these files under their booking on the status page.</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Notes (optional)</label>
          <textarea name="notes" rows={2} placeholder="Any notes for yourself or the client" class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold"></textarea>
        </div>
        <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-6 py-3 rounded-full transition">
          <i class="fa-solid fa-plus mr-1"></i> Create Project
        </button>
      </form>

      {projects.length === 0 ? (
        <div class="text-center py-16 text-muted bg-surface border border-gold/10 rounded-2xl">
          <i class="fa-solid fa-folder-open text-3xl mb-4"></i>
          <p>No Projects yet. Create your first one above.</p>
        </div>
      ) : (
        <div class="space-y-3">
          {projects.map((p) => {
            const linkedBooking = p.booking_id ? bookings.find((b) => b.id === p.booking_id) : null
            return (
              <a href={`/dashboard/projects/${p.id}`} class="block bg-surface border border-gold/10 hover:border-gold/30 rounded-xl p-5 transition">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="font-semibold text-cream">{p.name}</div>
                    <div class="text-xs text-muted mt-1">
                      {linkedBooking ? `${linkedBooking.customer_name} · ${linkedBooking.session_date}` : 'Not linked to a booking'}
                      {' · '}Updated {new Date(p.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <i class="fa-solid fa-chevron-right text-muted"></i>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
