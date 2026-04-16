import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SECTIONS } from '../data/competencies';

const STORAGE_KEY = '360_assessment_db';

// ─── Seed data ────────────────────────────────────────────────
const seed = {
  users: [
    { id: 'admin_001', role: 'admin', email: 'admin@company.com', password: 'Admin@123', name: 'System Administrator' }
  ],
  employees: [],
  reviewers: [],         // pending/approved reviewer profiles
  assessments: [],       // self-assessments (sections of ratings)
  assignmentRecords: [], // employee assignments
  nominations: [],       // per-employee reviewer nominations
  reviews: [],           // reviewer assessments
  templates: [...DEFAULT_SECTIONS],  // Admin-editable sections/statements
  assessmentTemplates: [ // Different templates for different roles/levels
    { id: 'default', name: 'Standard Assessment', description: 'Default 360° assessment for all employees', sectionIds: DEFAULT_SECTIONS.map(s => s.id), isDefault: true }
  ],
};

// ─── Core persistence ─────────────────────────────────────────
export function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { saveDb(seed); return seed; }
    const parsed = JSON.parse(raw);
    // Ensure all keys exist
    return { ...seed, ...parsed };
  } catch { return seed; }
}

export function saveDb(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { console.error(e); }
}

function mutate(updater) {
  const db = loadDb();
  const next = updater(db);
  saveDb(next);
  return next;
}

// ─── Auth ──────────────────────────────────────────────────────
export function authenticate(email, password) {
  const db = loadDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  return user || null;
}

export function getUserById(id) {
  return loadDb().users.find(u => u.id === id) || null;
}

// ─── Forgot Password ──────────────────────────────────────────
export function requestPasswordReset(email) {
  // Returns { success, tempPassword, name } or { success: false, error }
  const db = loadDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { success: false, error: 'No account found with that email address.' };

  // Generate a simple temp password
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const tempPassword = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '@1';

  // Store reset record
  const resetRecord = {
    userId: user.id,
    email: user.email,
    name: user.name,
    tempPassword,
    requestedAt: new Date().toISOString(),
    used: false,
  };

  mutate(db => ({
    ...db,
    users: db.users.map(u => u.id === user.id ? { ...u, password: tempPassword, passwordReset: true } : u),
    passwordResets: [...(db.passwordResets || []), resetRecord],
  }));

  return { success: true, tempPassword, name: user.name, email: user.email };
}

export function changePassword(userId, newPassword) {
  mutate(db => ({
    ...db,
    users: db.users.map(u => u.id === userId ? { ...u, password: newPassword, passwordReset: false } : u),
  }));
}

// ─── Employee Registration ─────────────────────────────────────
export function registerEmployee(profile) {
  // Returns { success, error, user }
  const db = loadDb();
  if (db.users.find(u => u.email.toLowerCase() === profile.email.toLowerCase())) {
    return { success: false, error: 'Email already registered.' };
  }
  const userId = uuidv4();
  const empId  = uuidv4();
  const newUser = { id: userId, role: 'employee', email: profile.email, password: profile.password, name: profile.name, employeeId: empId };
  const newEmp  = { id: empId, userId, ...profile, createdAt: new Date().toISOString(), status: 'active' };
  mutate(db => ({ ...db, users: [...db.users, newUser], employees: [...db.employees, newEmp] }));
  return { success: true, user: newUser };
}

export function getEmployeeByUserId(userId) {
  return loadDb().employees.find(e => e.userId === userId) || null;
}

export function getEmployeeById(empId) {
  return loadDb().employees.find(e => e.id === empId) || null;
}

export function getAllEmployees() {
  return loadDb().employees;
}

export function updateEmployee(empId, updates) {
  mutate(db => ({ ...db, employees: db.employees.map(e => e.id === empId ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e) }));
}

export function updateEmployeeStatus(empId, status) {
  mutate(db => ({ ...db, employees: db.employees.map(e => e.id === empId ? { ...e, status, statusUpdatedAt: new Date().toISOString() } : e) }));
  // Also update linked user if suspending
  const db = loadDb();
  const emp = db.employees.find(e => e.id === empId);
  if (emp?.userId) {
    mutate(db => ({ ...db, users: db.users.map(u => u.id === emp.userId ? { ...u, status } : u) }));
  }
}

export function updateUserByEmployeeId(empId, updates) {
  const db = loadDb();
  const emp = db.employees.find(e => e.id === empId);
  if (!emp?.userId) return;
  mutate(db => ({ ...db, users: db.users.map(u => u.id === emp.userId ? { ...u, ...updates } : u) }));
}

// ─── Templates (Admin-editable) ────────────────────────────────
export function getTemplates() {
  return loadDb().templates;
}

export function saveTemplates(templates) {
  mutate(db => ({ ...db, templates }));
}

export function getAssessmentTemplates() {
  return loadDb().assessmentTemplates || [];
}

export function saveAssessmentTemplates(tpls) {
  mutate(db => ({ ...db, assessmentTemplates: tpls }));
}

export function getTemplateForEmployee(employee) {
  const db = loadDb();
  // Find template matching employee's level/role, fallback to default
  const tpls = db.assessmentTemplates || [];
  const match = tpls.find(t => !t.isDefault && (t.level === employee?.level || t.role === employee?.jobTitle));
  const tpl = match || tpls.find(t => t.isDefault) || tpls[0];
  if (!tpl) return db.templates;
  const sections = db.templates.filter(s => (tpl.sectionIds || []).includes(s.id));
  return sections.length ? sections : db.templates;
}

// ─── Self Assessment ───────────────────────────────────────────
export function getAssessment(employeeId) {
  return loadDb().assessments.find(a => a.employeeId === employeeId) || null;
}

export function saveAssessmentProgress(employeeId, sectionId, ratings) {
  mutate(db => {
    const idx = db.assessments.findIndex(a => a.employeeId === employeeId);
    if (idx >= 0) {
      const updated = db.assessments.map((a, i) => i === idx
        ? { ...a, sections: { ...a.sections, [sectionId]: ratings }, updatedAt: new Date().toISOString() }
        : a);
      return { ...db, assessments: updated };
    }
    return { ...db, assessments: [...db.assessments, { id: uuidv4(), employeeId, sections: { [sectionId]: ratings }, status: 'in_progress', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
  });
}

export function submitSelfAssessment(employeeId) {
  mutate(db => ({ ...db, assessments: db.assessments.map(a => a.employeeId === employeeId ? { ...a, status: 'submitted', submittedAt: new Date().toISOString() } : a) }));
}

// ─── Assignments ───────────────────────────────────────────────
export function getAssignmentsByEmployee(employeeId) {
  return loadDb().assignmentRecords.filter(a => a.employeeId === employeeId);
}

export function upsertAssignment(employeeId, assignment) {
  mutate(db => {
    const isNew = !db.assignmentRecords.find(a => a.id === assignment.id);
    if (isNew) {
      return { ...db, assignmentRecords: [...db.assignmentRecords, { ...assignment, id: assignment.id || uuidv4(), employeeId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
    }
    return { ...db, assignmentRecords: db.assignmentRecords.map(a => a.id === assignment.id ? { ...a, ...assignment, updatedAt: new Date().toISOString() } : a) };
  });
}

export function deleteAssignment(assignmentId) {
  mutate(db => ({ ...db, assignmentRecords: db.assignmentRecords.filter(a => a.id !== assignmentId) }));
}

// ─── Reviewer Nominations ──────────────────────────────────────
export function getNominations(employeeId) {
  return loadDb().nominations.find(n => n.employeeId === employeeId) || null;
}

export function saveNominationGroup(employeeId, assignmentId, category, people) {
  // people: array of { name, role, department, designation, email, phone }
  mutate(db => {
    const idx = db.nominations.findIndex(n => n.employeeId === employeeId);
    const existing = idx >= 0 ? db.nominations[idx] : { id: uuidv4(), employeeId, byAssignment: {}, createdAt: new Date().toISOString() };
    const updatedAssign = {
      ...existing.byAssignment,
      [assignmentId]: {
        ...(existing.byAssignment[assignmentId] || {}),
        [category]: people,
      }
    };
    const updated = { ...existing, byAssignment: updatedAssign, updatedAt: new Date().toISOString() };
    const newList = idx >= 0 ? db.nominations.map((n, i) => i === idx ? updated : n) : [...db.nominations, updated];
    return { ...db, nominations: newList };
  });
}

export function submitNominations(employeeId) {
  // Create pending reviewer profiles for all nominated people
  const db = loadDb();
  const nominations = db.nominations.find(n => n.employeeId === employeeId);
  if (!nominations) return;
  const employee = db.employees.find(e => e.id === employeeId);
  const allReviewers = [];

  Object.entries(nominations.byAssignment || {}).forEach(([assignId, cats]) => {
    Object.entries(cats).forEach(([category, people]) => {
      (people || []).forEach(person => {
        if (!person.email) return;
        const exists = db.reviewers.find(r => r.email.toLowerCase() === person.email.toLowerCase() && r.forEmployeeId === employeeId);
        if (!exists) {
          allReviewers.push({
            id: uuidv4(),
            ...person,
            forEmployeeId: employeeId,
            forEmployeeName: employee?.name,
            assignmentId: assignId,
            category,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
        }
      });
    });
  });

  mutate(db => ({
    ...db,
    reviewers: [...db.reviewers, ...allReviewers],
    nominations: db.nominations.map(n => n.employeeId === employeeId ? { ...n, submitted: true, submittedAt: new Date().toISOString() } : n)
  }));
}

// ─── Reviewer Profiles (Admin) ─────────────────────────────────
export function getPendingReviewers() {
  return loadDb().reviewers.filter(r => r.status === 'pending');
}

export function getAllReviewers() {
  return loadDb().reviewers;
}

export function approveReviewer(reviewerId, corrections = {}) {
  const db = loadDb();
  const reviewer = db.reviewers.find(r => r.id === reviewerId);
  if (!reviewer) return;

  // Check if user already exists (same email)
  const existingUser = db.users.find(u => u.email.toLowerCase() === reviewer.email.toLowerCase());
  const userId = existingUser ? existingUser.id : uuidv4();
  const tempPassword = reviewer.name.split(' ')[0].toLowerCase() + '@360';

  const updatedReviewer = { ...reviewer, ...corrections, status: 'approved', userId, approvedAt: new Date().toISOString() };

  let newUsers = db.users;
  if (!existingUser) {
    newUsers = [...db.users, { id: userId, role: 'reviewer', email: reviewer.email, password: tempPassword, name: reviewer.name, reviewerId }];
  }

  mutate(db => ({ ...db, reviewers: db.reviewers.map(r => r.id === reviewerId ? updatedReviewer : r), users: newUsers }));
  return { tempPassword: existingUser ? null : tempPassword };
}

export function rejectReviewer(reviewerId, reason) {
  mutate(db => ({ ...db, reviewers: db.reviewers.map(r => r.id === reviewerId ? { ...r, status: 'rejected', rejectedAt: new Date().toISOString(), rejectionReason: reason } : r) }));
}

export function updateReviewer(reviewerId, updates) {
  mutate(db => ({ ...db, reviewers: db.reviewers.map(r => r.id === reviewerId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r) }));
}

export function getReviewerByUserId(userId) {
  return loadDb().reviewers.find(r => r.userId === userId) || null;
}

// ─── Reviews (reviewer assessments) ───────────────────────────
export function getReviewsByReviewer(reviewerId) {
  return loadDb().reviews.filter(r => r.reviewerId === reviewerId);
}

export function getReviewsForEmployee(employeeId) {
  return loadDb().reviews.filter(r => r.employeeId === employeeId);
}

export function getReview(reviewerId, employeeId) {
  return loadDb().reviews.find(r => r.reviewerId === reviewerId && r.employeeId === employeeId) || null;
}

export function saveReviewProgress(reviewerId, employeeId, sectionId, ratings) {
  mutate(db => {
    const idx = db.reviews.findIndex(r => r.reviewerId === reviewerId && r.employeeId === employeeId);
    if (idx >= 0) {
      return { ...db, reviews: db.reviews.map((r, i) => i === idx ? { ...r, sections: { ...r.sections, [sectionId]: ratings }, updatedAt: new Date().toISOString() } : r) };
    }
    return { ...db, reviews: [...db.reviews, { id: uuidv4(), reviewerId, employeeId, sections: { [sectionId]: ratings }, status: 'in_progress', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
  });
}

export function saveAssignmentReview(reviewerId, employeeId, assignmentRatings) {
  mutate(db => {
    const idx = db.reviews.findIndex(r => r.reviewerId === reviewerId && r.employeeId === employeeId);
    if (idx >= 0) {
      return { ...db, reviews: db.reviews.map((r, i) => i === idx ? { ...r, assignmentRatings, updatedAt: new Date().toISOString() } : r) };
    }
    return { ...db, reviews: [...db.reviews, { id: uuidv4(), reviewerId, employeeId, sections: {}, assignmentRatings, status: 'in_progress', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
  });
}

export function submitReview(reviewerId, employeeId) {
  mutate(db => ({ ...db, reviews: db.reviews.map(r => r.reviewerId === reviewerId && r.employeeId === employeeId ? { ...r, status: 'submitted', submittedAt: new Date().toISOString() } : r) }));
}

// ─── Admin Progress ────────────────────────────────────────────
export function getProgressSummary() {
  const db = loadDb();
  return db.employees.map(emp => {
    const assessment = db.assessments.find(a => a.employeeId === emp.id);
    const assignments = db.assignmentRecords.filter(a => a.employeeId === emp.id);
    const nominations = db.nominations.find(n => n.employeeId === emp.id);
    const approvedReviewers = db.reviewers.filter(r => r.forEmployeeId === emp.id && r.status === 'approved');
    const pendingReviewers = db.reviewers.filter(r => r.forEmployeeId === emp.id && r.status === 'pending');
    const completedReviews = db.reviews.filter(r => r.employeeId === emp.id && r.status === 'submitted');
    const templates = db.templates;
    const totalStatements = templates.reduce((sum, s) => sum + s.statements.length, 0);
    const ratedStatements = assessment ? Object.values(assessment.sections || {}).reduce((sum, sec) => sum + Object.keys(sec).length, 0) : 0;

    return {
      employee: emp,
      selfAssessmentStatus: assessment?.status || 'not_started',
      selfAssessmentProgress: totalStatements > 0 ? Math.round((ratedStatements / totalStatements) * 100) : 0,
      assignmentCount: assignments.length,
      nominationsSubmitted: nominations?.submitted || false,
      approvedReviewerCount: approvedReviewers.length,
      pendingReviewerCount: pendingReviewers.length,
      completedReviewCount: completedReviews.length,
    };
  });
}

// ─── Export ────────────────────────────────────────────────────
export function getFullExportData() {
  return loadDb();
}
