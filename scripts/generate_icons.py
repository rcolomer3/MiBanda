"""Genera los iconos de BandApp con fondo azul hasta el borde.

El JPG original ya tiene esquinas blancas alrededor de un cuadrado redondeado.
En iOS, el icono se vuelve a recortar durante la animación de apertura; esas
esquinas blancas pueden asomarse mientras el sistema amplía la imagen.
Extender el fondo azul hasta el borde deja el redondeo a cargo de iOS.
"""
from pathlib import Path
from PIL import Image


def icon_without_white_corners(image: Image.Image) -> Image.Image:
    """Completa únicamente los márgenes exteriores; preserva la nota musical."""
    icon = image.convert("RGB")
    pixels = icon.load()
    width, height = icon.size

    def is_blue(pixel: tuple[int, int, int]) -> bool:
        red, green, blue = pixel
        # Excluir tonos casi blancos de la compresión JPEG / Lanczos.
        return red < 170 and blue >= 27 and blue > red + 18 and blue > green + 6

    for y in range(height):
        # Hallar el primer y último píxel del fondo azul en cada línea.
        # Se dejan intactas todas las zonas interiores, incluidas las notas
        # blancas: solo se corrigen los bordes exteriores del cuadrado.
        blue_x = [x for x in range(width) if is_blue(pixels[x, y])]
        if blue_x:
            left, right = blue_x[0], blue_x[-1]
            left_color, right_color = pixels[left, y], pixels[right, y]
            for x in range(left):
                pixels[x, y] = left_color
            for x in range(right + 1, width):
                pixels[x, y] = right_color
        else:
            # Respaldo para filas completamente blancas en las esquinas.
            for x in range(width):
                pixels[x, y] = (8, 43, 121)

    return icon


output = Path("sitio")
output.mkdir(exist_ok=True)
original = Image.open("bandapp-icon-source.jpg").convert("RGB")
full_bleed = icon_without_white_corners(original)
for size, filename in (
    (32, "favicon.png"),
    (180, "apple-touch-icon.png"),
    (192, "icon-192.png"),
    (512, "icon-512.png"),
):
    icon = full_bleed.resize((size, size), Image.Resampling.LANCZOS)
    # Lanzcos puede reintroducir un halo blanco al reducir el JPG.
    # Repetir la corrección sobre la versión final, en especial 32/180px.
    icon = icon_without_white_corners(icon)
    # PNG totalmente opaco y sin márgenes blancos: iOS aplica su máscara.
    assert icon.mode == "RGB" and icon.size == (size, size)
    for corner in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
        r, g, b = icon.getpixel(corner)
        assert not (r > 220 and g > 220 and b > 220), f"Borde blanco en {filename}: {corner}"
    icon.save(output / filename, format="PNG", optimize=True)
