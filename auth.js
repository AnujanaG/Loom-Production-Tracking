const supabase = require('../supabaseClient');

// Verifies the Supabase JWT sent from the admin panel / mobile app,
// then attaches the user's profile (organization + role) to req.profile.
// If the user has no profile yet (very first login ever), req.profile is null -
// routes/organizations.js handles that onboarding case.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;

  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: 'Could not load user profile' });
  }

  // First-ever login for this account, and no organization yet - check if
  // someone already invited this email address to their organization.
  if (!profile && data.user.email) {
    const { data: invite } = await supabase
      .from('pending_invites')
      .select('*')
      .eq('email', data.user.email)
      .maybeSingle();

    if (invite) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          organization_id: invite.organization_id,
          role: invite.role,
          full_name: data.user.user_metadata?.full_name || data.user.email,
          is_active: true
        })
        .select().single();

      if (!createError) {
        profile = newProfile;
        await supabase.from('pending_invites').delete().eq('id', invite.id);
      }
    }
  }

  req.profile = profile || null;
  next();
}

// Use after requireAuth on routes that need an organization to exist.
// Blocks access cleanly for a user who hasn't finished onboarding
// (created/joined an organization) yet.
function requireOrg(req, res, next) {
  if (!req.profile || !req.profile.organization_id) {
    return res.status(403).json({ error: 'NO_ORGANIZATION', message: 'Please set up your organization first' });
  }
  if (req.profile.is_active === false) {
    return res.status(403).json({ error: 'ACCOUNT_INACTIVE', message: 'This account has been deactivated' });
  }
  next();
}

// Use on routes that only owners/admins should reach (not 'manager' role)
function requireAdmin(req, res, next) {
  if (!req.profile || !['owner', 'admin'].includes(req.profile.role)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only admins can perform this action' });
  }
  next();
}

// Use on routes that only the organization owner should reach (e.g. Settings)
function requireOwner(req, res, next) {
  if (!req.profile || req.profile.role !== 'owner') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the organization owner can perform this action' });
  }
  next();
}

module.exports = { requireAuth, requireOrg, requireAdmin, requireOwner };
