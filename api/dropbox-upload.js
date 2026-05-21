import { dropboxV2Api } from './_dropbox'

/**
 * POST /api/dropbox-upload
 *
 * Uploads a file to the MH Group Dropbox folder structure.
 *
 * Expected form fields:
 *   - property (string): property address/unit identifier
 *   - category (string): folder name (e.g., "Lease Documents", "Photos")
 *   - file (binary): the file to upload
 *
 * Returns:
 *   { url: "https://..." } — shared link to the uploaded file
 *
 * Environment variables (set in Vercel):
 *   - DROPBOX_ACCESS_TOKEN: Dropbox API token (long-lived)
 *   - DROPBOX_ROOT: root folder path (default: "/MH Group")
 */

export const config = {
  api: {
    bodyParser: false, // We handle multipart ourselves
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse multipart form
    const { Fields, Files } = await parseMultipart(req)

    const propertyId = Fields?.property?.[0] || 'Shared'
    const category = Fields?.category?.[0] || 'Documents'
    const file = Files?.file?.[0]

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const root = process.env.DROPBOX_ROOT || '/MH Group'
    const folderPath = `${root}/${sanitizeFolderName(propertyId)}/${sanitizeFolderName(category)}`
    const filename = sanitizeFilename(file.name || 'document.pdf')
    const dropboxPath = `${folderPath}/${filename}`

    // Upload to Dropbox
    const result = await dropboxV2Api.upload({
      path: dropboxPath,
      contents: file.content,
      mode: 'add',
      autorename: true,
    })

    // Create a shared link
    let sharedLink = null
    try {
      const linkResult = await dropboxV2Api.sharingCreateSharedLinkWithSettings({
        path: dropboxPath,
        settings: { requested_visibility: { '.tag': 'shared' } },
      })
      sharedLink = linkResult.url
    } catch {
      // Link might already exist — get existing
      try {
        const existing = await dropboxV2Api.sharingListSharedLinks({
          path: dropboxPath,
          direct_only: true,
        })
        sharedLink = existing.links?.[0]?.url || null
      } catch {}
    }

    return res.status(200).json({
      success: true,
      path: dropboxPath,
      url: sharedLink,
      name: filename,
    })
  } catch (err) {
    console.error('Dropbox upload error:', err)
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
}

/**
 * Parse a multipart form from the raw request body.
 * Uses a lightweight approach without external dependencies.
 */
async function parseMultipart(req) {
  const contentType = req.headers['content-type'] || ''
  const boundary = contentType.split('boundary=')[1]
  if (!boundary) throw new Error('No boundary in content-type')

  const boundaryBuffer = Buffer.from(`--${boundary}`)
  const endBoundary = Buffer.from(`--${boundary}--`)

  // Collect raw body
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)

  const Fields = {}
  const Files = {}

  // Split by boundary
  let pos = 0
  while (pos < body.length) {
    const start = body.indexOf(boundaryBuffer, pos)
    if (start === -1) break
    const sectionStart = start + boundaryBuffer.length

    // Check if this is the end
    if (body.slice(sectionStart, sectionStart + 2).toString() === '--') break

    // Find next boundary
    const nextStart = body.indexOf(boundaryBuffer, sectionStart)
    const section = body.slice(sectionStart, nextStart !== -1 ? nextStart : body.length)

    // Parse headers
    const headerEnd = section.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue
    const headerBlock = section.slice(0, headerEnd).toString()
    const contentStart = headerEnd + 4
    const content = section.slice(contentStart, section.length - 2) // trim trailing \r\n

    // Extract name and filename from Content-Disposition
    const nameMatch = headerBlock.match(/name="([^"]+)"/)
    const filenameMatch = headerBlock.match(/filename="([^"]+)"/)
    const name = nameMatch ? nameMatch[1] : ''

    if (filenameMatch) {
      // It's a file
      if (!Files[name]) Files[name] = []
      Files[name].push({
        name: filenameMatch[1],
        content,
        contentType: headerBlock.match(/Content-Type:\s*(\S+)/)?.[1] || 'application/octet-stream',
      })
    } else {
      // It's a field
      if (!Fields[name]) Fields[name] = []
      Fields[name].push(content.toString().trim())
    }

    if (nextStart === -1) break
    pos = nextStart
  }

  return { Fields, Files }
}

function sanitizeFolderName(name) {
  return name.replace(/[<>:"/\\|?*#]/g, '_').trim()
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim()
}
