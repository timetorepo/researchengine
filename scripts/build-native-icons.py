"""Developer-only final icon/BMP export. Requires Pillow; run from repo root.
Run export-native-brand.mjs first. CI consumes committed assets, not this script.
"""
from PIL import Image
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
src = Image.open('desktop/icon-source.png').convert('RGBA')
for path in Path('desktop/src-tauri/icons').glob('*.png'):
    with Image.open(path) as old:
        size = old.size
    src.resize(size, Image.Resampling.LANCZOS).save(path)
src.resize((512, 512), Image.Resampling.LANCZOS).save('frontend/public/brand/app-icon.png')
src.save('desktop/src-tauri/icons/icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
src.save('desktop/src-tauri/icons/icon.icns', format='ICNS')
for name in ['sidebar', 'header']:
    Image.open(f'.cache/{name}.png').convert('RGB').save(f'desktop/installer/{name}.bmp')
print('Native icon variants and 24-bit NSIS artwork exported.')
