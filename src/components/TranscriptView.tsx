import { useEffect, useMemo, useState } from 'react';
import type { Bilingual, SemesterSummary, Transcript, TranscriptCourse } from '@/types/transcript';
import { parseTranscriptXml } from '@/lib/transcript-xml';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface TranscriptViewProps {
  /** Pre-parsed transcript; takes precedence when both `transcript` and `xml` are supplied. */
  transcript?: Transcript;
  /** Raw ETDA XML; parsed internally. If parsing fails, the component renders the fallback. */
  xml?: string;
  /** Optional className for the root container. */
  className?: string;
}

/**
 * Render a parsed ETDA `Transcript` (or one parsed from an `xml` string) with
 * a header (bilingual student name + program/faculty), an inline org logo,
 * courses grouped by `(year, semesterName)` into shadcn `Table`s, and a
 * semester GPA panel. On parse failure (invalid XML) it renders a fallback
 * with a "Download raw XML" link backed by a `URL.createObjectURL` blob.
 */
export function TranscriptView({ transcript, xml, className }: TranscriptViewProps) {
  // If both `transcript` and `xml` are passed, `transcript` wins (the parsed
  // object is the source of truth; we do not silently reparse over it).
  const effective = transcript;

  let parsed: Transcript | null = effective ?? null;
  let parseError: Error | null = null;
  if (!effective && xml !== undefined) {
    try {
      parsed = parseTranscriptXml(xml);
    } catch (err) {
      parseError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (parseError || (xml !== undefined && !parsed)) {
    return <InvalidXmlFallback xml={xml ?? ''} className={className} />;
  }

  if (!parsed) {
    return <InvalidXmlFallback xml={xml ?? ''} className={className} />;
  }

  return <TranscriptBody t={parsed} className={className} />;
}

function TranscriptBody({ t, className }: { t: Transcript; className?: string }) {
  const groups = useMemo(() => groupCoursesBySemester(t.courses), [t.courses]);

  return (
    <div className={className} data-slot="transcript-view" data-testid="transcript-view">
      <TranscriptHeader t={t} />

      {t.organization.logoDataUrl ? (
        <div className="flex items-center justify-center py-2">
          <img
            src={t.organization.logoDataUrl}
            alt={t.organization.name ? `${t.organization.name} logo` : 'Organization logo'}
            className="max-h-24 object-contain"
          />
        </div>
      ) : null}

      <TranscriptCourses groups={groups} />

      <TranscriptGpaPanel summaries={t.summaries} />
    </div>
  );
}

function TranscriptHeader({ t }: { t: Transcript }) {
  const fullNameEn = joinBilingual('en', t.student.namePrefix, t.student.givenName, t.student.familyName);
  const fullNameTh = joinBilingual('th', t.student.namePrefix, t.student.givenName, t.student.familyName);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>{fullNameTh || fullNameEn || 'Student'}</span>
          {fullNameEn && fullNameEn !== fullNameTh ? (
            <span className="text-sm font-normal text-muted-foreground">({fullNameEn})</span>
          ) : null}
          {t.student.studentId ? (
            <Badge variant="outline" className="ml-auto">ID: {t.student.studentId}</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
        {t.organization.name ? <Field label="Organization" value={t.organization.name} /> : null}
        {t.student.faculty ? <Field label="Faculty" value={t.student.faculty} /> : null}
        {t.student.program.name ? <Field label="Program" value={t.student.program.name} /> : null}
        {t.student.program.major ? <Field label="Major" value={t.student.program.major} /> : null}
        {t.student.program.degree ? <Field label="Degree" value={t.student.program.degree} /> : null}
        {t.context.transcriptId ? <Field label="Transcript ID" value={t.context.transcriptId} /> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function joinBilingual(lang: 'th' | 'en', ...parts: (Bilingual | undefined)[]): string {
  // Render the requested language column; fall back to the other language
  // when the requested one is missing (so a partially-translated transcript
  // still surfaces every available name fragment).
  return parts
    .map((p) => p?.[lang] || (lang === 'th' ? p?.en : p?.th) || '')
    .filter((s) => s.length > 0)
    .join(' ');
}

function groupCoursesBySemester(courses: TranscriptCourse[]): Array<{
  key: string;
  year: string;
  semesterName: string;
  courses: TranscriptCourse[];
}> {
  const map = new Map<string, { year: string; semesterName: string; courses: TranscriptCourse[] }>();
  for (const c of courses) {
    const year = c.year ?? '';
    const semesterName = c.semesterName ?? '';
    const key = `${year}::${semesterName}`;
    const entry = map.get(key) ?? { year, semesterName, courses: [] };
    entry.courses.push(c);
    map.set(key, entry);
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}

function TranscriptCourses({ groups }: {
  groups: Array<{ key: string; year: string; semesterName: string; courses: TranscriptCourse[] }>;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const heading = [g.semesterName, g.year].filter(Boolean).join(' ');
        return (
          <Card key={g.key}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {heading || 'Semester'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead className="text-right">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.courses.map((c) => {
                    const title = c.title.th || c.title.en || c.courseNumber;
                    const titleEn = c.title.en && c.title.en !== c.title.th ? c.title.en : null;
                    return (
                      <TableRow key={`${g.key}-${c.courseNumber}`}>
                        <TableCell className="font-mono text-xs">{c.courseNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{title}</div>
                          {titleEn ? (
                            <div className="text-xs text-muted-foreground">{titleEn}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.creditValue ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.creditEarned ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.academicGradeText ?? c.academicGrade ?? '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TranscriptGpaPanel({ summaries }: { summaries: SemesterSummary[] }) {
  if (!summaries.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">GPA summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semester</TableHead>
              <TableHead>Year</TableHead>
              <TableHead className="text-right">Credits Earned</TableHead>
              <TableHead className="text-right">GPA</TableHead>
              <TableHead className="text-right">GPAX</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((s, i) => (
              <TableRow key={i}>
                <TableCell>{s.semesterName ?? '—'}</TableCell>
                <TableCell>{s.year ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{s.creditEarned ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{s.gpa ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{s.gpax ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          GPA and GPAX are reported by the issuing institution; this view does not recompute them.
        </p>
      </CardContent>
    </Card>
  );
}

function InvalidXmlFallback({ xml, className }: { xml: string; className?: string }) {
  // Build a blob URL for the raw XML so the user can save the file the
  // parser refused. The URL is created in a lazy state initializer (so we
  // don't trigger a cascading render after mount) and revoked in a cleanup
  // effect tied to the current `href`. This deliberately does not re-create
  // the URL when `xml` changes mid-mount: the invalid-XML fallback is a
  // terminal state, and the parent should remount this component with a
  // fresh `key` if the underlying XML is replaced.
  const [href] = useState<string>(() =>
    xml ? URL.createObjectURL(new Blob([xml], { type: 'application/xml' })) : '',
  );
  useEffect(() => () => {
    if (href) URL.revokeObjectURL(href);
  }, [href]);

  return (
    <div
      data-slot="transcript-view-fallback"
      data-testid="transcript-view-fallback"
      role="alert"
      className={cnFallback(className)}
    >
      <p className="font-medium">Unable to render transcript</p>
      <p className="text-sm text-muted-foreground">
        The XML could not be parsed. Download the raw file below to inspect or share it with support.
      </p>
      {href ? (
        <a
          href={href}
          download="transcript.xml"
          className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Download raw XML
        </a>
      ) : null}
    </div>
  );
}

function cnFallback(className?: string) {
  return `rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive ${className ?? ''}`.trim();
}
