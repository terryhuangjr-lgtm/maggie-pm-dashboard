/**
 * Dropbox V2 API helper for Vercel serverless functions.
 * No external dependencies — uses native fetch + crypto.
 *
 * Usage:
 *   import { dropboxV2Api } from './_dropbox'
 *   await dropboxV2Api.upload({ path: '/folder/file.pdf', contents: buffer })
 */

const API_BASE = 'https://api.dropboxapi.com/2'
const CONTENT_BASE = 'https://content.dropboxapi.com/2'

function getHeaders() {
  const token = process.env.DROPBOX_ACCESS_TOKEN
  if (!token) throw new Error('DROPBOX_ACCESS_TOKEN not set')
  return {
    Authorization: `Bearer ${token}`,
  }
}

export const dropboxV2Api = {
  /**
   * Upload a file to Dropbox.
   * @param {Object} opts
   * @param {string} opts.path - Full path in Dropbox (e.g., "/MH Group/Property/Lease.pdf")
   * @param {Buffer|Uint8Array} opts.contents - File contents
   * @param {string} [opts.mode='add'] - 'add' or 'overwrite'
   * @param {boolean} [opts.autorename=true]
   * @returns {Promise<Object>} Dropbox file metadata
   */
  async upload({ path, contents, mode = 'add', autorename = true }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/octet-stream'
    headers['Dropbox-API-Arg'] = JSON.stringify({
      path,
      mode,
      autorename,
      mute: true,
    })

    const res = await fetch(`${CONTENT_BASE}/files/upload`, {
      method: 'POST',
      headers,
      body: contents,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Dropbox upload failed (${res.status}): ${text}`)
    }

    return res.json()
  },

  /**
   * Create a shared link for a file.
   * @param {Object} opts
   * @param {string} opts.path
   * @param {Object} [opts.settings]
   * @returns {Promise<Object>}
   */
  async sharingCreateSharedLinkWithSettings({ path, settings }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/sharing/create_shared_link_with_settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, settings }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Dropbox link failed (${res.status}): ${text}`)
    }

    return res.json()
  },

  /**
   * List shared links for a path.
   */
  async sharingListSharedLinks({ path, direct_only = true }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/sharing/list_shared_links`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, direct_only }),
    })

    if (!res.ok) throw new Error(`Dropbox list links failed: ${res.status}`)
    return res.json()
  },

  /**
   * Create a folder.
   */
  async createFolderV2({ path }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/create_folder_v2`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, autorename: false }),
    })

    if (res.status === 409) return null // already exists
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Dropbox create folder failed (${res.status}): ${text}`)
    }

    return res.json()
  },

  /**
   * List files in a folder.
   */
  async listFolder({ path }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/list_folder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, recursive: false }),
    })

    if (!res.ok) throw new Error(`Dropbox list folder failed: ${res.status}`)
    return res.json()
  },

  /**
   * Delete a file or folder.
   */
  async deleteV2({ path }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/delete_v2`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path }),
    })

    if (!res.ok) throw new Error(`Dropbox delete failed: ${res.status}`)
    return res.json()
  },

  /**
   * Move a file or folder.
   */
  async moveV2({ from_path, to_path }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/move_v2`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ from_path, to_path, autorename: true }),
    })

    if (!res.ok) throw new Error(`Dropbox move failed: ${res.status}`)
    return res.json()
  },

  /**
   * Search files.
   */
  async search({ query, path = '', max_results = 50 }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/search_v2`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, path, max_results }),
    })

    if (!res.ok) throw new Error(`Dropbox search failed: ${res.status}`)
    return res.json()
  },

  /**
   * Download a file from Dropbox.
   * @param {Object} opts
   * @param {string} opts.path
   * @returns {Promise<{contents: Buffer, name: string, mimetype: string}>}
   */
  async download({ path }) {
    const headers = getHeaders()
    headers['Dropbox-API-Arg'] = JSON.stringify({ path })

    const res = await fetch(`${CONTENT_BASE}/files/download`, {
      method: 'POST',
      headers,
    })

    if (!res.ok) throw new Error(`Dropbox download failed: ${res.status}`)
    return {
      contents: Buffer.from(await res.arrayBuffer()),
      name: path.split('/').pop(),
      mimetype: res.headers.get('Content-Type') || 'application/octet-stream',
    }
  },

  /**
   * Get temporary link for a file (redirects to download).
   */
  async getTemporaryLink({ path }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/get_temporary_link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path }),
    })

    if (!res.ok) throw new Error(`Dropbox temp link failed: ${res.status}`)
    return res.json()
  },
}
