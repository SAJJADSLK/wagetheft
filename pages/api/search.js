// Vercel Serverless Function — /api/search
// Used by the search page for client-side pagination

import { searchViolations } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q = '', country = '', page = '0' } = req.query;

  // Validate inputs
  const pageNum = Math.max(0, parseInt(page, 10) || 0);
  const cleanQ  = String(q).trim().slice(0, 200);
  const cleanC  = ['', 'USA', 'UK', 'Australia', 'Canada', 'New Zealand', 'Ireland', 'Netherlands', 'EU'].includes(country) ? country : '';

  try {
    const data = await searchViolations(cleanQ, { country: cleanC, page: pageNum });

    // Cache for 60 seconds on Vercel's edge
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ data, page: pageNum, query: cleanQ });

  } catch (err) {
    console.error('[api/search]', err.message);
    return res.status(500).json({ error: 'Search temporarily unavailable. Please try again.' });
  }
}
