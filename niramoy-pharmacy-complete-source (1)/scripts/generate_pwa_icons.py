import zlib
import struct
import math
import os

def write_png(filename, width, height, pixels):
    """
    pixels: list of (r, g, b, a) tuples of length width * height
    """
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter byte 0 (None)
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw_data.extend([r, g, b, a])
    
    compressed = zlib.compress(bytes(raw_data), 9)
    
    def chunk(chunk_type, data):
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) # 8-bit RGBA
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(header + ihdr + idat + iend)

def render_pharmacy_icon(size, is_maskable=False):
    pixels = []
    half = size / 2.0
    corner_radius = size * 0.22 if not is_maskable else 0.0

    # Colors
    bg_top = (5, 150, 105, 255)      # #059669
    bg_bottom = (4, 120, 87, 255)    # #047857
    cross_white = (255, 255, 255, 255)
    shadow_col = (2, 44, 34, 100)

    # Cross dimensions
    scale = 0.70 if is_maskable else 0.82
    cross_thickness = (size * 0.16) * scale
    cross_len = (size * 0.58) * scale
    cross_rx = cross_thickness * 0.35

    def in_rounded_rect(px, py, rx, ry, rw, rh, r):
        if px < rx or px > rx + rw or py < ry or py > ry + rh:
            return False
        # corners
        cx = rx + r if px < rx + r else (rx + rw - r if px > rx + rw - r else px)
        cy = ry + r if py < ry + r else (ry + rh - r if py > ry + rh - r else py)
        return (px - cx)**2 + (py - cy)**2 <= r**2

    for y in range(size):
        for x in range(size):
            # Check rounded box
            in_base = False
            if is_maskable:
                in_base = True
            else:
                in_base = in_rounded_rect(x, y, 0, 0, size, size, corner_radius)

            if not in_base:
                pixels.append((0, 0, 0, 0))
                continue

            # Base gradient
            grad_factor = y / float(size)
            r = int(bg_top[0] * (1 - grad_factor) + bg_bottom[0] * grad_factor)
            g = int(bg_top[1] * (1 - grad_factor) + bg_bottom[1] * grad_factor)
            b = int(bg_top[2] * (1 - grad_factor) + bg_bottom[2] * grad_factor)
            col = (r, g, b, 255)

            # Check cross (vertical bar + horizontal bar)
            vx = half - cross_thickness / 2.0
            vy = half - cross_len / 2.0
            hx = half - cross_len / 2.0
            hy = half - cross_thickness / 2.0

            # Subtle drop shadow
            in_vshadow = in_rounded_rect(x, y, vx, vy + 4, cross_thickness, cross_len, cross_rx)
            in_hshadow = in_rounded_rect(x, y, hx, hy + 4, cross_len, cross_thickness, cross_rx)
            if in_vshadow or in_hshadow:
                col = (max(0, col[0]-40), max(0, col[1]-40), max(0, col[2]-40), 255)

            in_v = in_rounded_rect(x, y, vx, vy, cross_thickness, cross_len, cross_rx)
            in_h = in_rounded_rect(x, y, hx, hy, cross_len, cross_thickness, cross_rx)

            if in_v or in_h:
                # Pill center accent
                dx = x - half
                dy = y - half
                dist = math.sqrt(dx*dx + dy*dy)
                if dist <= cross_thickness * 0.42:
                    # Capsule accent
                    if dx < 0:
                        col = (5, 150, 105, 255)
                    else:
                        col = (255, 255, 255, 255)
                else:
                    col = cross_white

            pixels.append(col)
    return pixels

os.makedirs('public', exist_ok=True)
print("Rendering PWA 192x192...")
write_png('public/pwa-192x192.png', 192, 192, render_pharmacy_icon(192, False))
print("Rendering PWA 512x512...")
write_png('public/pwa-512x512.png', 512, 512, render_pharmacy_icon(512, False))
print("Rendering PWA Maskable 512x512...")
write_png('public/pwa-maskable-512x512.png', 512, 512, render_pharmacy_icon(512, True))
print("Rendering Apple Touch Icon 180x180...")
write_png('public/apple-touch-icon.png', 180, 180, render_pharmacy_icon(180, False))
print("Rendering Favicon 64x64...")
write_png('public/favicon.ico', 64, 64, render_pharmacy_icon(64, False))
print("All PWA PNG assets created successfully!")
