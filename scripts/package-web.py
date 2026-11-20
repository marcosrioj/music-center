"""Package the built dashboard for a static HTTPS host."""
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
if not all((dist / name).is_file() for name in ('index.html', 'musiccenter-config.json')):
    raise SystemExit('Execute npm run build antes de empacotar o painel.')
delivery = root / 'entrega'
delivery.mkdir(exist_ok=True)
with NamedTemporaryFile(dir=delivery, suffix='.tmp', delete=False) as temp:
    pending = Path(temp.name)
try:
    with ZipFile(pending, 'w', ZIP_DEFLATED) as archive:
        for path in sorted(dist.rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(dist))
    pending.chmod(0o644)
    pending.replace(delivery / 'MusicCenter-Web.zip')
finally:
    pending.unlink(missing_ok=True)
