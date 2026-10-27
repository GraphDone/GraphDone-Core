import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(report.SchemaVersion, 2);
assert.ok(report.Metadata?.ImageID?.startsWith('sha256:'));
assert.ok(report.Results?.some(result => result.Class === 'os-pkgs' && result.Packages?.length));
assert.ok(report.Results?.some(result => result.Type === 'node-pkg' && result.Packages?.length));
const findings = report.Results.flatMap(result => result.Vulnerabilities || []);
console.log(JSON.stringify({ image: report.Metadata.ImageID, knownFindings: findings.length, severity: Object.fromEntries(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(severity => [severity, findings.filter(finding => finding.Severity === severity).length])) }));
