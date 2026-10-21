"""Genera los iconos publicados de BandApp desde la imagen aprobada."""
from pathlib import Path
from PIL import Image

output = Path("sitio")
output.mkdir(exist_ok=True)
original = Image.open("bandapp-icon-source.jpg").convert("RGB")
for size, filename in (
    (32, "favicon.png"),
    (180, "apple-touch-icon.png"),
    (192, "icon-192.png"),
    (512, "icon-512.png"),
):
    image = original.resize((size, size), Image.Resampling.LANCZOS)
    image.save(output / filename, format="PNG", optimize=True)
