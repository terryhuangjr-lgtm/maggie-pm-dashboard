/**
 * GET /api/dropbox-test — quick health check
 */
export default async function handler(req, res) {
  const hasToken = !!process.env.DROPBOX_ACCESS_TOKEN
  const tokenLen = process.env.DROPBOX_ACCESS_TOKEN?.length || 0
  const root = process.env.DROPBOX_ROOT || '(default)'
  
  if (!hasToken) {
    return res.status(200).json({
      ok: false,
      error: 'DROPBOX_ACCESS_TOKEN not set in Vercel env',
      tokenLen,
      root,
      node: process.version,
      envKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('TOKEN') && !k.includes('KEY')).slice(0, 10),
    })
  }

  // Test Dropbox connectivity
  try {
    const res2 = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: '/Property Management_MH Group', limit: 10 }),
    })
    const data = await res2.json()
    return res.status(200).json({
      ok: res2.ok,
      status: res2.status,
      entries: (data.entries || []).map(e => e.name),
      error: data.error_summary || null,
      root,
    })
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: err.message,
      root,
    })
  }
}
