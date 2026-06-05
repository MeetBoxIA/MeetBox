# Recursos de build para electron-builder

Coloca aquí los iconos de la app antes de empaquetar:

## Archivos requeridos

| Archivo           | Tamaño       | Para                    |
|-------------------|-------------|-------------------------|
| `icon.ico`        | 256×256 px  | Windows (.exe installer)|
| `icon.icns`       | 512×512 px  | macOS (.dmg)            |
| `icon.png`        | 512×512 px  | Linux + notificaciones  |
| `tray-icon.png`   | 32×32 px    | System tray (todos los SO)|

## Cómo generarlos desde el SVG de MeetBox

```bash
# Instalar sharp-cli o usar https://convertio.co
# SVG fuente: ../../../public/favicon.svg

# Opción rápida — online:
# https://www.img2go.com/convert-to-icns
# https://icoconvert.com/

# Con ImageMagick (Linux/macOS):
magick favicon.svg -resize 256x256 icon.png
magick icon.png icon.ico
```

## Notas
- Sin los iconos, electron-builder usará el ícono por defecto de Electron
- Para firma de código (Windows): necesitas un certificado .pfx
- Para notarización (macOS): necesitas una cuenta de Apple Developer
