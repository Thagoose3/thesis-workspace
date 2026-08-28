import struct
import zlib
import os
import math

def create_png(width, height, draw_func, filename):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter byte 0 (None)
        for x in range(width):
            r, g, b, a = draw_func(x / width, y / height, width, height)
            raw_data.extend([r, g, b, a])

    def chunk(tag, data):
        return struct.pack('!I', len(data)) + tag + data + struct.pack('!I', zlib.crc32(tag + data) & 0xffffffff)

    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR
    png.extend(chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)))
    # IDAT
    compressed = zlib.compress(raw_data, 9)
    png.extend(chunk(b'IDAT', compressed))
    # IEND
    png.extend(chunk(b'IEND', b''))

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated {filename} ({width}x{height})")

def point_in_rounded_rect(px, py, rx, ry, rw, rh, rad):
    if px < rx or px > rx + rw or py < ry or py > ry + rh:
        return False
    # Check corners
    if px < rx + rad and py < ry + rad:
        return math.hypot(px - (rx + rad), py - (ry + rad)) <= rad
    if px > rx + rw - rad and py < ry + rad:
        return math.hypot(px - (rx + rw - rad), py - (ry + rad)) <= rad
    if px < rx + rad and py > ry + rh - rad:
        return math.hypot(px - (rx + rad), py - (ry + rh - rad)) <= rad
    if px > rx + rw - rad and py > ry + rh - rad:
        return math.hypot(px - (rx + rw - rad), py - (ry + rh - rad)) <= rad
    return True

def papervault_shader(u, v, w, h):
    # Base background: Dark sleek squircle
    in_bg = point_in_rounded_rect(u, v, 0.04, 0.04, 0.92, 0.92, 0.22)
    if not in_bg:
        return (0, 0, 0, 0)

    # Gradient background
    bg_r = int(10 + u * 8)
    bg_g = int(10 + v * 8)
    bg_b = int(15 + (u + v) * 12)

    # Subtle inner glow / border
    on_border = not point_in_rounded_rect(u, v, 0.05, 0.05, 0.90, 0.90, 0.20)
    if on_border:
        return (59, 130, 246, 180)

    # Paper Document Base (Center-left tilted or clean centered)
    # Document rectangle: [0.26, 0.22] to [0.74, 0.78]
    in_doc = point_in_rounded_rect(u, v, 0.26, 0.22, 0.48, 0.56, 0.08)
    
    # Document fold top-right corner cut
    if in_doc and u > 0.60 and v < 0.36 and (u - 0.60) + (0.36 - v) > 0.14:
        in_doc = False

    # Vault Shield / Gem in center of document
    # Distance to center
    dx = (u - 0.50) * 1.0
    dy = (v - 0.54) * 1.0
    dist_center = math.hypot(dx, dy)

    # Document color (Light crisp surface with glowing cyan/blue theme)
    if in_doc:
        # Document lines
        # Line 1
        if 0.35 <= u <= 0.55 and 0.34 <= v <= 0.38:
            return (59, 130, 246, 255) # Blue title bar
        # Line 2
        if 0.35 <= u <= 0.65 and 0.44 <= v <= 0.47:
            return (147, 197, 253, 220)
        # Line 3
        if 0.35 <= u <= 0.65 and 0.53 <= v <= 0.56:
            return (147, 197, 253, 220)
        # Line 4
        if 0.35 <= u <= 0.58 and 0.62 <= v <= 0.65:
            return (147, 197, 253, 220)

        # Doc base background (pure sleek dark glass / white gradient)
        doc_r = int(245 - v * 20)
        doc_g = int(248 - v * 15)
        doc_b = 255
        return (doc_r, doc_g, doc_b, 255)

    # Folded corner flap
    if u >= 0.58 and u <= 0.74 and v >= 0.22 and v <= 0.38:
        if (u - 0.60) + (0.36 - v) <= 0.14 and u >= 0.60 and v <= 0.36:
            return (191, 219, 254, 255)

    # Ambient blue glow around document
    if dist_center < 0.38:
        glow = math.exp(-dist_center * 5)
        r = int(bg_r * (1 - glow) + 59 * glow)
        g = int(bg_g * (1 - glow) + 130 * glow)
        b = int(bg_b * (1 - glow) + 246 * glow)
        return (r, g, b, 255)

    return (bg_r, bg_g, bg_b, 255)

if __name__ == '__main__':
    create_png(512, 512, papervault_shader, 'assets/icon-512.png')
    create_png(192, 192, papervault_shader, 'assets/icon-192.png')
    create_png(180, 180, papervault_shader, 'assets/apple-touch-icon.png')
