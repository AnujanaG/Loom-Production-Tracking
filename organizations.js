const express = require('express');
const supabase = require('../supabaseClient');
const { requireOwner } = require('../middleware/auth');
const router = express.Router();

// Returns the current user's profile + organization (or null if not set up yet).
// Frontend uses this right after login to decide: dashboard, or onboarding screen.
router.get('/me', async (req, res) => {
  if (!req.profile || !req.profile.organization_id) {
    return res.json({ profile: req.profile, organization: null });
  }
  const { data: org, error } = await supabase
    .from('organizations').select('*').eq('id', req.profile.organization_id).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ profile: req.profile, organization: org });
});

// Creates a brand-new organization and makes the current user its owner.
// Used exactly once, on a user's very first login.
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    if (req.profile && req.profile.organization_id) {
      return res.status(400).json({ error: 'You already belong to an organization' });
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), owner_id: req.user.id })
      .select().single();
    if (orgError) return res.status(400).json({ error: orgError.message });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: req.user.id,
        organization_id: org.id,
        role: 'owner',
        phone: req.user.phone || null,
        is_active: true
      })
      .select().single();
    if (profileError) return res.status(400).json({ error: profileError.message });

    res.status(201).json({ organization: org, profile });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Update organization settings - owner only.
// Covers: name, logo, wage rounding rule, default language, notification toggles.
router.put('/', requireOwner, async (req, res) => {
  try {
    const { name, logo_url, wage_rounding, default_language, notify_low_stock, notify_pending_deliveries } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Organization name cannot be empty' });
    }
    const validRounding = ['none', 'nearest_1', 'nearest_0_5', 'round_up'];
    if (wage_rounding !== undefined && !validRounding.includes(wage_rounding)) {
      return res.status(400).json({ error: `wage_rounding must be one of: ${validRounding.join(', ')}` });
    }
    if (default_language !== undefined && !['en', 'ta'].includes(default_language)) {
      return res.status(400).json({ error: 'default_language must be "en" or "ta"' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url || null;
    if (wage_rounding !== undefined) updates.wage_rounding = wage_rounding;
    if (default_language !== undefined) updates.default_language = default_language;
    if (notify_low_stock !== undefined) updates.notify_low_stock = !!notify_low_stock;
    if (notify_pending_deliveries !== undefined) updates.notify_pending_deliveries = !!notify_pending_deliveries;

    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', req.profile.organization_id)
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Update the current user's own profile (name). Available to any logged-in user.
router.put('/me/profile', async (req, res) => {
  try {
    const { full_name } = req.body;
    if (full_name !== undefined && !full_name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: full_name.trim() })
      .eq('id', req.user.id)
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

module.exports = router;
