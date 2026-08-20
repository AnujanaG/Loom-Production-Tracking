const express = require('express');
const supabase = require('../supabaseClient');
const { requireOrg, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(requireOrg);

// List everyone active in the org, plus anyone still pending an invite
router.get('/', async (req, res) => {
  try {
    const orgId = req.profile.organization_id;
    const [{ data: members, error: e1 }, { data: invites, error: e2 }] = await Promise.all([
      supabase.from('profiles')
        .select('id, full_name, role, is_active, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),
      supabase.from('pending_invites')
        .select('id, email, role, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true })
    ]);
    if (e1 || e2) return res.status(400).json({ error: (e1 || e2).message });

    res.json({
      members: members || [],
      pendingInvites: invites || []
    });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Invite someone by email (owner/admin only). They just sign in with Google
// using that exact email, and the backend auto-attaches them to this
// organization on their first login - no separate "accept" step needed.
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (!['admin', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "manager"' });
    }

    const { data, error } = await supabase
      .from('pending_invites')
      .insert({
        organization_id: req.profile.organization_id,
        email: email.trim().toLowerCase(),
        role,
        invited_by: req.user.id
      })
      .select().single();

    if (error) {
      const msg = error.code === '23505' ? 'That email has already been invited' : error.message;
      return res.status(400).json({ error: msg });
    }
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Cancel a pending invite (owner/admin only)
router.delete('/invites/:id', requireAdmin, async (req, res) => {
  try {
    const { error, count } = await supabase
      .from('pending_invites').delete({ count: 'exact' })
      .eq('id', req.params.id)
      .eq('organization_id', req.profile.organization_id);
    if (error) return res.status(400).json({ error: error.message });
    if (!count) return res.status(404).json({ error: 'Invite not found' });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Deactivate/reactivate a user, or change their role (owner/admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own access here' });
    }
    const { is_active, role } = req.body;
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (role && ['admin', 'manager'].includes(role)) updates.role = role;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .eq('organization_id', req.profile.organization_id)
      .select();
    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'User not found in your organization' });
    res.json(data[0]);
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

module.exports = router;
