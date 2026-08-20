const express = require('express');
const supabase = require('../supabaseClient');

// Generates list/get/create/update/delete routes for a given table, scoped
// to the logged-in user's organization. Every query filters by
// organization_id so one organization can never see another's data -
// this is enforced here in the backend (not just relying on RLS).
//
// options.requiredFields - fields that must be present and non-empty on create
// options.numericFields  - fields that must be valid numbers if present
// options.dateFields      - fields that must be valid dates if present
function makeCrudRouter(tableName, options = {}) {
  const router = express.Router();
  const { requiredFields = [], numericFields = [], dateFields = [], customValidate = null } = options;

  function validateBody(body) {
    const errors = [];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`${field} is required`);
      }
    }
    for (const field of numericFields) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
        if (isNaN(Number(body[field]))) errors.push(`${field} must be a number`);
        else if (Number(body[field]) < 0) errors.push(`${field} cannot be negative`);
      }
    }
    for (const field of dateFields) {
      if (body[field] && isNaN(Date.parse(body[field]))) {
        errors.push(`${field} must be a valid date`);
      }
    }
    return errors;
  }

  router.get('/', async (req, res) => {
    try {
      let query = supabase.from(tableName).select('*').eq('organization_id', req.profile.organization_id);

      // Optional date-range filtering: /api/xyz?from=2026-01-01&to=2026-01-31&date_field=production_date
      const { from, to, date_field } = req.query;
      if (date_field && from) query = query.gte(date_field, from);
      if (date_field && to) query = query.lte(date_field, to);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Unexpected server error' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from(tableName).select('*')
        .eq('id', req.params.id)
        .eq('organization_id', req.profile.organization_id)
        .maybeSingle();
      if (error) return res.status(400).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Not found' });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Unexpected server error' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const errors = validateBody(req.body);
      if (customValidate) {
        const customError = customValidate(req.body);
        if (customError) errors.push(customError);
      }
      if (errors.length) return res.status(400).json({ error: errors.join('; ') });

      const payload = { ...req.body, organization_id: req.profile.organization_id };
      const { data, error } = await supabase.from(tableName).insert(payload).select();
      if (error) {
        const msg = error.code === '23505' ? 'A record with that value already exists' : error.message;
        return res.status(400).json({ error: msg });
      }
      res.status(201).json(data[0]);
    } catch (e) {
      res.status(500).json({ error: 'Unexpected server error' });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const errors = validateBody({ ...req.body, ...requiredFieldsPresentForUpdate(req.body) });
      if (customValidate && Object.keys(req.body).length > 1) {
        const customError = customValidate(req.body);
        if (customError) errors.push(customError);
      }
      if (errors.length) return res.status(400).json({ error: errors.join('; ') });

      const { organization_id, id, ...safeBody } = req.body; // never allow overriding org/id
      const { data, error } = await supabase
        .from(tableName).update(safeBody)
        .eq('id', req.params.id)
        .eq('organization_id', req.profile.organization_id)
        .select();
      if (error) return res.status(400).json({ error: error.message });
      if (!data.length) return res.status(404).json({ error: 'Not found' });
      res.json(data[0]);
    } catch (e) {
      res.status(500).json({ error: 'Unexpected server error' });
    }
  });

  // Partial updates (e.g. toggling is_active) shouldn't require all fields again
  function requiredFieldsPresentForUpdate(body) {
    const present = {};
    for (const field of requiredFields) present[field] = body[field] !== undefined ? body[field] : 'x';
    return present;
  }

  router.delete('/:id', async (req, res) => {
    try {
      const { error, count } = await supabase
        .from(tableName).delete({ count: 'exact' })
        .eq('id', req.params.id)
        .eq('organization_id', req.profile.organization_id);
      if (error) return res.status(400).json({ error: error.message });
      if (!count) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: 'Unexpected server error' });
    }
  });

  return router;
}

module.exports = makeCrudRouter;
