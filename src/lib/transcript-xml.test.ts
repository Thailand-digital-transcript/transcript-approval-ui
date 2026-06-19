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

test('ignores a realistic registrar ds:Signature block and still parses transcript fields', () => {
  // At the dean gate the sealed XML already carries a registrar XML-DSig
  // signature with real children (SignedInfo, X509Certificate, base64 blobs).
  // The parser must ignore that foreign-namespace subtree, not crash on it or
  // leak its content (e.g. a base64 cert) into student names / courses.
  const signature =
    '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="registrar-sig">' +
    '<ds:SignedInfo>' +
    '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>' +
    '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>' +
    '<ds:Reference URI=""><ds:DigestValue>aGVsbG8gd29ybGQ=</ds:DigestValue></ds:Reference>' +
    '</ds:SignedInfo>' +
    '<ds:SignatureValue>Zm9vYmFyc2lnbmF0dXJlYmFzZTY0</ds:SignatureValue>' +
    '<ds:KeyInfo><ds:X509Data>' +
    '<ds:X509Certificate>MIID0jCCArqgAwIBAgIBADANBgkqhkiG9w0BAQ</ds:X509Certificate>' +
    '</ds:X509Data></ds:KeyInfo></ds:Signature>';
  const signed = xml.replace('</tc:Transcript>', signature + '</tc:Transcript>');

  const t = parseTranscriptXml(signed);
  // Parses without throwing AND the signature did not corrupt the data.
  expect(t.student.givenName.en).toBe('Naksuksa');
  expect(t.courses[0].title.en).toBe('Basic Computer');
  expect(t.summaries[0].gpa).toBe('3.25');
});
