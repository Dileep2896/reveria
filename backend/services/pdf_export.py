"""Generate a polished PDF storybook from scenes."""

import logging
import os
import tempfile
from typing import Any

import requests
from fpdf import FPDF

logger = logging.getLogger("storyforge.pdf")

PAGE_W = 210  # A4 width in mm
PAGE_H = 297  # A4 height in mm

# Unicode font search paths (first match wins)
_UNICODE_FONT_CANDIDATES = [
    # macOS
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    # Linux (apt install fonts-noto)
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    # Linux CJK (apt install fonts-noto-cjk)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    # Common Linux fallback
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _find_unicode_font() -> str | None:
    """Find a Unicode TTF font on the system."""
    for path in _UNICODE_FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


class _StoryPDF(FPDF):
    """FPDF subclass with automatic page numbering and Unicode font support."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._footer_enabled = False
        self._fn = "Times"  # font family name - overridden if Unicode font found

    def setup_fonts(self) -> None:
        """Register a Unicode font if available, else fall back to Times."""
        font_path = _find_unicode_font()
        if font_path:
            # Register the same file for all styles (fake bold/italic - glyphs are
            # identical but text won't crash on non-Latin characters)
            self.add_font("UniFont", "", font_path)
            self.add_font("UniFont", "B", font_path)
            self.add_font("UniFont", "I", font_path)
            self.add_font("UniFont", "BI", font_path)
            self._fn = "UniFont"
            logger.info("PDF using Unicode font: %s", font_path)
        else:
            logger.warning("No Unicode font found - PDF will only support Latin text")

    def footer(self):
        if not self._footer_enabled:
            return
        self.set_y(-14)
        self.set_font(self._fn, "I", 8)
        self.set_text_color(165, 155, 140)
        # Page number (subtract 1 to skip cover page)
        self.cell(0, 10, str(self.page_no() - 1), align="C")


def _download_image(url: str) -> str | None:
    """Download image URL to a temp file, return path or None."""
    if not url or url == "error" or url.startswith("data:"):
        return None
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.content
        if len(data) < 100:
            return None
        suffix = ".png" if b"\x89PNG" in data[:8] else ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(data)
        tmp.flush()
        tmp.close()
        return tmp.name
    except Exception as e:
        logger.warning("Image download failed %s: %s", url[:80], e)
        return None


def _cleanup(paths: list[str]):
    for p in paths:
        try:
            os.unlink(p)
        except OSError:
            pass


def generate_story_pdf(
    title: str,
    author_name: str,
    cover_url: str | None,
    scenes: list[dict[str, Any]],
) -> bytes:
    """Generate a polished PDF storybook. Returns PDF bytes."""
    title = title or "Untitled Story"
    author = author_name or "Anonymous"
    temp_files: list[str] = []

    pdf = _StoryPDF(orientation="P", unit="mm", format="A4")
    pdf.setup_fonts()
    fn = pdf._fn  # shorthand for font family name
    pdf.set_auto_page_break(auto=True, margin=25)

    # ================================================================
    #  COVER PAGE
    # ================================================================
    pdf.add_page()
    pdf._footer_enabled = False

    cover_path = _download_image(cover_url) if cover_url else None
    if cover_path:
        temp_files.append(cover_path)

    cover_ok = False
    if cover_path:
        try:
            # Dark base (fills gaps if image doesn't cover full page)
            pdf.set_fill_color(25, 22, 30)
            pdf.rect(0, 0, PAGE_W, PAGE_H, style="F")

            # Full-width cover image from top
            pdf.image(cover_path, x=0, y=0, w=PAGE_W)

            # Dark band at bottom for title overlay
            band_y = PAGE_H - 62
            pdf.set_fill_color(25, 22, 30)
            pdf.rect(0, band_y, PAGE_W, 62, style="F")

            # Gold accent line
            pdf.set_draw_color(200, 175, 120)
            pdf.set_line_width(0.4)
            pdf.line(35, band_y + 7, PAGE_W - 35, band_y + 7)

            # Title
            pdf.set_y(band_y + 14)
            pdf.set_font(fn, "B", 30)
            pdf.set_text_color(248, 242, 228)
            pdf.multi_cell(0, 13, title, align="C", new_x="LMARGIN", new_y="NEXT")

            # Author
            pdf.set_font(fn, "I", 13)
            pdf.set_text_color(195, 180, 155)
            pdf.cell(0, 8, f"by {author}", align="C")
            cover_ok = True
        except Exception as exc:
            logger.warning("Cover image placement failed: %s", exc)

    if not cover_ok:
        # Elegant text-only cover with dark background
        pdf.set_fill_color(32, 28, 38)
        pdf.rect(0, 0, PAGE_W, PAGE_H, style="F")

        # Double border frame
        pdf.set_draw_color(185, 165, 125)
        pdf.set_line_width(0.4)
        pdf.rect(12, 12, PAGE_W - 24, PAGE_H - 24)
        pdf.set_line_width(0.2)
        pdf.rect(16, 16, PAGE_W - 32, PAGE_H - 32)

        # Title
        pdf.set_y(110)
        pdf.set_font(fn, "B", 34)
        pdf.set_text_color(242, 232, 218)
        pdf.multi_cell(0, 15, title, align="C")

        # Gold ornament
        pdf.ln(5)
        y = pdf.get_y()
        cx = PAGE_W / 2
        pdf.set_draw_color(200, 175, 120)
        pdf.set_line_width(0.5)
        pdf.line(cx - 30, y, cx + 30, y)
        pdf.ln(10)

        # Author
        pdf.set_font(fn, "I", 15)
        pdf.set_text_color(190, 175, 148)
        pdf.cell(0, 10, f"by {author}", align="C")

    # Reset for body pages
    pdf.set_text_color(0, 0, 0)
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.2)

    # ================================================================
    #  SCENE PAGES
    # ================================================================
    pdf._footer_enabled = True

    for i, scene in enumerate(scenes):
        pdf.add_page()
        pdf.set_left_margin(20)
        pdf.set_right_margin(20)

        scene_num = scene.get("scene_number", i + 1)
        scene_title = scene.get("scene_title") or f"Scene {scene_num}"

        # -- Scene image (full width with small margins) --
        img_url = scene.get("image_url")
        has_image = False
        if img_url and img_url != "error":
            img_path = _download_image(img_url)
            if img_path:
                temp_files.append(img_path)
                try:
                    pdf.image(img_path, x=15, w=PAGE_W - 30)
                    pdf.ln(8)
                    has_image = True
                except Exception:
                    pass

        if not has_image:
            pdf.ln(10)

        # -- Chapter number --
        pdf.set_font(fn, "I", 9)
        pdf.set_text_color(165, 148, 118)
        pdf.cell(0, 4, f"~  {scene_num}  ~", align="C",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

        # -- Scene title --
        pdf.set_font(fn, "B", 17)
        pdf.set_text_color(48, 40, 34)
        pdf.cell(0, 9, scene_title, align="C",
                 new_x="LMARGIN", new_y="NEXT")

        # -- Decorative separator --
        pdf.ln(3)
        y = pdf.get_y()
        cx = PAGE_W / 2
        pdf.set_draw_color(205, 190, 158)
        pdf.set_line_width(0.3)
        pdf.line(cx - 22, y, cx - 4, y)
        pdf.line(cx + 4, y, cx + 22, y)
        # Small diamond in center
        d = 1.2
        pdf.line(cx - d, y, cx, y - d)
        pdf.line(cx, y - d, cx + d, y)
        pdf.line(cx + d, y, cx, y + d)
        pdf.line(cx, y + d, cx - d, y)
        pdf.ln(7)

        # -- Story text --
        text = scene.get("text", "")
        if text:
            pdf.set_left_margin(25)
            pdf.set_right_margin(25)
            pdf.set_x(25)
            pdf.set_font(fn, "", 11.5)
            pdf.set_text_color(55, 48, 42)
            pdf.multi_cell(0, 6.5, text, align="J")
            # Reset margins
            pdf.set_left_margin(20)
            pdf.set_right_margin(20)

    # ================================================================
    #  COLOPHON (last page)
    # ================================================================
    pdf._footer_enabled = False
    pdf.add_page()

    # Warm paper background
    pdf.set_fill_color(252, 249, 244)
    pdf.rect(0, 0, PAGE_W, PAGE_H, style="F")

    pdf.set_y(PAGE_H / 2 - 28)

    # Small ornament above
    cx = PAGE_W / 2
    y = pdf.get_y()
    pdf.set_draw_color(205, 190, 158)
    pdf.set_line_width(0.3)
    pdf.line(cx - 15, y, cx + 15, y)
    pdf.ln(10)

    pdf.set_font(fn, "I", 11)
    pdf.set_text_color(160, 150, 138)
    pdf.cell(0, 7, "This story was imagined and illustrated with",
             align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    pdf.set_font(fn, "B", 24)
    pdf.set_text_color(78, 68, 58)
    pdf.cell(0, 12, "StoryForge", align="C",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    y = pdf.get_y()
    pdf.set_draw_color(205, 190, 158)
    pdf.line(cx - 15, y, cx + 15, y)
    pdf.ln(10)

    pdf.set_font(fn, "I", 9)
    pdf.set_text_color(178, 168, 155)
    pdf.cell(0, 5, "Powered by Gemini  \u00b7  AI storytelling",
             align="C")

    result = bytes(pdf.output())
    _cleanup(temp_files)
    return result
