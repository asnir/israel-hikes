import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function unexpectedAdvisories(report, lock) {
  if (report.error || !report.vulnerabilities || !report.metadata) throw new Error('Invalid npm audit result');
  const findings = [];
  for (const [name, dependency] of Object.entries(report.vulnerabilities)) {
    for (const advisory of dependency.via) {
      if (typeof advisory === 'string') continue; // Transitive summaries duplicate the source advisory.
      if (!['high', 'critical'].includes(advisory.severity)) continue;
      const accepted = name === 'braces' && dependency.isDirect === false && dependency.nodes?.length > 0 &&
        dependency.nodes.every(node => lock?.packages?.[node]?.dev === true) &&
        advisory.url === 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
      if (!accepted) findings.push({name, url: advisory.url, severity: advisory.severity});
    }
  }
  return findings;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = spawnSync('npm', ['audit', '--json'], {encoding: 'utf8'});
  if (result.error || ![0, 1].includes(result.status)) throw new Error('npm audit could not complete');
  const report = JSON.parse(result.stdout);
  const findings = unexpectedAdvisories(report, JSON.parse(readFileSync('package-lock.json', 'utf8')));
  console.log(JSON.stringify({counts: report.metadata.vulnerabilities, unexpectedHighOrCritical: findings}, null, 2));
  if (findings.length) process.exitCode = 1;
}
