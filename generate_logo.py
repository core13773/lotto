#!/usr/bin/env python3
"""Generate 123lotto logo and icons."""

from PIL import Image, ImageDraw, ImageFont
import os

# Colors
BG = "#0f0f23"
GOLD = "#FFD700"
CYAN = "#00E5FF"
DARK_TEXT = "#1a1a2e"
WHITE = "#ffffff"

def get_font(size, bold=True):
    """Try to load a suitable font."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:/Windows/Fonts/arialbd.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    """Draw a rounded rectangle."""
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def draw_lotto_ball(draw, center, radius, number, font, shadow=True):
    """Draw a lottery ball with number."""
    x, y = center
    # Soft shadow for transparent bg
    if shadow:
        draw.ellipse([x-radius+3, y-radius+3, x+radius+3, y+radius+3], fill="#00000033")
    # Ball body
    draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=GOLD, outline=CYAN, width=3)
    # Highlight
    hl_r = radius * 0.35
    draw.ellipse([x-radius*0.6, y-radius*0.6, x-radius*0.6+hl_r*2, y-radius*0.6+hl_r*2], fill="#ffffff44")
    # Number with dark outline for contrast on any bg
    bbox = draw.textbbox((0, 0), str(number), font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x, y - radius*0.05), str(number), font=font, fill=DARK_TEXT, anchor="mm",
              stroke_width=2, stroke_fill="#000000")

def create_logo(width=800, height=300, transparent=True):
    """Create a wide logo image."""
    bg = (0, 0, 0, 0) if transparent else BG
    img = Image.new("RGBA", (width, height), bg)
    draw = ImageDraw.Draw(img)
    
    # Three lotto balls on the left
    ball_r = 55
    ball_y = height // 2
    spacing = 140
    start_x = 140
    
    num_font = get_font(48, bold=True)
    
    for i, num in enumerate([1, 2, 3]):
        bx = start_x + i * spacing
        draw_lotto_ball(draw, (bx, ball_y), ball_r, num, num_font)
    
    # Text "lotto"
    text_x = start_x + 3 * spacing - 20
    lotto_font = get_font(90, bold=True)
    bbox = draw.textbbox((0, 0), "lotto", font=lotto_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    
    # White text with black outline so it pops on ANY background
    draw.text((text_x, ball_y - th/2), "lotto", font=lotto_font, fill=WHITE,
              stroke_width=3, stroke_fill="#000000")
    
    return img

def create_icon(size):
    """Create a square icon with 123lotto branding."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    center = size // 2
    ball_r = int(size * 0.38)
    
    # Main golden circle background
    draw.ellipse([center-ball_r, center-ball_r, center+ball_r, center+ball_r], fill=GOLD, outline=CYAN, width=max(2, size//40))
    
    # Highlight
    hl_r = ball_r * 0.3
    draw.ellipse([center-ball_r*0.5, center-ball_r*0.5, center-ball_r*0.5+hl_r*2, center-ball_r*0.5+hl_r*2], fill="#ffffff55")
    
    # "123" text
    font_size = int(size * 0.30)
    font = get_font(font_size, bold=True)
    
    draw.text((center + max(1, size//80), center + max(1, size//80)), "123", font=font, fill="#00000033", anchor="mm")
    draw.text((center, center), "123", font=font, fill=DARK_TEXT, anchor="mm")
    
    return img

def main():
    # Generate logo
    logo = create_logo(800, 300)
    logo.save("logo.png")
    print("Generated logo.png (800x300)")
    
    # Generate logo with dark bg for social/opengraph
    logo_og = Image.new("RGBA", (1200, 630), BG)
    inner = create_logo(800, 300)
    logo_og.paste(inner, ((1200-800)//2, (630-300)//2), inner)
    logo_og.save("logo-og.png")
    print("Generated logo-og.png (1200x630)")
    
    # Generate icons
    icon192 = create_icon(192)
    icon192.save("icon-192.png")
    print("Generated icon-192.png")
    
    icon512 = create_icon(512)
    icon512.save("icon-512.png")
    print("Generated icon-512.png")

if __name__ == "__main__":
    main()
