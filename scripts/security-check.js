const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const patterns = [
  ['AWS access key', /(?:AKIA|ASIA)[0-9A-Z]{16}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['MongoDB credential', /mongodb(?:\+srv)?:\/\/[^\s/@:]+:[^\s/@]+@/i],
  ['assigned secret', /^\s*(?:API_AUTH_SECRET|EVENT_SIGNING_SECRET|MQTT_PASSWORD)\s*=\s*[^\s#"']{8,}/]
];

function scanText(file, content) {
  const findings = [];
  content.split(/\r?\n/).forEach((line, index) => {
    for (const [kind, pattern] of patterns) {
      if (pattern.test(line)) findings.push({ file, line: index + 1, kind });
    }
  });
  return findings;
}

function main() {
  const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .toString().split('\0').filter(Boolean);
  const findings = [];
  for (const name of names) {
    if (!fs.statSync(name).isFile()) continue;
    const contents = fs.readFileSync(name);
    if (contents.includes(0) || contents.length > 2_000_000) continue;
    findings.push(...scanText(name, contents.toString('utf8')));
  }
  if (findings.length) {
    for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.kind}`);
    process.exitCode = 1;
  } else console.log(`Security scan passed for ${names.length} project files`);
}

if (require.main === module) main();

module.exports = { scanText };
