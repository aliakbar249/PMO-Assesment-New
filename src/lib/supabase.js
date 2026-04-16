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
  for (let si = 0; si < templates.length; si++) {
    const sec = templates[si];
    // Upsert section
    await supabase.from('template_sections').upsert({
      id: sec.id,
      name: sec.title,
      description: sec.description || null,
      self_tip: sec.selfTip || null,
      reviewer_tip: sec.reviewerTip || null,
      order_index: si,
      active: true,
    });
    // Upsert statements
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
  // For now: return all sections (future: filter by template assignment)
  return getTemplates();
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
  const row = {
    employee_id: employeeId,
    slot_number: assignment.slotNumber || 1,
    title: assignment.title || null,
    type: assignment.type || null,
    sector: assignment.sector || null,
    client_org: assignment.clientOrg || null,
    role: assignment.role || null,
    start_date: assignment.startDate || null,
    end_date: assignment.endDate || null,
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
    // Check if it's a real UUID (Supabase row)
    const { data: existing } = await supabase
      .from('assignments')
      .select('id')
      .eq('id', assignment.id)
      .maybeSingle();
    if (existing) {
      await supabase.from('assignments').update(row).eq('id', assignment.id);
      return;
    }
  }
  // Insert new
  await supabase.from('assignments').insert({ id: genId(), ...row });
}

export async function deleteAssignment(assignmentId) {
  await supabase.from('assignments').delete().eq('id', assignmentId);
}

function mapAssignment(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    slotNumber: row.slot_number,
    title: row.title,
    type: row.type,
    sector: row.sector,
    clientOrg: row.client_org,
    role: row.role,
    startDate: row.start_date,
    endDate: row.end_date,
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

export async function getReviewerByUserId(userId) {
  const { data: rev } = await supabase
    .from('reviewers')
    .select('*, nominations(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (!rev) return null;
  return {
    id: rev.id,
    userId: rev.user_id,
    nominationId: rev.nomination_id,
    employeeId: rev.employee_id,
    ...(rev.nominations ? mapNomination(rev.nominations) : {}),
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
    await supabase
      .from('reviews')
      .update({ responses: sections, updated_at: nowIso() })
      .eq('id', existing.id);
  } else {
    await supabase.from('reviews').insert({
      id: genId(),
      reviewer_id: reviewerId,
      employee_id: employeeId,
      responses: sections,
      assignment_ratings: {},
      status: 'in_progress',
    });
  }
}

export async function saveAssignmentReview(reviewerId, employeeId, assignmentRatings) {
  const existing = await getReview(reviewerId, employeeId);
  if (existing) {
    await supabase
      .from('reviews')
      .update({ assignment_ratings: assignmentRatings, updated_at: nowIso() })
      .eq('id', existing.id);
  } else {
    await supabase.from('reviews').insert({
      id: genId(),
      reviewer_id: reviewerId,
      employee_id: employeeId,
      responses: {},
      assignment_ratings: assignmentRatings,
      status: 'in_progress',
    });
  }
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
