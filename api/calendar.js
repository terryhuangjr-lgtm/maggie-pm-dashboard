/**
 * Google Calendar API endpoint for MaggiePM Dashboard
 * Fetches events from MH_PM Google Calendar (SOURCE OF TRUTH)
 * GET /api/calendar
 * GET /api/calendar?date=2026-05-25  (specific day)
 * POST /api/calendar (create event)
 * DELETE /api/calendar?id=<eventId> (delete event)
 * 
 * Uses raw HTTPS + google-auth-library (NOT googleapis, which has v172 bug with insert)
 */
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/calendar/v3';

async function getAccessToken() {
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(data.error_description || 'Failed to get access token');
  return data.access_token;
}

async function gcalFetch(path, options = {}) {
  const token = await getAccessToken();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Build auth for googleapis (used only for GET, which works fine)
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'magchiang@gmail.com';

  try {
    // GET — fetch events (uses googleapis — confirmed working)
    if (req.method === 'GET') {
      const { date } = req.query;

      let timeMin, timeMax;
      if (date) {
        timeMin = new Date(`${date}T00:00:00-04:00`).toISOString();
        timeMax = new Date(`${date}T23:59:59-04:00`).toISOString();
      } else {
        timeMin = new Date().toISOString();
        timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      }

      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250
      });

      return res.status(200).json(response.data.items || []);
    }

    // POST — create event (uses raw REST — googleapis v172 has insert bug)
    if (req.method === 'POST') {
      const { title, date, time, description, duration_hours } = req.body;
      if (!title || !date) {
        return res.status(400).json({ error: 'title and date are required' });
      }

      let eventBody;
      if (time) {
        const startDt = new Date(`${date}T${time}:00-04:00`);
        const endDt = new Date(startDt.getTime() + (duration_hours || 1) * 60 * 60 * 1000);
        eventBody = {
          summary: title,
          description: description || '',
          start: { dateTime: startDt.toISOString(), timeZone: 'America/New_York' },
          end: { dateTime: endDt.toISOString(), timeZone: 'America/New_York' }
        };
      } else {
        // All-day event
        eventBody = {
          summary: title,
          description: description || '',
          start: { date },
          end: { date }
        };
      }

      const created = await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        body: JSON.stringify(eventBody)
      });

      return res.status(201).json(created);
    }

    // DELETE — delete event (uses raw REST for consistency)
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      try {
        await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
      } catch (e) {
        // 204 No Content is expected for DELETE — don't parse body
        if (!e.message.includes('204')) throw e;
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Calendar API error:', error);
    return res.status(500).json({ error: error.message || 'Calendar API failed' });
  }
}
