#!/usr/bin/env python3
"""
Fix slides 9 and 14 in the AI Sales Platform presentation.
Clears existing shapes and rebuilds them with proper formatting.
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

PPTX_PATH = "/home/bogdan/Desktop/Projects/laser_components/presentation/ai-sales-platform-presentation.pptx"

# Color constants
BLUE_ACCENT = RGBColor(0x4A, 0xBA, 0xFF)   # #4ABAFF
PURPLE_ACCENT = RGBColor(0x9B, 0x6D, 0xFF) # #9B6DFF
DARK_TEXT = RGBColor(0x1A, 0x1A, 0x2E)     # #1A1A2E
LIGHT_GRAY = RGBColor(0xF5, 0xF5, 0xF5)    # #F5F5F5
WHITE = RGBColor(0xFF, 0xFF, 0xFF)          # #FFFFFF
DARK_BG = RGBColor(0x1A, 0x1A, 0x2E)       # #1A1A2E
GREEN_TERM = RGBColor(0x4A, 0xDE, 0x80)    # #4ADE80
GRAY_TEXT = RGBColor(0x99, 0x99, 0x99)      # #999999
MED_GRAY = RGBColor(0x66, 0x66, 0x66)       # #666666


def clear_slide(slide):
    """Remove all shapes from a slide."""
    for shape in list(slide.shapes):
        sp = shape._element
        sp.getparent().remove(sp)


def set_shape_rounded_corners(shape, radius_emu=150000):
    """Set rounded corner radius on an auto shape (undocumented but works)."""
    # Access the spPr element and set the rounded corner radius
    sp = shape._element
    prstGeom = sp.find(qn('a:prstGeom'), sp.nsmap) if hasattr(sp, 'nsmap') else None
    if prstGeom is None:
        spPr = sp.find('.//' + qn('a:prstGeom'))
        if spPr is not None:
            prstGeom = spPr
    # For rounded rectangles, python-pptx handles this via MSO_SHAPE.ROUNDED_RECTANGLE
    # We just need to adjust the avLst if needed
    pass


def add_text_run(paragraph, text, font_size=Pt(13), color=DARK_TEXT, bold=False, font_name='Calibri'):
    """Add a text run to a paragraph with specified formatting."""
    run = paragraph.add_run()
    run.text = text
    run.font.size = font_size
    run.font.color.rgb = color
    run.font.bold = bold
    run.font.name = font_name
    return run


def add_paragraph(text_frame, text, font_size=Pt(13), color=DARK_TEXT, bold=False,
                  alignment=PP_ALIGN.LEFT, font_name='Calibri', space_before=None, space_after=None):
    """Add a new paragraph with a single formatted run."""
    para = text_frame.add_paragraph()
    para.alignment = alignment
    if space_before is not None:
        para.space_before = space_before
    if space_after is not None:
        para.space_after = space_after
    run = para.add_run()
    run.text = text
    run.font.size = font_size
    run.font.color.rgb = color
    run.font.bold = bold
    run.font.name = font_name
    return para


def build_slide_9(slide, slide_width, slide_height):
    """Build Slide 9: 'From CLI to Web'."""
    clear_slide(slide)

    # Top accent bar (thin blue line at very top)
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, slide_width, Emu(54864))
    bar.fill.solid()
    bar.fill.fore_color.rgb = BLUE_ACCENT
    bar.line.fill.background()

    # Purple accent bar below
    bar2 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Emu(54864), Emu(5486400), Emu(27432))
    bar2.fill.solid()
    bar2.fill.fore_color.rgb = PURPLE_ACCENT
    bar2.line.fill.background()

    # Section label: "Interface Evolution"
    left_margin = Emu(731520)
    txbox = slide.shapes.add_textbox(left_margin, Emu(400000), Emu(3000000), Emu(300000))
    tf = txbox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = "Interface Evolution"
    run.font.size = Pt(12)
    run.font.color.rgb = BLUE_ACCENT
    run.font.bold = False
    run.font.name = 'Calibri'

    # Title: "From CLI to Web"
    txbox2 = slide.shapes.add_textbox(left_margin, Emu(750000), Emu(10000000), Emu(600000))
    tf2 = txbox2.text_frame
    tf2.word_wrap = True
    p2 = tf2.paragraphs[0]
    run2 = p2.add_run()
    run2.text = "From CLI to Web"
    run2.font.size = Pt(28)
    run2.font.color.rgb = DARK_TEXT
    run2.font.bold = True
    run2.font.name = 'Calibri'

    # --- LEFT CARD ---
    card_top = Emu(1700000)
    card_height = Emu(4500000)
    card_gap = Emu(350000)
    card_width = Emu(5100000)
    left_card_left = left_margin

    left_card = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        left_card_left, card_top, card_width, card_height
    )
    left_card.fill.solid()
    left_card.fill.fore_color.rgb = LIGHT_GRAY
    left_card.line.fill.background()

    # Left card content - use a text box overlaid on the card
    card_padding = Emu(250000)
    left_content = slide.shapes.add_textbox(
        left_card_left + card_padding,
        card_top + card_padding,
        card_width - card_padding * 2,
        Emu(1800000)
    )
    tf_lc = left_content.text_frame
    tf_lc.word_wrap = True

    # Card title
    p_title = tf_lc.paragraphs[0]
    p_title.space_after = Pt(10)
    run_t = p_title.add_run()
    run_t.text = "Current: Claude Code (CLI)"
    run_t.font.size = Pt(16)
    run_t.font.color.rgb = PURPLE_ACCENT
    run_t.font.bold = True
    run_t.font.name = 'Calibri'

    # Bullet 1
    add_paragraph(tf_lc, "\u2022  Full power for tech users", Pt(13), DARK_TEXT, space_after=Pt(4))
    # Bullet 2
    add_paragraph(tf_lc, "\u2022  Scriptable automation", Pt(13), DARK_TEXT, space_after=Pt(4))

    # Terminal mockup - dark rectangle
    term_left = left_card_left + Emu(200000)
    term_top = card_top + Emu(2200000)
    term_width = card_width - Emu(400000)
    term_height = Emu(1800000)

    terminal = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        term_left, term_top, term_width, term_height
    )
    terminal.fill.solid()
    terminal.fill.fore_color.rgb = DARK_BG
    terminal.line.fill.background()

    # Terminal text overlay
    term_content = slide.shapes.add_textbox(
        term_left + Emu(180000),
        term_top + Emu(200000),
        term_width - Emu(360000),
        term_height - Emu(300000)
    )
    tf_term = term_content.text_frame
    tf_term.word_wrap = True

    # Line 1: $ claude (green)
    p_t1 = tf_term.paragraphs[0]
    p_t1.space_after = Pt(8)
    run_t1 = p_t1.add_run()
    run_t1.text = "$ claude"
    run_t1.font.size = Pt(12)
    run_t1.font.color.rgb = GREEN_TERM
    run_t1.font.bold = False
    run_t1.font.name = 'Consolas'

    # Line 2: > Find Czech rangefinder companies (white)
    p_t2 = tf_term.add_paragraph()
    p_t2.space_after = Pt(8)
    run_t2 = p_t2.add_run()
    run_t2.text = "> Find Czech rangefinder companies"
    run_t2.font.size = Pt(11)
    run_t2.font.color.rgb = WHITE
    run_t2.font.bold = False
    run_t2.font.name = 'Consolas'

    # Line 3: [Creates 9 leads in database] (green)
    p_t3 = tf_term.add_paragraph()
    p_t3.space_after = Pt(4)
    run_t3 = p_t3.add_run()
    run_t3.text = "[Creates 9 leads in database]"
    run_t3.font.size = Pt(11)
    run_t3.font.color.rgb = GREEN_TERM
    run_t3.font.bold = False
    run_t3.font.name = 'Consolas'

    # --- RIGHT CARD ---
    right_card_left = left_card_left + card_width + card_gap
    right_card = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        right_card_left, card_top, card_width, card_height
    )
    right_card.fill.solid()
    right_card.fill.fore_color.rgb = LIGHT_GRAY
    right_card.line.fill.background()

    # Right card content
    right_content = slide.shapes.add_textbox(
        right_card_left + card_padding,
        card_top + card_padding,
        card_width - card_padding * 2,
        Emu(3200000)
    )
    tf_rc = right_content.text_frame
    tf_rc.word_wrap = True

    # Card title
    p_rt = tf_rc.paragraphs[0]
    p_rt.space_after = Pt(10)
    run_rt = p_rt.add_run()
    run_rt.text = "Coming Q2 2026: Claude Cowork"
    run_rt.font.size = Pt(16)
    run_rt.font.color.rgb = PURPLE_ACCENT
    run_rt.font.bold = True
    run_rt.font.name = 'Calibri'

    # Bullets
    add_paragraph(tf_rc, "\u2022  Web-based interface", Pt(13), DARK_TEXT, space_after=Pt(4))
    add_paragraph(tf_rc, "\u2022  Team collaboration", Pt(13), DARK_TEXT, space_after=Pt(4))
    add_paragraph(tf_rc, "\u2022  Visual lead management", Pt(13), DARK_TEXT, space_after=Pt(4))
    add_paragraph(tf_rc, "\u2022  Non-technical user friendly", Pt(13), DARK_TEXT, space_after=Pt(12))

    # "Same backend - zero migration cost" line
    p_sb = tf_rc.add_paragraph()
    p_sb.space_before = Pt(8)
    run_sb1 = p_sb.add_run()
    run_sb1.text = "Same backend"
    run_sb1.font.size = Pt(12)
    run_sb1.font.color.rgb = DARK_TEXT
    run_sb1.font.bold = True
    run_sb1.font.name = 'Calibri'

    run_sb2 = p_sb.add_run()
    run_sb2.text = " \u2013 zero migration cost"
    run_sb2.font.size = Pt(12)
    run_sb2.font.color.rgb = GRAY_TEXT
    run_sb2.font.bold = False
    run_sb2.font.name = 'Calibri'

    # Page number: "9 / 15"
    pn = slide.shapes.add_textbox(Emu(10515600), Emu(6400800), Emu(1371600), Emu(365760))
    tf_pn = pn.text_frame
    p_pn = tf_pn.paragraphs[0]
    p_pn.alignment = PP_ALIGN.RIGHT
    run_pn = p_pn.add_run()
    run_pn.text = "9 / 15"
    run_pn.font.size = Pt(10)
    run_pn.font.color.rgb = GRAY_TEXT
    run_pn.font.name = 'Calibri'


def build_slide_14(slide, slide_width, slide_height):
    """Build Slide 14: 'Next Steps'."""
    clear_slide(slide)

    # Top accent bar
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, slide_width, Emu(54864))
    bar.fill.solid()
    bar.fill.fore_color.rgb = BLUE_ACCENT
    bar.line.fill.background()

    # Purple accent bar below
    bar2 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Emu(54864), Emu(5486400), Emu(27432))
    bar2.fill.solid()
    bar2.fill.fore_color.rgb = PURPLE_ACCENT
    bar2.line.fill.background()

    # Section label: "Getting Started"
    left_margin = Emu(731520)
    txbox = slide.shapes.add_textbox(left_margin, Emu(400000), Emu(3000000), Emu(300000))
    tf = txbox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = "Getting Started"
    run.font.size = Pt(12)
    run.font.color.rgb = BLUE_ACCENT
    run.font.bold = False
    run.font.name = 'Calibri'

    # Title: "Next Steps"
    txbox2 = slide.shapes.add_textbox(left_margin, Emu(750000), Emu(10000000), Emu(600000))
    tf2 = txbox2.text_frame
    tf2.word_wrap = True
    p2 = tf2.paragraphs[0]
    run2 = p2.add_run()
    run2.text = "Next Steps"
    run2.font.size = Pt(28)
    run2.font.color.rgb = DARK_TEXT
    run2.font.bold = True
    run2.font.name = 'Calibri'

    # --- 5 Step circles with arrows ---
    steps = [
        {"num": "1", "title": "Discovery Call", "line1": "Live demo", "line2": "1 hour"},
        {"num": "2", "title": "Pilot Scope", "line1": "Define test", "line2": "markets"},
        {"num": "3", "title": "Contract", "line1": "Service", "line2": "agreement"},
        {"num": "4", "title": "Deployment", "line1": "Setup +", "line2": "training"},
        {"num": "5", "title": "Go-Live", "line1": "Pilot", "line2": "starts"},
    ]

    # Layout calculations
    circle_diameter = Emu(780000)
    circle_radius = circle_diameter // 2
    arrow_width = Emu(420000)
    arrow_height = Emu(200000)

    # Total horizontal span: 5 circles + 4 arrows + gaps
    gap_circle_arrow = Emu(60000)  # small gap between circle and arrow
    step_unit = circle_diameter + arrow_width + gap_circle_arrow * 2  # one circle + one arrow + gaps
    total_width = step_unit * 4 + circle_diameter  # 4 units + last circle (no arrow after it)

    start_x = (slide_width - total_width) // 2
    circle_center_y = Emu(3100000)  # vertical center of circles
    circle_top = circle_center_y - circle_radius

    for i, step in enumerate(steps):
        # X position for this circle
        cx = start_x + i * step_unit

        # Draw circle
        circle = slide.shapes.add_shape(
            MSO_SHAPE.OVAL,
            cx, circle_top, circle_diameter, circle_diameter
        )
        circle.fill.solid()
        circle.fill.fore_color.rgb = BLUE_ACCENT
        circle.line.fill.background()

        # Number in circle
        tf_c = circle.text_frame
        tf_c.word_wrap = False
        # Vertical centering
        txBody = circle._element.find(qn('p:txBody'))
        if txBody is not None:
            bodyPr = txBody.find(qn('a:bodyPr'))
            if bodyPr is not None:
                bodyPr.set('anchor', 'ctr')

        p_c = tf_c.paragraphs[0]
        p_c.alignment = PP_ALIGN.CENTER
        run_c = p_c.add_run()
        run_c.text = step["num"]
        run_c.font.size = Pt(20)
        run_c.font.color.rgb = WHITE
        run_c.font.bold = True
        run_c.font.name = 'Calibri'

        # Draw arrow (except after last circle)
        if i < 4:
            arrow_x = cx + circle_diameter + gap_circle_arrow
            arrow_y = circle_center_y - arrow_height // 2
            arrow = slide.shapes.add_shape(
                MSO_SHAPE.RIGHT_ARROW,
                arrow_x, arrow_y, arrow_width, arrow_height
            )
            arrow.fill.solid()
            arrow.fill.fore_color.rgb = BLUE_ACCENT
            # Set some transparency (alpha) via XML
            solidFill = arrow._element.find('.//' + qn('a:solidFill'))
            if solidFill is not None:
                srgb = solidFill.find(qn('a:srgbClr'))
                if srgb is not None:
                    alpha_elem = srgb.makeelement(qn('a:alpha'), {})
                    alpha_elem.set('val', '50000')  # 50% opacity
                    srgb.append(alpha_elem)
            arrow.line.fill.background()

        # Title text below circle
        title_width = Emu(1400000)
        title_x = cx + circle_radius - title_width // 2
        title_top = circle_top + circle_diameter + Emu(200000)

        title_box = slide.shapes.add_textbox(title_x, title_top, title_width, Emu(300000))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.alignment = PP_ALIGN.CENTER
        run_title = p_title.add_run()
        run_title.text = step["title"]
        run_title.font.size = Pt(13)
        run_title.font.color.rgb = DARK_TEXT
        run_title.font.bold = True
        run_title.font.name = 'Calibri'

        # Subtitle line 1
        sub_top = title_top + Emu(320000)
        sub_box = slide.shapes.add_textbox(title_x, sub_top, title_width, Emu(400000))
        tf_sub = sub_box.text_frame
        tf_sub.word_wrap = True

        p_s1 = tf_sub.paragraphs[0]
        p_s1.alignment = PP_ALIGN.CENTER
        p_s1.space_after = Pt(2)
        run_s1 = p_s1.add_run()
        run_s1.text = step["line1"]
        run_s1.font.size = Pt(10)
        run_s1.font.color.rgb = MED_GRAY
        run_s1.font.name = 'Calibri'

        # Subtitle line 2
        p_s2 = tf_sub.add_paragraph()
        p_s2.alignment = PP_ALIGN.CENTER
        run_s2 = p_s2.add_run()
        run_s2.text = step["line2"]
        run_s2.font.size = Pt(10)
        run_s2.font.color.rgb = MED_GRAY
        run_s2.font.name = 'Calibri'

    # Page number: "14 / 15"
    pn = slide.shapes.add_textbox(Emu(10515600), Emu(6400800), Emu(1371600), Emu(365760))
    tf_pn = pn.text_frame
    p_pn = tf_pn.paragraphs[0]
    p_pn.alignment = PP_ALIGN.RIGHT
    run_pn = p_pn.add_run()
    run_pn.text = "14 / 15"
    run_pn.font.size = Pt(10)
    run_pn.font.color.rgb = GRAY_TEXT
    run_pn.font.name = 'Calibri'


def main():
    print(f"Opening presentation: {PPTX_PATH}")
    prs = Presentation(PPTX_PATH)

    slide_width = prs.slide_width
    slide_height = prs.slide_height
    print(f"Slide dimensions: {slide_width} x {slide_height} EMU")
    print(f"Total slides: {len(prs.slides)}")

    # Fix Slide 9 (index 8)
    print("\n--- Rebuilding Slide 9 (index 8) ---")
    slide_9 = prs.slides[8]
    build_slide_9(slide_9, slide_width, slide_height)
    print("Slide 9 rebuilt successfully.")

    # Fix Slide 14 (index 13)
    print("\n--- Rebuilding Slide 14 (index 13) ---")
    slide_14 = prs.slides[13]
    build_slide_14(slide_14, slide_width, slide_height)
    print("Slide 14 rebuilt successfully.")

    # Save
    prs.save(PPTX_PATH)
    print(f"\nPresentation saved to: {PPTX_PATH}")

    # Verification
    print("\n=== VERIFICATION ===")
    prs2 = Presentation(PPTX_PATH)

    for idx in [8, 13]:
        slide = prs2.slides[idx]
        print(f"\n--- Slide {idx+1} (index {idx}) ---")
        for shape in slide.shapes:
            shape_desc = f"  Shape: {shape.shape_type}, name='{shape.name}', pos=({shape.left},{shape.top}), size=({shape.width},{shape.height})"
            print(shape_desc)
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        print(f"    Text: '{text[:80]}'")

    print("\nDone. Both slides have been fixed.")


if __name__ == "__main__":
    main()
