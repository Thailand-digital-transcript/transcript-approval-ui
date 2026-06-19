import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { TranscriptView } from './TranscriptView';
import { parseTranscriptXml } from '@/lib/transcript-xml';

const xml = readFileSync('src/test/fixtures/Transcript_v2.0.xml', 'utf8');

test('renders parsed transcript: student EN name, a course title, and a GPA', () => {
  const t = parseTranscriptXml(xml);
  render(<TranscriptView transcript={t} />);

  // Student EN name (prefix + given + family) — combined as "Mr. Naksuksa Mahavittayalai"
  // by the component's bilingual name joiner. Asserting the two EN name parts
  // is enough to prove the bilingual resolver reached the right column.
  expect(screen.getByText(/Naksuksa/)).toBeInTheDocument();
  expect(screen.getByText(/Mahavittayalai/)).toBeInTheDocument();

  // A course title (EN) from the fixture
  expect(screen.getByText(/Basic Computer/)).toBeInTheDocument();

  // GPA value from the SemesterSummary. The fixture has 3.25 for both
  // SemesterGPA and SemesterGPAX, so we accept either or both (>=1).
  expect(screen.getAllByText(/3\.25/).length).toBeGreaterThanOrEqual(1);
});

test('renders the invalid-XML fallback with a download link when xml prop is malformed', () => {
  render(<TranscriptView xml={'<<not valid xml'} />);

  expect(screen.getByText(/Unable to render/)).toBeInTheDocument();
  // The "Download raw XML" anchor must be present and target a blob URL
  const link = screen.getByRole('link', { name: /Download raw XML/i });
  expect(link).toBeInTheDocument();
  expect(link.getAttribute('href') ?? '').toMatch(/^blob:/);
  expect(link.getAttribute('download')).toBeTruthy();
});
