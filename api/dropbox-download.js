/**
 * GET /api/dropbox-download
 *
 * Gets a temporary download link or returns file contents for preview.
 *
 * Query params:
 *   - path (string): full Dropbox path to the file
 *   - preview (string): "true" to return a temporary link (default), "raw" to proxy content
 *
 * Returns:
 *   { url: "..." } or raw file content (for images/PDFs)
 */

import { dropboxV2Api } from './_dropbox'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { path, preview } = req.query

    if (!path) {
      return res.status(400).json({ error: 'path query param required' })
    }

    // Return a temporary link
    const link = await dropboxV2Api.getTemporaryLink({ path })
    return res.status(200).json({ url: link.link, name: path.split('/').pop() })
  } catch (err) {
    console.error('Dropbox download error:', err)
    return res.status(500).json({ error: err.message || 'Download failed' })
  }
}
