#!/usr/bin/env python3
"""
Script pour générer 8 images-test réalistes (visèmes) avec dégradés et ombres.
Crée un avatar stylisé avec gradient peau, yeux avec reflet, et bouches variées.
"""

import os
from PIL import Image, ImageDraw

VISEME_DIR = 'icons/avatar-visemes'
os.makedirs(VISEME_DIR, exist_ok=True)

WIDTH, HEIGHT = 300, 300

# Palettes réalistes
BG_GRADIENT_TOP = (235, 240, 245)
BG_GRADIENT_BOT = (220, 225, 235)
SKIN_LIGHT = (255, 200, 170)
SKIN_DARK = (220, 160, 130)
MOUTH_COLOR = (180, 80, 100)
MOUTH_DARK = (140, 50, 70)
EYE_WHITE = (240, 240, 240)
EYE_IRIS = (70, 100, 180)
EYE_PUPIL = (20, 20, 20)
SHADOW_COLOR = (200, 150, 120, 80)  # RGBA
HIGHLIGHT_COLOR = (255, 255, 255, 150)

def create_gradient_bg(width, height, color_top, color_bot):
    """Crée un dégradé vertical."""
    img = Image.new('RGB', (width, height))
    pixels = img.load()
    
    for y in range(height):
        ratio = y / height
        r = int(color_top[0] * (1 - ratio) + color_bot[0] * ratio)
        g = int(color_top[1] * (1 - ratio) + color_bot[1] * ratio)
        b = int(color_top[2] * (1 - ratio) + color_bot[2] * ratio)
        for x in range(width):
            pixels[x, y] = (r, g, b)
    
    return img

def create_viseme(filename, mouth_shape_fn):
    """Crée une image réaliste avec un avatar et une forme de bouche."""
    
    # Fond avec dégradé
    img = create_gradient_bg(WIDTH, HEIGHT, BG_GRADIENT_TOP, BG_GRADIENT_BOT)
    draw = ImageDraw.Draw(img, 'RGBA')
    
    # === VISAGE ===
    # Ombre du visage (profondeur)
    draw.ellipse([(45, 55), (255, 255)], outline=(150, 100, 80, 100), width=8)
    
    # Visage avec dégradé radial (simulé avec ellipses concentriques)
    draw.ellipse([(50, 60), (250, 250)], fill=SKIN_LIGHT, outline=SKIN_DARK, width=2)
    
    # Léger ombrage sur les côtés pour la profondeur
    draw.ellipse([(50, 120), (70, 180)], fill=(200, 140, 110, 60))  # Ombre gauche
    draw.ellipse([(230, 120), (250, 180)], fill=(200, 140, 110, 60))  # Ombre droite
    
    # === YEUX ===
    # Yeux blancs avec légère courbe
    draw.ellipse([(80, 95), (120, 135)], fill=EYE_WHITE, outline=(180, 140, 110), width=1)
    draw.ellipse([(180, 95), (220, 135)], fill=EYE_WHITE, outline=(180, 140, 110), width=1)
    
    # Iris (couleur bleu)
    draw.ellipse([(92, 105), (118, 131)], fill=EYE_IRIS, outline=(40, 70, 150), width=1)
    draw.ellipse([(192, 105), (218, 131)], fill=EYE_IRIS, outline=(40, 70, 150), width=1)
    
    # Pupilles
    draw.ellipse([(100, 110), (112, 122)], fill=EYE_PUPIL)
    draw.ellipse([(200, 110), (212, 122)], fill=EYE_PUPIL)
    
    # Reflets yeux (highlights)
    draw.ellipse([(103, 107), (108, 112)], fill=(255, 255, 255, 200))
    draw.ellipse([(203, 107), (208, 112)], fill=(255, 255, 255, 200))
    
    # === NEZ ===
    # Léger ombrage pour le nez
    draw.line([(150, 130), (150, 175)], fill=(200, 160, 140), width=2)
    
    # === BOUCHE ===
    mouth_shape_fn(draw)
    
    # === CONTOUR VISAGE ===
    # Contour léger pour plus de définition
    draw.ellipse([(50, 60), (250, 250)], outline=(180, 130, 100), width=1)
    
    img.save(os.path.join(VISEME_DIR, filename))
    print(f"✓ Created {filename}")

def mouth_closed(draw):
    """Bouche fermée (ligne souriante subtile)."""
    draw.line([(100, 205), (200, 205)], fill=MOUTH_DARK, width=5)
    draw.arc([(95, 200), (205, 215)], 0, 180, fill=MOUTH_COLOR, width=2)

def mouth_smile_closed(draw):
    """Bouche fermée + sourire."""
    draw.arc([(85, 195), (215, 220)], 0, 180, fill=MOUTH_COLOR, width=4)
    draw.line([(100, 210), (200, 210)], fill=MOUTH_DARK, width=2)

def mouth_slight_open(draw):
    """Légèrement ouverte."""
    draw.ellipse([(95, 200), (205, 220)], fill=MOUTH_COLOR, outline=MOUTH_DARK, width=2)
    draw.line([(100, 200), (200, 200)], fill=(100, 30, 50), width=1)  # Intérieur bouche

def mouth_medium_open(draw):
    """Ouverture moyenne ('a')."""
    draw.ellipse([(90, 190), (210, 230)], fill=MOUTH_COLOR, outline=MOUTH_DARK, width=2)
    draw.ellipse([(95, 195), (205, 225)], fill=(100, 30, 50), outline=MOUTH_COLOR, width=1)

def mouth_wide_open(draw):
    """Largement ouverte (vocalise 'o', 'a')."""
    draw.ellipse([(80, 180), (220, 240)], fill=MOUTH_COLOR, outline=MOUTH_DARK, width=2)
    draw.ellipse([(90, 190), (210, 230)], fill=(80, 20, 40), outline=MOUTH_COLOR, width=1)

def mouth_o_shaped(draw):
    """Forme 'O' (lèvres arrondies pour 'o', 'u')."""
    draw.ellipse([(115, 185), (185, 235)], fill=MOUTH_COLOR, outline=MOUTH_DARK, width=3)
    draw.ellipse([(125, 195), (175, 225)], fill=(80, 20, 40), outline=MOUTH_COLOR, width=1)

def mouth_e_shaped(draw):
    """Forme 'E' (sourire ample en parlant)."""
    draw.line([(90, 210), (210, 210)], fill=MOUTH_COLOR, width=5)
    draw.arc([(80, 195), (220, 230)], 0, 180, fill=MOUTH_COLOR, width=3)
    draw.line([(100, 205), (200, 205)], fill=(100, 30, 50), width=1)

def mouth_teeth_smile(draw):
    """Sourire montrant les dents."""
    # Dents blanches
    draw.rectangle([(100, 195), (200, 220)], fill=(245, 240, 235), outline=MOUTH_DARK, width=2)
    # Trait pour les dents
    for x in range(115, 200, 15):
        draw.line([(x, 195), (x, 220)], fill=(180, 170, 160), width=1)
    # Lèvre inférieure
    draw.arc([(85, 210), (215, 240)], 0, 180, fill=MOUTH_COLOR, width=3)

# === GÉNÉRATION ===
visemes = [
    ('closed.png', mouth_closed),
    ('smile-closed.png', mouth_smile_closed),
    ('slight-open.png', mouth_slight_open),
    ('medium-open.png', mouth_medium_open),
    ('wide-open.png', mouth_wide_open),
    ('o-shaped.png', mouth_o_shaped),
    ('e-shaped.png', mouth_e_shaped),
    ('teeth-smile.png', mouth_teeth_smile),
]

print(f"Generating {len(visemes)} realistic visemes with gradients & shadows...")
for filename, draw_fn in visemes:
    create_viseme(filename, draw_fn)

print(f"\n✅ All realistic visemes created in {VISEME_DIR}/")
print("Test them at page.html — click to authorize audio, then press the mic button.")


