"""Create deterministic social and touch images from the site's simple vector motif."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = "C:/Windows/Fonts/meiryo.ttc"


def music_note(draw, x, y, scale, color):
    draw.line((x + 55 * scale, y + 5 * scale, x + 55 * scale, y + 63 * scale), fill=color, width=11 * scale)
    draw.polygon([(x + 55 * scale, y + 5 * scale), (x + 91 * scale, y - 2 * scale), (x + 91 * scale, y + 11 * scale), (x + 55 * scale, y + 19 * scale)], fill=color)
    draw.ellipse((x + 17 * scale, y + 55 * scale, x + 61 * scale, y + 83 * scale), fill=color)


og = Image.new("RGB", (1200, 630), "#f8f4f8")
draw = ImageDraw.Draw(og)
draw.rounded_rectangle((42, 42, 1158, 588), radius=34, fill="#ffffff", outline="#e3dce5", width=3)
draw.rounded_rectangle((94, 104, 244, 254), radius=30, fill="#d82060")
music_note(draw, 100, 125, 1, "#ffffff")
draw.text((285, 105), "バンドリ楽曲ノート", font=ImageFont.truetype(FONT, 64), fill="#232d45")
draw.text((292, 213), "BANG DREAM!  SONG DATABASE", font=ImageFont.truetype(FONT, 27), fill="#6b7081")
draw.line((98, 318, 1100, 318), fill="#e7dfe7", width=3)
draw.text((100, 380), "ガルパ  •  アワーノーツ", font=ImageFont.truetype(FONT, 43), fill="#d82060")
draw.text((102, 475), "楽曲情報をゲームごとに探せる非公式データベース", font=ImageFont.truetype(FONT, 24), fill="#384259")
og.save(ROOT / "src/images/og-default.png", optimize=True)

icon = Image.new("RGB", (180, 180), "#d82060")
draw = ImageDraw.Draw(icon)
music_note(draw, 6, 19, 2, "#ffffff")
icon.save(ROOT / "src/images/apple-touch-icon.png", optimize=True)
