import type { Transcript, Bilingual } from '../types/transcript';

const TC = 'urn:etda:teda:documentation:Transcript:1';

function text(el: Element | null | undefined): string | undefined {
  return el?.textContent?.trim() || undefined;
}
function byLang(parent: Element, local: string): Bilingual {
  const out: Bilingual = {};
  parent.querySelectorAll(`*|${local}`).forEach((n) => {
    if (n.namespaceURI !== TC || (n.parentNode as Element) !== parent) return;
    const lang = (n.getAttribute('languageID') || '').toLowerCase();
    if (lang.startsWith('en')) out.en = n.textContent?.trim();
    else out.th = n.textContent?.trim();
  });
  return out;
}
function first(parent: ParentNode, local: string): Element | null {
  return Array.from(parent.querySelectorAll(`*|${local}`)).find(
    (e) => (e as Element).namespaceURI === TC) as Element ?? null;
}

export function parseTranscriptXml(xml: string): Transcript {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('invalid transcript XML');

  const ctx = first(doc, 'TranscriptContext');
  const stu = first(doc, 'Student');
  // A document can parse cleanly yet still lack the Student element; fail
  // explicitly here (caught by TranscriptView's fallback) rather than NPE
  // on a downstream byLang(stu, …) dereference.
  if (!stu) throw new Error('transcript XML has no Student element');
  const org = first(doc, 'Organization');
  const prog = first(stu, 'ProgramContext');

  const ids = stu ? Array.from(stu.children).filter(
    (c) => c.namespaceURI === TC && c.localName === 'DataSubjectID') as Element[] : [];
  const idBy = (scheme: string) => ids.find((e) => e.getAttribute('schemeID') === scheme)?.textContent?.trim();

  const logo = org ? text(first(org, 'Logo')) : undefined;

  const courses = Array.from(doc.getElementsByTagNameNS(TC, 'Course')).map((c) => ({
    courseNumber: text(first(c, 'CourseNumber')) ?? '',
    title: byLang(c, 'CourseTitle'),
    creditValue: text(first(c, 'CourseCreditValue')),
    creditEarned: text(first(c, 'CourseCreditEarned')),
    academicGrade: text(first(c, 'CourseAcademicGrade')),
    academicGradeText: text(first(c, 'CourseAcademicGradeText')),
    semesterName: text(first(c, 'SemesterName')),
    year: text(first(c, 'Year')),
  }));

  const summaries = Array.from(doc.getElementsByTagNameNS(TC, 'SemesterSummary')).map((s) => ({
    semesterName: text(first(s, 'SemesterName')),
    year: text(first(s, 'Year')),
    creditEarned: text(first(s, 'SemesterCreditEarned')),
    gpa: text(first(s, 'SemesterGPA')),
    gpax: text(first(s, 'SemesterGPAX')),
  }));

  return {
    context: {
      transcriptId: ctx ? text(first(ctx, 'TranscriptID')) : undefined,
      name: ctx ? text(first(ctx, 'Name')) : undefined,
      typeCode: ctx ? text(first(ctx, 'TypeCode')) : undefined,
      issueDateTime: ctx ? text(first(ctx, 'IssueDateTime')) : undefined,
      status: ctx ? text(first(ctx, 'Status')) : undefined,
    },
    student: {
      studentId: idBy('StudenID'), nationalId: idBy('NIDN'),
      namePrefix: byLang(stu, 'NamePrefix'), givenName: byLang(stu, 'GivenName'),
      familyName: byLang(stu, 'FamilyName'), faculty: text(first(stu, 'FacultyName')),
      program: {
        id: prog ? text(first(prog, 'ProgramID')) : undefined,
        name: prog ? text(first(prog, 'ProgramName')) : undefined,
        major: prog ? text(first(prog, 'Major')) : undefined,
        minor: prog ? text(first(prog, 'Minor')) : undefined,
        degree: prog ? text(first(prog, 'Degree')) : undefined,
      },
    },
    organization: {
      name: org ? text(first(org, 'OrganizationName')) : undefined,
      schoolLevel: org ? text(first(org, 'SchoolLevel')) : undefined,
      logoDataUrl: logo ? `data:image/png;base64,${logo}` : undefined,
      registrarName: org ? text(first(first(org, 'Registrar') ?? org, 'Name')) : undefined,
    },
    courses,
    summaries,
  };
}
