"""Bundle only the offline runtime, its operator guide, and font licenses."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
files = ['index.html', 'ceremony.css', 'config.js', 'votes.js', 'engine.js', 'render.js', 'player.js', 'START_OSCA.cmd', 'README.md', 'favicon.png', 'fonts/OFL.txt', 'fonts/SOURCE.txt']
files += ['fonts/A2Z-' + name + '.woff2' for name in ['4Regular', '5Medium', '6SemiBold', '7Bold', '9Black']]
out = root / 'OSCA-offline-player.zip'
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, 'OSCA-offline-player/' + name)
with ZipFile(out) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(files)
print(f'{out} ({out.stat().st_size:,} bytes; {len(files)} files)')
