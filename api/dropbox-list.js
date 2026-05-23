/**
 * GET /api/dropbox-list
 *
 * Lists files in a property's Dropbox folder under /Property Management_MH Group.
 *
 * Query params:
 *   - property (string): property address (used for folder path lookup)
 *
 * Returns:
 *   { entries: [...], root: "..." }
 *
 * Environment variables:
 *   - DROPBOX_ACCESS_TOKEN (set in Vercel)
 *   - DROPBOX_ROOT (default: "/Property Management_MH Group")
 */

import { dropboxV2Api } from './_dropbox.js'

function sanitizeFolderName(name) {
  return name.replace(/[<>:"/\\|?*#]/g, '_').trim()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const property = req.query.property || req.query.address

    if (!property) {
      return res.status(400).json({ error: 'property query param required' })
    }

    const root = process.env.DROPBOX_ROOT || '/Property Management_MH Group'
    const folderPath = `${root}/Properties/${sanitizeFolderName(property)}`

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
