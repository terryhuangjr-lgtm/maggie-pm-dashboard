/**
 * POST /api/dropbox-upload
 *
 * Uploads a file to the property's folder under /Property Management_MH Group.
 *
 * Expected form fields:
 *   - address (string): property address (used for folder path)
 *   - category (string): subfolder name (e.g., "Lease Documents", "Photos", "Financials")
 *   - file (binary): the file to upload
 *
 * Returns:
 *   { success: true, path: "..." , name: "...", url: "..." }
 *
 * Environment variables (set in Vercel):
 *   - DROPBOX_ACCESS_TOKEN
 *   - DROPBOX_ROOT (default: "/Property Management_MH Group")
 */

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { Fields, Files } = await parseMultipart(req)

    const address = Fields?.address?.[0] || Fields?.property?.[0] || Fields?.propertyId?.[0] || 'Shared'
    const category = Fields?.category?.[0] || 'Documents'
    const file = Files?.file?.[0]

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const root = process.env.DROPBOX_ROOT || '/Property Management_MH Group'
    const folderPath = `${root}/Properties/${sanitizeFolderName(address)}/${sanitizeFolderName(category)}`
    const filename = sanitizeFilename(file.name || 'document.pdf')
    const dropboxPath = `${folderPath}/${filename}`

    // Ensure folder exists
    await dropboxV2Api.createFolderV2({ path: folderPath }).catch(() => {})

    // Upload to Dropbox
    const result = await dropboxV2Api.upload({
      path: dropboxPath,
      contents: file.content,
      mode: 'add',
      autorename: true,
    })

    // Create a shared link for preview
    let sharedLink = null
    try {
      const linkResult = await dropboxV2Api.sharingCreateSharedLinkWithSettings({
        path: dropboxPath,
        settings: { requested_visibility: { '.tag': 'shared' } },
      })
      sharedLink = linkResult.url
    } catch {
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
      size: result.size || file.content.length,
    })
  } catch (err) {
    console.error('Dropbox upload error:', err)
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
}

async function parseMultipart(req) {
  const contentType = req.headers['content-type'] || ''
  const boundary = contentType.split('boundary=')[1]
  if (!boundary) throw new Error('No boundary in content-type')

  const boundaryBuffer = Buffer.from(`--${boundary}`)

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)

  const Fields = {}
  const Files = {}

  let pos = 0
  while (pos < body.length) {
    const start = body.indexOf(boundaryBuffer, pos)
    if (start === -1) break
    const sectionStart = start + boundaryBuffer.length
    if (body.slice(sectionStart, sectionStart + 2).toString() === '--') break

    const nextStart = body.indexOf(boundaryBuffer, sectionStart)
    const section = body.slice(sectionStart, nextStart !== -1 ? nextStart : body.length)

    const headerEnd = section.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue
    const headerBlock = section.slice(0, headerEnd).toString()
    const contentStart = headerEnd + 4
    const content = section.slice(contentStart, section.length - 2)

    const nameMatch = headerBlock.match(/name="([^"]+)"/)
    const filenameMatch = headerBlock.match(/filename="([^"]+)"/)
    const name = nameMatch ? nameMatch[1] : ''

    if (filenameMatch) {
      if (!Files[name]) Files[name] = []
      Files[name].push({
        name: filenameMatch[1],
        content,
        contentType: headerBlock.match(/Content-Type:\s*(\S+)/)?.[1] || 'application/octet-stream',
      })
    } else {
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
