/**
 * GET /api/dropbox-list
 *
 * Lists files in a property's Dropbox folder under /Property Management_MH Group.
 *
 * Query params:
 *   - propertyId (string): property UUID from Supabase
 *   - address (string): property address (fallback for lookup)
 *   - path (string, optional): sub-path within the property folder
 *
 * Returns:
 *   { entries: [...], root: "..." }
 *
 * Environment variables:
 *   - DROPBOX_ACCESS_TOKEN (set in Vercel)
 *   - DROPBOX_ROOT (default: "/Property Management_MH Group")
 */

import { dropboxV2Api } from './_dropbox'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { propertyId, address, path: subpath } = req.query
    const property = req.query.property || address

    if (!property && !propertyId) {
      return res.status(400).json({ error: 'address or propertyId query param required' })
    }

    // Use address to find the property folder
    const propertyName = property || propertyId
    const root = process.env.DROPBOX_ROOT || '/Property Management_MH Group'
    const folderPath = `${root}/Properties/${sanitizeFolderName(propertyName)}${subpath ? '/' + sanitizeFolderName(subpath) : ''}`

    const result = await dropboxV2Api.listFolder({ path: folderPath })

    const entries = (result.entries || []).map(entry => ({
      name: entry.name,
      path: entry.path_display || entry.path_lower,
      type: entry['.tag'],
      size: entry.size || 0,
      modified: entry.server_modified || entry.client_modified || null,
    }))

    return res.status(200).json({ entries, root: folderPath })
  } catch (err) {
    // Folder might not exist yet — return empty
    if (err.message?.includes('not_found') || err.message?.includes('409')) {
      return res.status(200).json({ entries: [], root: '' })
    }
    console.error('Dropbox list error:', err)
    return res.status(500).json({ error: err.message || 'List failed' })
  }
}

function sanitizeFolderName(name) {
  return name.replace(/[<>:"/\\|?*#]/g, '_').trim()
}
