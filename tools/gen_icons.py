#!/usr/bin/env python3
"""生成 PWA 图标：蓝底白色 ¥ 符号。纯标准库实现。"""
import struct, zlib, os

def png(path, size, pixels):
    raw = b''.join(b'\x00' + b''.join(struct.pack('BBBB', *px) for px in row) for row in pixels)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)

BG = (79, 110, 247, 255); FG = (255, 255, 255, 255); TR = (0, 0, 0, 0)
GLYPH = ["10000001", "01000010", "00100100", "00011000",
         "01111110", "00011000", "01111110", "00011000", "00011000"]

def make(size, path, rounded=True):
    r = int(size * 0.22)
    px = [[BG] * size for _ in range(size)]
    if rounded:
        for y in range(size):
            for x in range(size):
                cx = min(x, size - 1 - x); cy = min(y, size - 1 - y)
                if cx < r and cy < r:
                    dx = r - cx; dy = r - cy
                    if dx * dx + dy * dy > r * r:
                        px[y][x] = TR
    cell = size // 16
    ox = (size - 8 * cell) // 2; oy = (size - 9 * cell) // 2
    for gy, row in enumerate(GLYPH):
        for gx, bit in enumerate(row):
            if bit == '1':
                for y in range(oy + gy * cell, oy + (gy + 1) * cell):
                    for x in range(ox + gx * cell, ox + (gx + 1) * cell):
                        px[y][x] = FG
    png(path, size, px)

os.makedirs('icons', exist_ok=True)
make(192, 'icons/icon-192.png')
make(512, 'icons/icon-512.png')
make(180, 'icons/apple-touch-icon.png', rounded=False)  # iOS 自动加圆角，需不透明
print('icons generated')
