/**
 * Dropbox V2 API helper for Vercel serverless functions.
 * No external dependencies — uses native fetch + crypto.
 *
 * Usage:
 *   import { dropboxV2Api } from './_dropbox.js'
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
  async upload({ path, contents, mode = 'add', autorename = true }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/octet-stream'
    headers['Dropbox-API-Arg'] = JSON.stringify({ path, mode, autorename, mute: true })

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

  async sharingListSharedLinks({ path, direct_only = true }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/sharing/list_shared_links`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, direct_only }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Dropbox list links failed (${res.status}): ${text}`)
    }

    return res.json()
  },

  async getTemporaryLink({ path }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/get_temporary_link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Dropbox temp link failed (${res.status}): ${text}`)
    }

    return res.json()
  },

  async listFolder({ path = '', limit = 200 }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/list_folder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, limit }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Dropbox list failed (${res.status}): ${text}`)
    }

    return res.json()
  },

  async createFolderV2({ path }) {
    const headers = getHeaders()
    headers['Content-Type'] = 'application/json'

    const res = await fetch(`${API_BASE}/files/create_folder_v2`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, autorename: false }),
    })

    if (!res.ok) {
      const text = await res.text()
      if (text.includes('conflict')) return null
      throw new Error(`Dropbox create folder failed (${res.status}): ${text}`)
    }

    return res.json()
  },
}
