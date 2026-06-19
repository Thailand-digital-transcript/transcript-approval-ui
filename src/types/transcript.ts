export interface Bilingual { th?: string; en?: string; }
export interface TranscriptCourse {
  courseNumber: string; title: Bilingual; creditValue?: string; creditEarned?: string;
  academicGrade?: string; academicGradeText?: string; semesterName?: string; year?: string;
}
export interface SemesterSummary {
  semesterName?: string; year?: string; creditEarned?: string; gpa?: string; gpax?: string;
}
export interface Transcript {
  context: { transcriptId?: string; name?: string; typeCode?: string; issueDateTime?: string; status?: string; };
  student: {
    studentId?: string; nationalId?: string; namePrefix: Bilingual; givenName: Bilingual;
    familyName: Bilingual; faculty?: string;
    program: { id?: string; name?: string; major?: string; minor?: string; degree?: string; };
  };
  organization: { name?: string; schoolLevel?: string; logoDataUrl?: string; registrarName?: string; };
  courses: TranscriptCourse[];
  summaries: SemesterSummary[];
}
