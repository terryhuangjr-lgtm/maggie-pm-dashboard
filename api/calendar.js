/**
 * Google Calendar API endpoint for MaggiePM Dashboard
 * Fetches events from MH_PM Google Calendar (SOURCE OF TRUTH)
 * GET /api/calendar
 * GET /api/calendar?date=2026-05-25  (specific day)
 * POST /api/calendar (create event)
 * DELETE /api/calendar?id=<eventId> (delete event)
 */
import { google } from 'googleapis';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Debug: check env vars existence (not values)
  const envCheck = {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'magchiang@gmail.com'
  };

  // Return debug info for direct /api/calendar hits
  if (req.query && req.query._debug === '1') {
    return res.status(200).json(envCheck);
  }

  // Build auth
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = envCheck.calendarId;

  try {
    // GET — fetch events
    if (req.method === 'GET') {
      const { date } = req.query;

      let timeMin, timeMax;
      if (date) {
        // Specific day
        timeMin = new Date(`${date}T00:00:00-04:00`).toISOString();
        timeMax = new Date(`${date}T23:59:59-04:00`).toISOString();
      } else {
        // Next 60 days
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

    // POST — create event
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
        eventBody = {
          summary: title,
          description: description || '',
          start: { date },
          end: { date }
        };
      }

      const created = await calendar.events.insert({
        calendarId,
        body: eventBody
      });

      return res.status(201).json(created.data);
    }

    // DELETE — delete event
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      await calendar.events.delete({ calendarId, eventId: id });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Calendar API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Calendar API failed',
      code: error.code,
      status: error.status
    });
  }
}
