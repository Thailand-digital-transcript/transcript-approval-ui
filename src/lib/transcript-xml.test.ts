import { readFileSync } from 'node:fs';
import { parseTranscriptXml } from './transcript-xml';

const xml = readFileSync('src/test/fixtures/Transcript_v2.0.xml', 'utf8');

test('parses student, courses and gpa', () => {
  const t = parseTranscriptXml(xml);
  expect(t.context.transcriptId).toBe('90993829998');
  expect(t.student.givenName.en).toBe('Naksuksa');
  expect(t.organization.logoDataUrl).toMatch(/^data:image\/png;base64,/);
  expect(t.courses.length).toBeGreaterThanOrEqual(2);
  expect(t.courses[0].title.en).toBe('Basic Computer');
  expect(t.summaries[0].gpa).toBe('3.25');
});

test('does not crash on a ds:Signature block', () => {
  const signed = xml.replace('</tc:Transcript>',
    '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:Foo/></ds:Signature></tc:Transcript>');
  expect(() => parseTranscriptXml(signed)).not.toThrow();
});
