import { useState } from 'react';
import { getFullExportData } from '../lib/supabase';
import { Button, Card, Badge, Alert, PageHeader } from '../components/UI';
import { Download, FileText, Users, ClipboardList, Briefcase, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

function flattenRatings(sections) {
  const out = {};
  if (!sections) return out;
  Object.entries(sections).forEach(([secId, stmts]) => {
    Object.entries(stmts).forEach(([stmtId, val]) => {
      out[`${secId}__${stmtId}`] = val;
    });
  });
  return out;
}

function ratingLabel(val) {
  const map = { 5: 'Always', 4: 'Often', 3: 'Sometimes', 2: 'Seldom', 1: 'Never', 0: 'Not Observed' };
  return val !== undefined && val !== null ? map[val] ?? val : '';
}

export default function AdminExport() {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState('');

  const doExport = async (type) => {
    setExporting(true);
    try {
        const db = await getFullExportData();
        const wb = XLSX.utils.book_new();

        // ── Sheet 1: Employees ──────────────────────────────────
        const empRows = db.employees.map(e => ({
          'Employee ID': e.id,
          'Name': e.name,
          'Email': e.email,
          'Employee Code': e.employeeCode || '',
          'Job Title': e.jobTitle || '',
          'Department': e.department || '',
          'Level': e.level || '',
          'Organization': e.organization || '',
          'Phone': e.phone || '',
          'Reports To': e.reportsTo || '',
          'Location': e.location || '',
          'Registered': e.createdAt?.substring(0, 10) || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows.length ? empRows : [{ Note: 'No employees yet' }]), 'Employees');

        // ── Sheet 2: Self Assessments ───────────────────────────
        const templates = db.templates || [];
        const allStmts = templates.flatMap(sec => sec.statements.map(st => ({ secId: sec.id, secTitle: sec.title, stmtId: st.id, stmtText: st.text })));

        const selfRows = db.assessments.map(a => {
          const emp = db.employees.find(e => e.id === a.employeeId);
          const base = {
            'Employee ID': a.employeeId,
            'Employee Name': emp?.name || '',
            'Status': a.status,
            'Submitted At': a.submittedAt?.substring(0, 10) || '',
          };
          allStmts.forEach(s => {
            const val = a.sections?.[s.secId]?.[s.stmtId];
            base[`[${s.secTitle}] ${s.stmtText}`] = ratingLabel(val);
          });
          return base;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(selfRows.length ? selfRows : [{ Note: 'No assessments yet' }]), 'Self Assessments');

        // ── Sheet 3: Reviewer Assessments ──────────────────────
        const revRows = db.reviews.map(r => {
          const rev = db.reviewers.find(rv => rv.id === r.reviewerId);
          const emp = db.employees.find(e => e.id === r.employeeId);
          const base = {
            'Reviewer ID': r.reviewerId,
            'Reviewer Name': rev?.name || '',
            'Reviewer Email': rev?.email || '',
            'Reviewer Category': rev?.category || '',
            'Employee ID': r.employeeId,
            'Employee Name': emp?.name || '',
            'Status': r.status,
            'Submitted At': r.submittedAt?.substring(0, 10) || '',
          };
          allStmts.forEach(s => {
            const val = r.sections?.[s.secId]?.[s.stmtId];
            base[`[${s.secTitle}] ${s.stmtText}`] = ratingLabel(val);
          });
          return base;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revRows.length ? revRows : [{ Note: 'No reviewer assessments yet' }]), 'Reviewer Assessments');

        // ── Sheet 4: Assignments ────────────────────────────────
        const assignRows = db.assignmentRecords.map(a => {
          const emp = db.employees.find(e => e.id === a.employeeId);
          return {
            'Employee Name': emp?.name || '',
            'Assignment Title': a.title,
            'Type': a.type,
            'Sector': a.sector,
            'Organization': a.organization,
            'Role': a.role,
            'Start Date': a.startDate,
            'End Date': a.endDate || 'Ongoing',
            'Status': a.status,
            'Budget Range': a.budgetRange,
            'Team Size': a.teamSize,
            'Location': a.location,
            'Description': a.description,
            'Key Outcomes': a.keyOutcomes,
            'Challenges': a.challenges,
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignRows.length ? assignRows : [{ Note: 'No assignments yet' }]), 'Assignments');

        // ── Sheet 5: Assignment Ratings ─────────────────────────
        const ASSIGN_QUESTIONS = [
          'Demonstrated strong project leadership',
          'Communicated effectively with stakeholders',
          'Managed risks and problems proactively',
          'Delivered assignment objectives successfully',
          'Showed strategic thinking',
          'Built strong team collaboration',
          'Adapted effectively to changes',
          'Demonstrated accountability',
        ];
        const assignRatingRows = [];
        db.reviews.forEach(r => {
          const rev = db.reviewers.find(rv => rv.id === r.reviewerId);
          const emp = db.employees.find(e => e.id === r.employeeId);
          if (!r.assignmentRatings) return;
          Object.entries(r.assignmentRatings).forEach(([assignId, qs]) => {
            const assign = db.assignmentRecords.find(a => a.id === assignId);
            const row = {
              'Reviewer Name': rev?.name || '',
              'Reviewer Category': rev?.category || '',
              'Employee Name': emp?.name || '',
              'Assignment Title': assign?.title || assignId,
            };
            Object.entries(qs).forEach(([qId, val], i) => {
              row[ASSIGN_QUESTIONS[i] || qId] = ratingLabel(val);
            });
            assignRatingRows.push(row);
          });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignRatingRows.length ? assignRatingRows : [{ Note: 'No assignment ratings yet' }]), 'Assignment Ratings');

        // ── Sheet 6: Reviewer Profiles ──────────────────────────
        const revProfileRows = db.reviewers.map(r => ({
          'Name': r.name,
          'Email': r.email,
          'Designation': r.designation,
          'Department': r.department,
          'Phone': r.phone,
          'Role on Assignment': r.role,
          'Category': r.category,
          'For Employee': r.forEmployeeName,
          'Status': r.status,
          'Approved At': r.approvedAt?.substring(0, 10) || '',
          'Rejected At': r.rejectedAt?.substring(0, 10) || '',
          'Rejection Reason': r.rejectionReason || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revProfileRows.length ? revProfileRows : [{ Note: 'No reviewers yet' }]), 'Reviewer Profiles');

        // ── Write file ──────────────────────────────────────────
        const ext = type === 'csv' ? 'csv' : 'xlsx';
        const filename = `360_assessment_export_${new Date().toISOString().substring(0, 10)}.${ext}`;
        if (type === 'csv') {
          // Export first meaningful sheet as CSV
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets['Self Assessments']);
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        } else {
          XLSX.writeFile(wb, filename);
        }
        setDone(`Exported successfully as ${filename}`);
        setTimeout(() => setDone(''), 5000);
      } catch (err) {
        console.error(err);
        setDone('Export failed. Check console for details.');
      }
      setExporting(false);
  };

  return (
    <div>
      <PageHeader title="Export Data" subtitle="Download complete assessment data in Excel or CSV format." />

      {done && <Alert type={done.includes('failed') ? 'error' : 'success'} className="mb-4"><div className="flex items-center gap-2"><CheckCircle size={14} />{done}</div></Alert>}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center"><FileText size={22} className="text-green-600" /></div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Excel Export (.xlsx)</h3>
              <p className="text-xs text-gray-500">All data in one workbook with multiple sheets</p>
            </div>
          </div>
          <div className="space-y-1.5 mb-4">
            {[
              ['Employees', Users], ['Self Assessments', ClipboardList], ['Reviewer Assessments', ClipboardList],
              ['Assignments', Briefcase], ['Assignment Ratings', ClipboardList], ['Reviewer Profiles', Users],
            ].map(([label, Icon]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600">
                <Icon size={12} className="text-gray-400" />{label}
              </div>
            ))}
          </div>
          <Button onClick={() => doExport('xlsx')} disabled={exporting} className="w-full">
            <Download size={15} />{exporting ? 'Exporting…' : 'Export as Excel (.xlsx)'}
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center"><FileText size={22} className="text-blue-600" /></div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">CSV Export (.csv)</h3>
              <p className="text-xs text-gray-500">Self-assessment data in flat CSV format</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">Exports the Self Assessments sheet as a CSV file, suitable for importing into analytics tools or spreadsheet software.</p>
          <Button variant="secondary" onClick={() => doExport('csv')} disabled={exporting} className="w-full">
            <Download size={15} />{exporting ? 'Exporting…' : 'Export as CSV (.csv)'}
          </Button>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Export includes:</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            'All registered employee profiles and professional details',
            'Complete self-assessment ratings with statement text (Always/Often/Sometimes/Seldom/Never)',
            'All reviewer assessment ratings with reviewer category (Sponsor/Supervisor/Peer/Client/Team Member)',
            'Assignment details (title, type, sector, role, outcomes, challenges)',
            'Assignment-specific ratings from reviewers (8 dimensions)',
            'Reviewer profile status (pending/approved/rejected) and contact details',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <CheckCircle size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />{item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
