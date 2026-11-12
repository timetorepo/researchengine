"""Verify installed design-skill pins/profile without fetching or executing skills."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
lock = json.loads((root / 'docs/design/skills.lock.json').read_text())
active = root / '.agents/skills'
expected = {}
for entry in lock['skills']:
    if entry['status'] == 'installed':
        expected[entry['name']] = entry['sha256']
    else:
        assert not (active / entry['name']).exists() or entry['name'] == 'impeccable', entry['name']
for entry in lock['adaptations']:
    expected[entry['name']] = entry['sha256']
assert set(expected) == {p.name for p in active.iterdir() if p.is_dir()}
assert len(expected) >= 13, 'Need requested skills plus at least ten complementary skills'
for name, hashes in expected.items():
    directory = active / name
    files = {str(p.relative_to(directory)): p for p in directory.rglob('*') if p.is_file()}
    assert set(files) == set(hashes), f'Unexpected/missing files: {name}'
    for path, digest in hashes.items():
        assert not files[path].is_symlink(), f'Symlink: {name}/{path}'
        assert hashlib.sha256(files[path].read_bytes()).hexdigest() == digest, f'Hash: {name}/{path}'
        assert files[path].suffix in ('.md', '.yaml', '.yml', '.txt', ''), path
        assert 'scripts' not in files[path].relative_to(directory).parts, path
report = json.loads((root / 'docs/security/design-skills-installed-scan.json').read_text())
assert report['execution_successful']
assert report['analysis_completeness']['is_complete'], 'Incomplete configured scan scope'
assert set(expected) == {s['name'] for s in report['skills']}
# Findings are retained for human review, not silently suppressed or called clean.
assert all(s['suppressed_count'] == 0 for s in report['skills'])
print(f'PASS: {len(expected)} skill directories, pinned file hashes, instruction-only profile, scan inventory')
print(f"Retained scan findings: {sum(s['finding_count'] for s in report['skills'])}; max score {report['max_risk_score']}")
