export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    method: req.method,
    hasToken: !!process.env.DROPBOX_ACCESS_TOKEN,
    envVars: Object.keys(process.env).filter(k => k.startsWith('DROP') || k.startsWith('VERCEL')),
  })
}
