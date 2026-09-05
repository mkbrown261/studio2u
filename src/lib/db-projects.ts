// Studio2U Projects — file storage + sharing between an engineer and their client
// (migrations/0012). Files live in R2 (bucket bound as `R2`); this module only touches
// the D1 metadata rows (project + project_files) and the running storage_used_bytes
// total on engineer_profiles (see db-engineers.ts addToEngineerStorageUsed).

export interface Project {
  id: number
  engineer_profile_id: number
  booking_id: number | null
  customer_id: number | null
  name: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectFile {
  id: number
  project_id: number
  r2_key: string
  file_name: string
  relative_path: string | null
  content_type: string | null
  size_bytes: number
  uploaded_by_user_id: number | null
  created_at: string
}

export async function getProjectsForEngineer(db: D1Database, engineerProfileId: number): Promise<Project[]> {
  const { results } = await db
    .prepare('SELECT * FROM projects WHERE engineer_profile_id = ? ORDER BY updated_at DESC')
    .bind(engineerProfileId)
    .all()
  return (results as unknown as Project[]) || []
}

export async function getProjectById(db: D1Database, id: number): Promise<Project | null> {
  const row = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
  return (row as unknown as Project) || null
}

// Projects visible to an artist/customer: anything explicitly linked to their
// customer_id, OR anything linked to one of their bookings (covers the case where an
// engineer created the Project from a booking before the customer had an account, or
// simply forgot to set customer_id — booking_id is the more reliable link since it's
// always set at booking time).
export async function getProjectsForCustomer(db: D1Database, customerUserId: number): Promise<Project[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT p.* FROM projects p
       LEFT JOIN bookings b ON b.id = p.booking_id
       WHERE p.customer_id IN (SELECT id FROM customers WHERE email IN (
             SELECT email FROM users WHERE id = ?
           ))
          OR b.customer_user_id = ?
       ORDER BY p.updated_at DESC`
    )
    .bind(customerUserId, customerUserId)
    .all()
  return (results as unknown as Project[]) || []
}

export async function createProject(
  db: D1Database,
  params: { engineerProfileId: number; bookingId: number | null; customerId: number | null; name: string; notes: string }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO projects (engineer_profile_id, booking_id, customer_id, name, notes) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(params.engineerProfileId, params.bookingId, params.customerId, params.name, params.notes || null)
    .run()
  return result.meta.last_row_id as number
}

export async function deleteProject(db: D1Database, id: number, engineerProfileId: number) {
  await db.prepare('DELETE FROM project_files WHERE project_id = ?').bind(id).run()
  await db.prepare('DELETE FROM projects WHERE id = ? AND engineer_profile_id = ?').bind(id, engineerProfileId).run()
}

export async function getProjectFiles(db: D1Database, projectId: number): Promise<ProjectFile[]> {
  const { results } = await db
    .prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY relative_path ASC, file_name ASC')
    .bind(projectId)
    .all()
  return (results as unknown as ProjectFile[]) || []
}

export async function addProjectFile(
  db: D1Database,
  params: {
    projectId: number
    r2Key: string
    fileName: string
    relativePath: string | null
    contentType: string | null
    sizeBytes: number
    uploadedByUserId: number | null
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO project_files (project_id, r2_key, file_name, relative_path, content_type, size_bytes, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.projectId,
      params.r2Key,
      params.fileName,
      params.relativePath,
      params.contentType,
      params.sizeBytes,
      params.uploadedByUserId
    )
    .run()
  await db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(params.projectId).run()
  return result.meta.last_row_id as number
}

export async function getProjectFileById(db: D1Database, id: number): Promise<ProjectFile | null> {
  const row = await db.prepare('SELECT * FROM project_files WHERE id = ?').bind(id).first()
  return (row as unknown as ProjectFile) || null
}

export async function deleteProjectFile(db: D1Database, id: number): Promise<ProjectFile | null> {
  const file = await getProjectFileById(db, id)
  if (!file) return null
  await db.prepare('DELETE FROM project_files WHERE id = ?').bind(id).run()
  return file
}

export async function getTotalStorageBytesForEngineer(db: D1Database, engineerProfileId: number): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(pf.size_bytes), 0) as total FROM project_files pf
       JOIN projects p ON p.id = pf.project_id
       WHERE p.engineer_profile_id = ?`
    )
    .bind(engineerProfileId)
    .first<{ total: number }>()
  return row?.total || 0
}
