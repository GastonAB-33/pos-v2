#!/usr/bin/env python3
"""
POS V2 - Removedor Automático de Fondo con Inteligencia Artificial
Utiliza el modelo neuronal BiRefNet / U2Net de rembg para eliminar fondos
complejos (mostradores, estantes, manos) y reemplazarlos por blanco puro (#FFFFFF).

Instalación de dependencias:
    pip install rembg pillow

Uso:
    python remove-background.py --input foto_mostrador.jpg --output 7790000000000.webp
"""

import sys
import os
import argparse
from PIL import Image

def process_image(input_path, output_path, target_size=(800, 800), padding=40):
    try:
        from rembg import remove
    except ImportError:
        print("❌ Error: rembg no está instalado. Ejecutá: pip install rembg pillow")
        sys.exit(1)

    print(f"🔄 Procesando: {input_path}...")
    with open(input_path, "rb") as f:
        input_data = f.read()

    # 1. Quitar fondo con IA (devuelve imagen RGBA transparente)
    segmented_data = remove(input_data)
    
    # 2. Abrir con PIL
    import io
    fg_image = Image.open(io.BytesIO(segmented_data)).convert("RGBA")

    # 3. Recortar bordes transparentes sobrantes (autocrop)
    bbox = fg_image.getbbox()
    if bbox:
        fg_image = fg_image.crop(bbox)

    # 4. Escalar proporcionalmente para encajar en el tamaño deseado respetando padding
    max_w = target_size[0] - (padding * 2)
    max_h = target_size[1] - (padding * 2)
    fg_image.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

    # 5. Crear lienzo blanco puro (#FFFFFF) de 800x800
    canvas = Image.new("RGBA", target_size, (255, 255, 255, 255))

    # 6. Centrar el producto en el lienzo
    paste_x = (target_size[0] - fg_image.width) // 2
    paste_y = (target_size[1] - fg_image.height) // 2
    canvas.paste(fg_image, (paste_x, paste_y), fg_image)

    # 7. Convertir a RGB y guardar en WebP
    final_rgb = canvas.convert("RGB")
    final_rgb.save(output_path, "WEBP", quality=85, method=4)

    raw_kb = os.path.getsize(input_path) / 1024
    opt_kb = os.path.getsize(output_path) / 1024
    print(f"✅ Listo: {output_path} ({raw_kb:.1f} KB -> {opt_kb:.1f} KB WebP 800x800 fondo blanco)")

def main():
    parser = argparse.ArgumentParser(description="Remueve el fondo de fotos de productos tomadas con celular.")
    parser.add_argument("--input", "-i", required=True, help="Ruta de la imagen de entrada")
    parser.add_argument("--output", "-o", required=True, help="Ruta de salida (.webp)")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"❌ Error: El archivo {args.input} no existe.")
        sys.exit(1)

    process_image(args.input, args.output)

if __name__ == "__main__":
    main()
