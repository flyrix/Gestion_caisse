#!/usr/bin/env python3
"""
Script pour générer 8 images-test simples (visèmes) pour tester le lip-sync.
Les images affichent des formes de bouche basiques.
"""

import os
from PIL import Image, ImageDraw

# Crée le dossier s'il n'existe pas
VISEME_DIR = 'icons/avatar-visemes'
os.makedirs(VISEME_DIR, exist_ok=True)

# Taille de base
WIDTH, HEIGHT = 300, 300
BG_COLOR = (240, 240, 240)  # Gris clair
FACE_COLOR = (255, 200, 150)  # Beige peau
MOUTH_COLOR = (180, 80, 80)  # Rouge bouche
TEXT_COLOR = (100, 100, 100)

def create_viseme(filename, mouth_shape_fn):
    """Crée une image avec une forme de bouche."""
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Cercle visage (simple)
    draw.ellipse([(40, 40), (260, 260)], fill=FACE_COLOR, outline=(200, 160, 120), width=3)
    
    # Yeux (simples)
    draw.ellipse([(90, 100), (120, 130)], fill=(50, 50, 50))
    draw.ellipse([(180, 100), (210, 130)], fill=(50, 50, 50))
    
    # Bouche : appelr la fonction précise
    mouth_shape_fn(draw)
    
    # Texte (label)
    label = filename.replace('.png', '').replace('_', ' ').upper()
    draw.text((150, 270), label, fill=TEXT_COLOR, anchor='mm', font=None)
    
    img.save(os.path.join(VISEME_DIR, filename))
    print(f"✓ Created {filename}")

def mouth_closed(draw):
    """Bouche fermée (ligne simple)."""
    draw.line([(100, 200), (200, 200)], fill=MOUTH_COLOR, width=4)

def mouth_smile_closed(draw):
    """Bouche fermée + sourire."""
    draw.arc([(90, 195), (210, 215)], 0, 180, fill=MOUTH_COLOR, width=4)

def mouth_slight_open(draw):
    """Légèrement ouverte."""
    draw.ellipse([(100, 195), (200, 215)], fill=MOUTH_COLOR, outline=MOUTH_COLOR, width=2)

def mouth_medium_open(draw):
    """Ouverture moyenne ('a')."""
    draw.ellipse([(95, 185), (205, 225)], fill=MOUTH_COLOR, outline=MOUTH_COLOR, width=2)

def mouth_wide_open(draw):
    """Largement ouverte (max)."""
    draw.ellipse([(85, 175), (215, 235)], fill=MOUTH_COLOR, outline=MOUTH_COLOR, width=2)

def mouth_o_shaped(draw):
    """Forme 'O' (lèvres arrondies)."""
    draw.ellipse([(120, 180), (180, 230)], fill=MOUTH_COLOR, outline=MOUTH_COLOR, width=3)

def mouth_e_shaped(draw):
    """Forme 'E' (sourire horizontal ample)."""
    draw.line([(100, 205), (200, 205)], fill=MOUTH_COLOR, width=5)
    draw.arc([(95, 190), (205, 220)], 0, 180, fill=MOUTH_COLOR, width=3)

def mouth_teeth_smile(draw):
    """Sourire montrant les dents."""
    draw.rectangle([(100, 190), (200, 220)], fill=(255, 255, 255), outline=MOUTH_COLOR, width=2)
    draw.arc([(90, 185), (210, 225)], 0, 180, fill=MOUTH_COLOR, width=3)

# Générer les 8 visèmes
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

print(f"Generating {len(visemes)} test visemes...")
for filename, draw_fn in visemes:
    create_viseme(filename, draw_fn)

print(f"\n✅ All visemes created in {VISEME_DIR}/")
print("Test them at page.html — click to authorize audio, then press the mic button.")
