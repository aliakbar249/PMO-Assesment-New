import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SECTIONS } from '../data/competencies';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── helpers ─────────────────────────────────────────────────
function genId() {
  return crypto.randomUUID();
}
function nowIso() {
  return new Date().toISOString();
}
function randChars(len = 8) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Database initialisation ──────────────────────────────────
// Called once on app start to ensure tables + admin seed exist
export async function initDb() {
  // Check if admin user exists
  const { data: adminCheck } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'admin@company.com')
    .maybeSingle();

  if (!adminCheck) {
    await supabase.from('users').insert({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@company.com',
      password: 'Admin@123',
      role: 'admin',
      name: 'System Administrator',
    });
  }

  // Seed template sections if empty
  const { data: sectionsCheck } = await supabase
    .from('template_sections')
    .select('id')
    .limit(1);

  if (!sectionsCheck || sectionsCheck.length === 0) {
    for (let si = 0; si < DEFAULT_SECTIONS.length; si++) {
      const sec = DEFAULT_SECTIONS[si];
      const { data: secRow } = await supabase
        .from('template_sections')
        .insert({
          id: sec.id,
          name: sec.title,
          description: sec.description,
          self_tip: sec.selfTip,
          reviewer_tip: sec.reviewerTip,
          order_index: si,
          active: true,
        })
        .select()
        .single();
      if (secRow) {
        const stmts = (sec.statements || []).map((st, i) => ({
          id: st.id,
          section_id: sec.id,
          text: st.text,
          self_tip: st.selfTip || null,
          reviewer_tip: st.reviewerTip || null,
          order_index: i,
          active: true,
        }));
        if (stmts.length) {
          await supabase.from('template_statements').insert(stmts);
        }
      }
    }

    // Seed default assessment template
    const defaultTemplateId = '00000000-0000-0000-0000-000000000002';
    await supabase.from('assessment_templates').insert({
      id: defaultTemplateId,
      name: 'Standard Assessment',
      description: 'Default 360° Power Skills assessment for all employees',
      is_default: true,
      target_levels: [],
      target_departments: [],
      active: true,
    });
    const sectionLinks = DEFAULT_SECTIONS.map((sec, i) => ({
      id: genId(),
      template_id: defaultTemplateId,
      section_id: sec.id,
      order_index: i,
    }));
    await supabase.from('assessment_template_sections').insert(sectionLinks);
  }
}

// ─── Auth ──────────────────────────────────────────────────────
export async function authenticate(email, password) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email.trim())
    .eq('password', password)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getUserById(id) {
  const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  return data || null;
}

// ─── Password Reset ────────────────────────────────────────────
export async function requestPasswordReset(email) {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email.trim())
    .maybeSingle();

  if (!user) return { success: false, error: 'No account found with that email address.' };

  const tempPassword = randChars(8) + '@1';

  // Update user password + flag
  await supabase
    .from('users')
    .update({ password: tempPassword, password_reset: true, updated_at: nowIso() })
    .eq('id', user.id);

  // Log reset
  await supabase.from('password_resets').insert({
    id: genId(),
    user_id: user.id,
    temp_password: tempPassword,
    used: false,
  });

  return { success: true, tempPassword, name: user.name, email: user.email };
}

export async function changePassword(userId, newPassword) {
  await supabase
    .from('users')
    .update({ password: newPassword, password_reset: false, updated_at: nowIso() })
    .eq('id', userId);
}

// ─── Admin: Reset password for any user ───────────────────────
export async function adminResetPassword(userId) {
  const tempPassword = randChars(8) + '@1';
  await supabase
    .from('users')
    .update({ password: tempPassword, password_reset: true, updated_at: nowIso() })
    .eq('id', userId);
  await supabase.from('password_resets').insert({
    id: genId(),
    user_id: userId,
    temp_password: tempPassword,
    used: false,
  });
  return { tempPassword };
}

// ─── Admin: Set a specific new password for any user ──────────
export async function adminSetPassword(userId, newPassword) {
  await supabase
    .from('users')
    .update({ password: newPassword, password_reset: false, updated_at: nowIso() })
    .eq('id', userId);
  return { success: true };
}

// ─── Admin: Toggle user active status ─────────────────────────
export async function adminToggleUserStatus(userId, status) {
  await supabase
    .from('users')
    .update({ status, updated_at: nowIso() })
    .eq('id', userId);
  // Also sync to employees table if linked
  await supabase
    .from('employees')
    .update({ status, updated_at: nowIso() })
    .eq('user_id', userId);
}

// ─── Employee Registration ─────────────────────────────────────
export async function registerEmployee(profile) {
  // Check duplicate email
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('email', profile.email.trim())
    .maybeSingle();

  if (existing) return { success: false, error: 'Email already registered.' };

  const userId = genId();
  const empId  = genId();
  const empNum = 'EMP-' + Date.now().toString().slice(-6);

  const { error: ue } = await supabase.from('users').insert({
    id: userId,
    role: 'employee',
    email: profile.email.trim(),
    password: profile.password,
    name: profile.name,
  });
  if (ue) return { success: false, error: ue.message };

  const { error: ee } = await supabase.from('employees').insert({
    id: empId,
    user_id: userId,
    employee_id: empNum,
    name: profile.name,
    email: profile.email.trim(),
    job_title: profile.jobTitle || null,
    department: profile.department || null,
    level: profile.level || null,
    organization: profile.organization || null,
    phone: profile.phone || null,
    location: profile.location || null,
    manager: profile.manager || null,
    status: 'active',
  });
  if (ee) return { success: false, error: ee.message };

  const newUser = { id: userId, role: 'employee', email: profile.email.trim(), name: profile.name };
  return { success: true, user: newUser };
}

// ─── Admin: Create employee with auto-generated password ───────
export async function adminCreateEmployee(profile) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('email', profile.email.trim())
    .maybeSingle();

  if (existing) return { success: false, error: 'Email already registered.' };

  const userId    = genId();
  const empId     = genId();
  const empNum    = 'EMP-' + Date.now().toString().slice(-6);
  const tempPass  = (profile.name || 'user').split(' ')[0].toLowerCase() + '@360';

  const { error: ue } = await supabase.from('users').insert({
    id: userId,
    role: 'employee',
    email: profile.email.trim(),
    password: tempPass,
    name: profile.name,
    password_reset: true,   // force change on first login
  });
  if (ue) return { success: false, error: ue.message };

  const { error: ee } = await supabase.from('employees').insert({
    id: empId,
    user_id: userId,
    employee_id: empNum,
    name: profile.name,
    email: profile.email.trim(),
    job_title: profile.jobTitle || null,
    department: profile.department || null,
    level: profile.level || null,
    organization: profile.organization || null,
    phone: profile.phone || null,
    location: profile.location || null,
    manager: profile.manager || null,
    status: 'active',
  });
  if (ee) {
    // Rollback user
    await supabase.from('users').delete().eq('id', userId);
    return { success: false, error: ee.message };
  }

  return { success: true, tempPassword: tempPass, employeeId: empNum };
}

// ─── Admin: Create reviewer directly (without nomination flow) ──
export async function adminCreateReviewer(profile) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('email', profile.email.trim())
    .maybeSingle();

  if (existing) return { success: false, error: 'Email already registered.' };

  const userId   = genId();
  const revId    = genId();
  const nomId    = genId();
  const tempPass = (profile.name || 'reviewer').split(' ')[0].toLowerCase() + '@360';

  const { error: ue } = await supabase.from('users').insert({
    id: userId,
    role: 'reviewer',
    email: profile.email.trim(),
    password: tempPass,
    name: profile.name,
    password_reset: true,
  });
  if (ue) return { success: false, error: ue.message };

  // Create a nomination record (admin-created, auto-approved)
  const { error: ne } = await supabase.from('nominations').insert({
    id: nomId,
    employee_id: profile.employeeId,
    assignment_id: profile.assignmentId || null,
    reviewer_type: profile.category || 'peer',
    name: profile.name,
    role: profile.role || null,
    department: profile.department || null,
    designation: profile.designation || null,
    email: profile.email.trim(),
    phone: profile.phone || null,
    approval_status: 'approved',
  });
  if (ne) {
    await supabase.from('users').delete().eq('id', userId);
    return { success: false, error: ne.message };
  }

  const { error: re } = await supabase.from('reviewers').insert({
    id: revId,
    user_id: userId,
    nomination_id: nomId,
    employee_id: profile.employeeId,
    temp_password: tempPass,
  });
  if (re) {
    await supabase.from('users').delete().eq('id', userId);
    await supabase.from('nominations').delete().eq('id', nomId);
    return { success: false, error: re.message };
  }

  return { success: true, tempPassword: tempPass };
}

// ─── Admin: Get user info linked to employee ───────────────────
export async function getUserByEmployeeId(empId) {
  const { data: emp } = await supabase
    .from('employees')
    .select('user_id')
    .eq('id', empId)
    .maybeSingle();
  if (!emp?.user_id) return null;
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', emp.user_id)
    .maybeSingle();
  return user || null;
}

// ─── Admin: Get user info linked to reviewer nomination ────────
export async function getUserByNominationId(nomId) {
  const { data: rev } = await supabase
    .from('reviewers')
    .select('user_id, users(*)')
    .eq('nomination_id', nomId)
    .maybeSingle();
  return rev?.users || null;
}

export async function getEmployeeByUserId(userId) {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ? mapEmployee(data) : null;
}

export async function getEmployeeById(empId) {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('id', empId)
    .maybeSingle();
  return data ? mapEmployee(data) : null;
}

export async function getAllEmployees() {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });
  return (data || []).map(mapEmployee);
}

export async function updateEmployee(empId, updates) {
  const row = {};
  if (updates.name        !== undefined) row.name         = updates.name;
  if (updates.jobTitle    !== undefined) row.job_title     = updates.jobTitle;
  if (updates.department  !== undefined) row.department    = updates.department;
  if (updates.level       !== undefined) row.level         = updates.level;
  if (updates.organization!== undefined) row.organization  = updates.organization;
  if (updates.phone       !== undefined) row.phone         = updates.phone;
  if (updates.location    !== undefined) row.location      = updates.location;
  if (updates.manager     !== undefined) row.manager       = updates.manager;
  if (updates.status      !== undefined) row.status        = updates.status;
  if (updates.profileComplete !== undefined) row.profile_complete = updates.profileComplete;
  row.updated_at = nowIso();
  await supabase.from('employees').update(row).eq('id', empId);
}

// ─── Admin: Assign / remove assessment template for an employee ─
// Uses a dedicated employee_template_assignments table (no ALTER TABLE needed)
// REQUIRES this table to exist — run the migration SQL in Supabase Dashboard if missing.
export async function assignTemplateToEmployee(empId, templateId) {
  try {
    if (!templateId) {
      // Remove assignment (revert to default)
      const { error } = await supabase
        .from('employee_template_assignments')
        .delete()
        .eq('employee_id', empId);
      if (error) {
        if (error.message?.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
          return { success: false, error: 'MISSING_TABLE' };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    }
    // Upsert: one row per employee (UNIQUE constraint on employee_id)
    const { error } = await supabase
      .from('employee_template_assignments')
      .upsert(
        { employee_id: empId, template_id: templateId, updated_at: nowIso() },
        { onConflict: 'employee_id' }
      );
    if (error) {
      console.error('assignTemplateToEmployee error:', error);
      if (error.message?.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
        return { success: false, error: 'MISSING_TABLE' };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    console.error('assignTemplateToEmployee exception:', e);
    return { success: false, error: e.message };
  }
}

// ─── Get the assigned template id for a single employee ────────
export async function getEmployeeTemplateId(empId) {
  try {
    const { data, error } = await supabase
      .from('employee_template_assignments')
      .select('template_id')
      .eq('employee_id', empId)
      .maybeSingle();
    if (error) return null; // table missing or other error — fall back silently
    return data?.template_id || null;
  } catch {
    return null;
  }
}

// ─── Bulk-load template assignments for all employees ──────────
export async function getAllEmployeeTemplateAssignments() {
  try {
    const { data, error } = await supabase
      .from('employee_template_assignments')
      .select('employee_id, template_id');
    if (error) return {}; // table missing — return empty map silently
    // Return a map: { employeeId -> templateId }
    return Object.fromEntries((data || []).map(r => [r.employee_id, r.template_id]));
  } catch {
    return {};
  }
}

export async function updateEmployeeStatus(empId, status) {
  await supabase.from('employees').update({ status, updated_at: nowIso() }).eq('id', empId);
  // Also update linked user
  const { data: emp } = await supabase.from('employees').select('user_id').eq('id', empId).maybeSingle();
  if (emp?.user_id) {
    await supabase.from('users').update({ status, updated_at: nowIso() }).eq('id', emp.user_id);
  }
}

function mapEmployee(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title,
    department: row.department,
    level: row.level,
    organization: row.organization,
    phone: row.phone,
    location: row.location,
    manager: row.manager,
    status: row.status,
    profileComplete: row.profile_complete,
    // templateId is loaded separately via employee_template_assignments table
    templateId: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Templates ─────────────────────────────────────────────────
export async function getTemplates() {
  const { data: sections } = await supabase
    .from('template_sections')
    .select('*, template_statements(*)')
    .eq('active', true)
    .order('order_index', { ascending: true });

  return (sections || []).map(sec => ({
    id: sec.id,
    title: sec.name,
    description: sec.description,
    selfTip: sec.self_tip,
    reviewerTip: sec.reviewer_tip,
    statements: ((sec.template_statements || [])
      .sort((a, b) => a.order_index - b.order_index))
      .map(st => ({
        id: st.id,
        text: st.text,
        selfTip: st.self_tip,
        reviewerTip: st.reviewer_tip,
      })),
  }));
}

export async function saveTemplates(templates) {
  const keepSectionIds  = templates.map(s => s.id);

  // ── 1. Delete sections that were removed ──────────────────────
  // Fetch all existing section IDs, then delete whichever are not in keepSectionIds
  const { data: existingSections } = await supabase
    .from('template_sections')
    .select('id');

  const sectionsToDelete = (existingSections || [])
    .map(r => r.id)
    .filter(id => !keepSectionIds.includes(id));

  if (sectionsToDelete.length > 0) {
    // Deleting a section cascades to its statements via FK in most setups,
    // but we also explicitly clean statements to be safe.
    await supabase.from('template_statements').delete().in('section_id', sectionsToDelete);
    await supabase.from('template_sections').delete().in('id', sectionsToDelete);
  }

  // ── 2. Upsert remaining sections + sync their statements ──────
  for (let si = 0; si < templates.length; si++) {
    const sec = templates[si];

    await supabase.from('template_sections').upsert({
      id: sec.id,
      name: sec.title,
      description: sec.description || null,
      self_tip: sec.selfTip || null,
      reviewer_tip: sec.reviewerTip || null,
      order_index: si,
      active: true,
    });

    const keepStatementIds = (sec.statements || []).map(st => st.id).filter(Boolean);

    // Delete statements removed from this section
    if (keepStatementIds.length > 0) {
      await supabase
        .from('template_statements')
        .delete()
        .eq('section_id', sec.id)
        .not('id', 'in', `(${keepStatementIds.map(id => `"${id}"`).join(',')})`);
    } else {
      // No statements left — delete all for this section
      await supabase.from('template_statements').delete().eq('section_id', sec.id);
    }

    // Upsert current statements
    for (let i = 0; i < (sec.statements || []).length; i++) {
      const st = sec.statements[i];
      await supabase.from('template_statements').upsert({
        id: st.id || genId(),
        section_id: sec.id,
        text: st.text,
        self_tip: st.selfTip || null,
        reviewer_tip: st.reviewerTip || null,
        order_index: i,
        active: true,
      });
    }
  }
}

export async function getTemplateForEmployee(employee) {
  if (!employee?.id) return getTemplates();

  // ── Step 1: Check direct assignment in employee_template_assignments ──
  const { data: assignment } = await supabase
    .from('employee_template_assignments')
    .select('template_id')
    .eq('employee_id', employee.id)
    .maybeSingle();

  const directTemplateId = assignment?.template_id || null;

  if (directTemplateId) {
    const sections = await sectionsForTemplateId(directTemplateId);
    if (sections) return sections;
  }

  // ── Step 2: Level / department auto-matching (non-default templates) ──
  if (employee.level || employee.department) {
    const { data: templates } = await supabase
      .from('assessment_templates')
      .select('*, assessment_template_sections(section_id)')
      .neq('active', false);

    const matched = (templates || []).find(t => {
      const levels = t.target_levels || [];
      const depts  = t.target_departments || [];
      const levelMatch = levels.length === 0 || levels.includes(employee.level);
      const deptMatch  = depts.length  === 0 || depts.includes(employee.department);
      return levelMatch && deptMatch && !t.is_default;
    });

    if (matched) {
      const sections = await sectionsForTemplateId(matched.id);
      if (sections) return sections;
    }
  }

  // ── Step 3: Fallback — all active sections ────────────────────
  return getTemplates();
}

// Helper: fetch and map sections for a given template ID
async function sectionsForTemplateId(templateId) {
  const { data: tmpl } = await supabase
    .from('assessment_templates')
    .select('assessment_template_sections(section_id, order_index)')
    .eq('id', templateId)
    .maybeSingle();

  const links = tmpl?.assessment_template_sections || [];
  if (links.length === 0) return null;

  const sectionIds = links
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(l => l.section_id);

  const { data: sections } = await supabase
    .from('template_sections')
    .select('*, template_statements(*)')
    .in('id', sectionIds)
    .neq('active', false)
    .order('order_index', { ascending: true });

  if (!sections || sections.length === 0) return null;

  return sections.map(sec => ({
    id: sec.id,
    title: sec.name,
    description: sec.description,
    selfTip: sec.self_tip,
    reviewerTip: sec.reviewer_tip,
    statements: (sec.template_statements || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(st => ({
        id: st.id,
        text: st.text,
        selfTip: st.self_tip,
        reviewerTip: st.reviewer_tip,
      })),
  }));
}

// ─── Assessment Templates (multi-template management) ──────────
export async function getAssessmentTemplates() {
  const { data: templates, error } = await supabase
    .from('assessment_templates')
    .select('*, assessment_template_sections(section_id, order_index)')
    .neq('active', false)          // accepts TRUE and NULL, excludes only FALSE
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('getAssessmentTemplates error:', error.message);
    return [];
  }

  const allSections = await getTemplates();

  return (templates || []).map(t => {
    const sectionIds = ((t.assessment_template_sections || [])
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map(s => s.section_id));
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      isDefault: t.is_default,
      targetLevels: t.target_levels || [],
      targetDepartments: t.target_departments || [],
      reviewerTypes: t.reviewer_types || { self: true, sponsor: false, peer: false, team: false },
      reviewerCounts: t.reviewer_counts || { sponsor: 1, peer: 1, team: 1 },
      sectionIds,
      sections: sectionIds
        .map(sid => allSections.find(s => s.id === sid))
        .filter(Boolean),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  });
}

export async function saveAssessmentTemplates(templates) {
  if (!templates || templates.length === 0) return { success: false, error: 'No templates provided' };

  const errors = [];

  for (const tmpl of templates) {
    const row = {
      name: tmpl.name,
      description: tmpl.description || null,
      is_default: tmpl.isDefault || false,
      target_levels: tmpl.targetLevels || [],
      target_departments: tmpl.targetDepartments || [],
      reviewer_types: tmpl.reviewerTypes || { self: true, sponsor: false, peer: false, team: false },
      reviewer_counts: tmpl.reviewerCounts || { sponsor: 1, peer: 1, team: 1 },
      active: true,
      updated_at: nowIso(),
    };

    let templateId = tmpl.id || null;

    if (templateId) {
      // ── UPDATE existing template ──────────────────────────────
      const { error: ue } = await supabase
        .from('assessment_templates')
        .update(row)
        .eq('id', templateId);
      if (ue) { errors.push(ue.message); console.error('update template error:', ue); continue; }

      // Delete old section links then re-insert
      const { error: de } = await supabase
        .from('assessment_template_sections')
        .delete()
        .eq('template_id', templateId);
      if (de) { errors.push(de.message); console.error('delete sections error:', de); continue; }

    } else {
      // ── INSERT new template ───────────────────────────────────
      templateId = genId();
      const { error: ie } = await supabase
        .from('assessment_templates')
        .insert({ id: templateId, ...row, created_at: nowIso() });
      if (ie) { errors.push(ie.message); console.error('insert template error:', ie); continue; }
    }

    // Insert section links (always after delete/insert above)
    if (tmpl.sectionIds && tmpl.sectionIds.length > 0) {
      const sectionRows = tmpl.sectionIds.map((sid, i) => ({
        id: genId(),
        template_id: templateId,
        section_id: sid,
        order_index: i,
      }));
      const { error: se } = await supabase
        .from('assessment_template_sections')
        .insert(sectionRows);
      if (se) { errors.push(se.message); console.error('insert section links error:', se); }
    }
  }

  return errors.length === 0
    ? { success: true }
    : { success: false, error: errors.join('; ') };
}

export async function deleteAssessmentTemplate(templateId) {
  await supabase.from('assessment_template_sections').delete().eq('template_id', templateId);
  await supabase.from('assessment_templates').delete().eq('id', templateId);
}

// ─── Self-Assessment ───────────────────────────────────────────
export async function getAssessment(employeeId) {
  const { data } = await supabase
    .from('assessments')
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    employeeId: data.employee_id,
    sections: data.responses || {},
    status: data.status,
    submittedAt: data.submitted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function saveAssessmentProgress(employeeId, sectionId, ratings) {
  const existing = await getAssessment(employeeId);
  const sections = { ...(existing?.sections || {}), [sectionId]: ratings };

  if (existing) {
    await supabase
      .from('assessments')
      .update({ responses: sections, updated_at: nowIso() })
      .eq('id', existing.id);
  } else {
    await supabase.from('assessments').insert({
      id: genId(),
      employee_id: employeeId,
      responses: sections,
      status: 'in_progress',
    });
  }
}

export async function submitSelfAssessment(employeeId) {
  await supabase
    .from('assessments')
    .update({ status: 'submitted', submitted_at: nowIso(), updated_at: nowIso() })
    .eq('employee_id', employeeId);
}

// ─── Assignments ───────────────────────────────────────────────
export async function getAssignmentsByEmployee(employeeId) {
  const { data } = await supabase
    .from('assignments')
    .select('*')
    .eq('employee_id', employeeId)
    .order('slot_number', { ascending: true });
  return (data || []).map(mapAssignment);
}

export async function upsertAssignment(employeeId, assignment) {
  // Convert YYYY-MM (month picker) → YYYY-MM-01 so Postgres DATE column accepts it
  const toDate = v => (v && /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v || null);

  const row = {
    employee_id: employeeId,
    slot_number: assignment.slotNumber || 1,
    title: assignment.title || null,
    type: assignment.type || null,
    sector: assignment.sector || null,
    client_org: assignment.clientOrg || null,
    role: assignment.role || null,
    start_date: toDate(assignment.startDate),
    end_date: toDate(assignment.endDate),
    status: assignment.status || null,
    budget: assignment.budget || null,
    team_size: assignment.teamSize ? parseInt(assignment.teamSize) : null,
    location: assignment.location || null,
    description: assignment.description || null,
    outcomes: assignment.outcomes || null,
    challenges: assignment.challenges || null,
    updated_at: nowIso(),
  };

  if (assignment.id) {
    // Update existing row
    const { data: existing } = await supabase
      .from('assignments')
      .select('id')
      .eq('id', assignment.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from('assignments').update(row).eq('id', assignment.id);
      if (error) { console.error('upsertAssignment update error:', error); return { success: false, error: error.message }; }
      return { success: true };
    }
  }

  // Insert new — pick the lowest unused slot number (1, 2 or 3)
  const { data: existingSlots } = await supabase
    .from('assignments')
    .select('slot_number')
    .eq('employee_id', employeeId);
  const usedSlots = (existingSlots || []).map(r => r.slot_number);
  const freeSlot  = [1, 2, 3].find(n => !usedSlots.includes(n));
  if (!freeSlot) return { success: false, error: 'Maximum of 3 assignments already reached.' };

  const { error } = await supabase
    .from('assignments')
    .insert({ id: genId(), ...row, slot_number: freeSlot });
  if (error) { console.error('upsertAssignment insert error:', error); return { success: false, error: error.message }; }
  return { success: true };
}

export async function deleteAssignment(assignmentId) {
  await supabase.from('assignments').delete().eq('id', assignmentId);
}

function mapAssignment(row) {
  // Postgres DATE returns "YYYY-MM-DD"; strip the day so the month picker shows "YYYY-MM"
  const toMonth = v => (v && v.length === 10 ? v.slice(0, 7) : v || '');
  return {
    id: row.id,
    employeeId: row.employee_id,
    slotNumber: row.slot_number,
    title: row.title,
    type: row.type,
    sector: row.sector,
    clientOrg: row.client_org,
    role: row.role,
    startDate: toMonth(row.start_date),
    endDate: toMonth(row.end_date),
    status: row.status,
    budget: row.budget,
    teamSize: row.team_size,
    location: row.location,
    description: row.description,
    outcomes: row.outcomes,
    challenges: row.challenges,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Nominations ───────────────────────────────────────────────
export async function getNominations(employeeId) {
  const { data } = await supabase
    .from('nominations')
    .select('*, assignments(slot_number, title)')
    .eq('employee_id', employeeId);

  if (!data || data.length === 0) return null;

  // Build byAssignment map: { assignmentId: { category: [people] } }
  const byAssignment = {};
  for (const nom of data) {
    if (!byAssignment[nom.assignment_id]) byAssignment[nom.assignment_id] = {};
    if (!byAssignment[nom.assignment_id][nom.reviewer_type]) byAssignment[nom.assignment_id][nom.reviewer_type] = [];
    byAssignment[nom.assignment_id][nom.reviewer_type].push({
      id: nom.id,
      name: nom.name,
      role: nom.role,
      department: nom.department,
      designation: nom.designation,
      email: nom.email,
      phone: nom.phone,
      approvalStatus: nom.approval_status,
    });
  }

  // Check if submitted (has any approved/pending reviewers)
  const submitted = data.some(n => n.approval_status !== null);
  return { employeeId, byAssignment, submitted };
}

export async function saveNominationGroup(employeeId, assignmentId, category, people) {
  // Delete old nominations for this employee+assignment+category
  await supabase
    .from('nominations')
    .delete()
    .eq('employee_id', employeeId)
    .eq('assignment_id', assignmentId)
    .eq('reviewer_type', category);

  // Insert new ones
  const rows = people
    .filter(p => p.name && p.email)
    .map(p => ({
      id: genId(),
      employee_id: employeeId,
      assignment_id: assignmentId,
      reviewer_type: category,
      name: p.name,
      role: p.role || null,
      department: p.department || null,
      designation: p.designation || null,
      email: p.email,
      phone: p.phone || null,
      approval_status: 'pending',
    }));

  if (rows.length > 0) {
    await supabase.from('nominations').insert(rows);
  }
}

export async function submitNominations(employeeId) {
  // Create pending reviewer user accounts for all nominations
  const { data: nominations } = await supabase
    .from('nominations')
    .select('*')
    .eq('employee_id', employeeId);

  if (!nominations) return;

  const { data: employee } = await supabase.from('employees').select('name').eq('id', employeeId).maybeSingle();

  for (const nom of nominations) {
    if (!nom.email) continue;
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .ilike('email', nom.email)
      .maybeSingle();

    if (!existingUser) {
      const userId = genId();
      const tempPassword = (nom.name || 'user').split(' ')[0].toLowerCase() + '@360';
      await supabase.from('users').insert({
        id: userId,
        role: 'reviewer',
        email: nom.email,
        password: tempPassword,
        name: nom.name,
      });
      await supabase.from('reviewers').insert({
        id: genId(),
        user_id: userId,
        nomination_id: nom.id,
        employee_id: employeeId,
        temp_password: tempPassword,
      });
    }
    // Mark nomination as pending (stays pending until admin approves)
    await supabase.from('nominations').update({ approval_status: 'pending' }).eq('id', nom.id);
  }
}

// ─── Reviewer Profiles ─────────────────────────────────────────
export async function getPendingReviewers() {
  const { data } = await supabase
    .from('nominations')
    .select('*, employees(name, department, job_title)')
    .eq('approval_status', 'pending');
  return (data || []).map(mapNomination);
}

export async function getAllReviewers() {
  const { data } = await supabase
    .from('nominations')
    .select('*, employees(name, department, job_title)')
    .order('created_at', { ascending: false });
  return (data || []).map(mapNomination);
}

export async function approveReviewer(nominationId, corrections = {}) {
  const { data: nom } = await supabase
    .from('nominations')
    .select('*')
    .eq('id', nominationId)
    .maybeSingle();
  if (!nom) return {};

  const updateData = {
    approval_status: 'approved',
    updated_at: nowIso(),
  };
  if (corrections.name)        updateData.name = corrections.name;
  if (corrections.role)        updateData.role = corrections.role;
  if (corrections.department)  updateData.department = corrections.department;
  if (corrections.designation) updateData.designation = corrections.designation;
  if (corrections.email)       updateData.email = corrections.email;
  if (corrections.phone)       updateData.phone = corrections.phone;

  await supabase.from('nominations').update(updateData).eq('id', nominationId);

  // Ensure reviewer user account exists
  const emailToUse = corrections.email || nom.email;
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .ilike('email', emailToUse)
    .maybeSingle();

  let tempPassword = null;
  if (!existingUser) {
    const userId = genId();
    tempPassword = (nom.name || 'reviewer').split(' ')[0].toLowerCase() + '@360';
    await supabase.from('users').insert({
      id: userId,
      role: 'reviewer',
      email: emailToUse,
      password: tempPassword,
      name: corrections.name || nom.name,
    });
    await supabase.from('reviewers').insert({
      id: genId(),
      user_id: userId,
      nomination_id: nominationId,
      employee_id: nom.employee_id,
      temp_password: tempPassword,
    });
  }
  return { tempPassword };
}

export async function rejectReviewer(nominationId, reason) {
  await supabase
    .from('nominations')
    .update({ approval_status: 'rejected', updated_at: nowIso() })
    .eq('id', nominationId);
}

export async function updateReviewer(nominationId, updates) {
  const row = {};
  if (updates.name)        row.name = updates.name;
  if (updates.role)        row.role = updates.role;
  if (updates.department)  row.department = updates.department;
  if (updates.designation) row.designation = updates.designation;
  if (updates.email)       row.email = updates.email;
  if (updates.phone)       row.phone = updates.phone;
  row.updated_at = nowIso();
  await supabase.from('nominations').update(row).eq('id', nominationId);
}

// ─── Admin: Activate / Deactivate reviewer ─────────────────────
// status: 'approved' = active, 'rejected' = deactivated
export async function setReviewerStatus(nominationId, status) {
  await supabase
    .from('nominations')
    .update({ approval_status: status, updated_at: nowIso() })
    .eq('id', nominationId);

  // Also sync user account status
  const { data: rev } = await supabase
    .from('reviewers')
    .select('user_id')
    .eq('nomination_id', nominationId)
    .maybeSingle();

  if (rev?.user_id) {
    const userStatus = status === 'approved' ? 'active' : 'inactive';
    await supabase
      .from('users')
      .update({ status: userStatus, updated_at: nowIso() })
      .eq('id', rev.user_id);
  }
}

export async function getReviewerByUserId(userId) {
  const { data: rev } = await supabase
    .from('reviewers')
    .select('*, nominations(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (!rev) return null;
  // IMPORTANT: spread mapNomination FIRST, then override id/userId/nominationId/employeeId
  // so that nomination.id never overwrites the reviewers.id used for FK on reviews table
  return {
    ...(rev.nominations ? mapNomination(rev.nominations) : {}),
    id: rev.id,                        // reviewers.id  — used as reviews.reviewer_id FK
    userId: rev.user_id,
    nominationId: rev.nomination_id,
    employeeId: rev.employee_id,       // reviewers.employee_id (authoritative)
  };
}

function mapNomination(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    forEmployeeId: row.employee_id,
    forEmployeeName: row.employees?.name || null,
    assignmentId: row.assignment_id,
    category: row.reviewer_type,
    name: row.name,
    role: row.role,
    department: row.department,
    designation: row.designation,
    email: row.email,
    phone: row.phone,
    status: row.approval_status,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Reviews ───────────────────────────────────────────────────
export async function getReview(reviewerId, employeeId) {
  // reviewerId here is the reviewers.id (not user id)
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewer_id', reviewerId)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    reviewerId: data.reviewer_id,
    employeeId: data.employee_id,
    sections: data.responses || {},
    assignmentRatings: data.assignment_ratings || {},
    status: data.status,
    submittedAt: data.submitted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getReviewsByReviewer(reviewerId) {
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewer_id', reviewerId);
  return (data || []).map(r => ({
    id: r.id,
    reviewerId: r.reviewer_id,
    employeeId: r.employee_id,
    sections: r.responses || {},
    assignmentRatings: r.assignment_ratings || {},
    status: r.status,
    submittedAt: r.submitted_at,
  }));
}

export async function getReviewsForEmployee(employeeId) {
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('employee_id', employeeId);
  return (data || []).map(r => ({
    id: r.id,
    reviewerId: r.reviewer_id,
    employeeId: r.employee_id,
    sections: r.responses || {},
    assignmentRatings: r.assignment_ratings || {},
    status: r.status,
    submittedAt: r.submitted_at,
  }));
}

export async function saveReviewProgress(reviewerId, employeeId, sectionId, ratings) {
  const existing = await getReview(reviewerId, employeeId);
  const sections = { ...(existing?.sections || {}), [sectionId]: ratings };
  if (existing) {
    const { error } = await supabase
      .from('reviews')
      .update({ responses: sections, updated_at: nowIso() })
      .eq('id', existing.id);
    if (error) { console.error('saveReviewProgress update error:', error); return { success: false, error: error.message }; }
  } else {
    const { error } = await supabase.from('reviews').insert({
      id: genId(),
      reviewer_id: reviewerId,
      employee_id: employeeId,
      responses: sections,
      assignment_ratings: {},
      status: 'in_progress',
    });
    if (error) { console.error('saveReviewProgress insert error:', error); return { success: false, error: error.message }; }
  }
  return { success: true };
}

export async function saveAssignmentReview(reviewerId, employeeId, assignmentRatings) {
  const existing = await getReview(reviewerId, employeeId);
  if (existing) {
    const { error } = await supabase
      .from('reviews')
      .update({ assignment_ratings: assignmentRatings, updated_at: nowIso() })
      .eq('id', existing.id);
    if (error) { console.error('saveAssignmentReview update error:', error); return { success: false, error: error.message }; }
  } else {
    const { error } = await supabase.from('reviews').insert({
      id: genId(),
      reviewer_id: reviewerId,
      employee_id: employeeId,
      responses: {},
      assignment_ratings: assignmentRatings,
      status: 'in_progress',
    });
    if (error) { console.error('saveAssignmentReview insert error:', error); return { success: false, error: error.message }; }
  }
  return { success: true };
}

export async function submitReview(reviewerId, employeeId) {
  await supabase
    .from('reviews')
    .update({ status: 'submitted', submitted_at: nowIso(), updated_at: nowIso() })
    .eq('reviewer_id', reviewerId)
    .eq('employee_id', employeeId);
}

// ─── Admin Progress ────────────────────────────────────────────
export async function getProgressSummary() {
  const [employees, assessments, assignments, nominations, reviewers, reviews] = await Promise.all([
    supabase.from('employees').select('*').order('created_at', { ascending: false }),
    supabase.from('assessments').select('*'),
    supabase.from('assignments').select('employee_id'),
    supabase.from('nominations').select('employee_id, approval_status'),
    supabase.from('reviewers').select('employee_id'),
    supabase.from('reviews').select('employee_id, status'),
  ]);

  const emps = (employees.data || []).map(mapEmployee);
  const assmnts = assessments.data || [];
  const asgns = assignments.data || [];
  const noms = nominations.data || [];
  const revs = reviewers.data || [];
  const rvws = reviews.data || [];

  return emps.map(emp => {
    const assessment = assmnts.find(a => a.employee_id === emp.id);
    const assignmentCount = asgns.filter(a => a.employee_id === emp.id).length;
    const empNoms = noms.filter(n => n.employee_id === emp.id);
    const approvedCount = empNoms.filter(n => n.approval_status === 'approved').length;
    const pendingCount  = empNoms.filter(n => n.approval_status === 'pending').length;
    const completedReviews = rvws.filter(r => r.employee_id === emp.id && r.status === 'submitted').length;

    const responses = assessment?.responses || {};
    const totalRated = Object.values(responses).reduce((s, sec) => s + Object.keys(sec).length, 0);

    return {
      employee: emp,
      selfAssessmentStatus: assessment?.status || 'not_started',
      selfAssessmentProgress: totalRated > 0 ? Math.min(Math.round((totalRated / 76) * 100), 100) : 0,
      assignmentCount,
      nominationsSubmitted: empNoms.length > 0,
      approvedReviewerCount: approvedCount,
      pendingReviewerCount: pendingCount,
      completedReviewCount: completedReviews,
    };
  });
}

// ─── Assessment Results (section-wise averages by reviewer type) ─
// Returns: { sections: [{id, title, selfAvg, sponsorAvg, peerAvg, teamAvg, overallAvg}] }
// selfAvg is from assessments.responses; others from reviews.responses grouped by nominations.reviewer_type
export async function getAssessmentResults(employeeId) {
  try {
    // Load template sections for this employee
    const templateSections = await getTemplateForEmployee({ id: employeeId });
    if (!templateSections || templateSections.length === 0) return null;

    // Load self-assessment
    const { data: selfData } = await supabase
      .from('assessments')
      .select('responses, status')
      .eq('employee_id', employeeId)
      .maybeSingle();

    // Load all submitted reviews for this employee (join reviewer → nomination for type)
    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('reviewer_id, responses, status')
      .eq('employee_id', employeeId)
      .eq('status', 'submitted');

    // Load reviewer records to map reviewer_id → nomination_id
    const { data: reviewerRows } = await supabase
      .from('reviewers')
      .select('id, nomination_id')
      .eq('employee_id', employeeId);

    // Load nominations to map nomination_id → reviewer_type
    const { data: nomRows } = await supabase
      .from('nominations')
      .select('id, reviewer_type')
      .eq('employee_id', employeeId);

    // Build: reviewerId → reviewerType
    const revTypeMap = {};
    for (const rev of (reviewerRows || [])) {
      const nom = (nomRows || []).find(n => n.id === rev.nomination_id);
      if (nom) revTypeMap[rev.id] = nom.reviewer_type; // 'peer' | 'sponsor' | 'team'
    }

    // Helper: compute average score for a section from a responses object
    // responses = { [sectionId]: { [stmtId]: value } }
    // Skips value === 0 (Not Observed) when averaging
    const sectionAvg = (responses, sectionId) => {
      const ratings = Object.values(responses?.[sectionId] || {}).filter(v => v > 0);
      if (ratings.length === 0) return null;
      return +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
    };

    // Build per-section results
    const sections = templateSections.map(sec => {
      const selfAvg = selfData?.status === 'submitted'
        ? sectionAvg(selfData.responses || {}, sec.id)
        : null;

      // Group reviewer responses by type
      const byType = { sponsor: [], peer: [], team: [] };
      for (const rv of (reviewRows || [])) {
        const type = revTypeMap[rv.reviewer_id];
        const avg = sectionAvg(rv.responses || {}, sec.id);
        if (avg !== null && type && byType[type] !== undefined) {
          byType[type].push(avg);
        }
      }

      const typeAvg = (arr) => arr.length > 0
        ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
        : null;

      const sponsorAvg = typeAvg(byType.sponsor);
      const peerAvg    = typeAvg(byType.peer);
      const teamAvg    = typeAvg(byType.team);

      // Overall: average of all non-null averages
      const allAvgs = [selfAvg, sponsorAvg, peerAvg, teamAvg].filter(v => v !== null);
      const overallAvg = allAvgs.length > 0
        ? +(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(2)
        : null;

      return { id: sec.id, title: sec.title, selfAvg, sponsorAvg, peerAvg, teamAvg, overallAvg };
    });

    return { sections, selfSubmitted: selfData?.status === 'submitted' };
  } catch (e) {
    console.error('getAssessmentResults error:', e);
    return null;
  }
}

// ─── Export ────────────────────────────────────────────────────
export async function getFullExportData() {
  const [employees, users, assessments, assignments, nominations, reviews, sections, statements] = await Promise.all([
    supabase.from('employees').select('*'),
    supabase.from('users').select('id, email, role, name, created_at'),
    supabase.from('assessments').select('*'),
    supabase.from('assignments').select('*'),
    supabase.from('nominations').select('*'),
    supabase.from('reviews').select('*'),
    supabase.from('template_sections').select('*'),
    supabase.from('template_statements').select('*'),
  ]);

  const templates = (sections.data || []).map(sec => ({
    id: sec.id,
    title: sec.name,
    description: sec.description,
    selfTip: sec.self_tip,
    reviewerTip: sec.reviewer_tip,
    statements: (statements.data || [])
      .filter(st => st.section_id === sec.id)
      .map(st => ({ id: st.id, text: st.text })),
  }));

  return {
    employees: (employees.data || []).map(mapEmployee),
    users: users.data || [],
    assessments: (assessments.data || []).map(a => ({
      id: a.id,
      employeeId: a.employee_id,
      sections: a.responses || {},
      status: a.status,
      submittedAt: a.submitted_at,
    })),
    assignmentRecords: (assignments.data || []).map(mapAssignment),
    nominations: nominations.data || [],
    reviews: (reviews.data || []).map(r => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      employeeId: r.employee_id,
      sections: r.responses || {},
      assignmentRatings: r.assignment_ratings || {},
      status: r.status,
      submittedAt: r.submitted_at,
    })),
    templates,
  };
}
