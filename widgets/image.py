import os
import base64
import mimetypes
import ipywidgets as widgets
from IPython.display import display
from html import escape

from .manager import WidgetsManager
from .theme import THEME


# ---------- Global CSS (injected once) ----------
def _ensure_global_image_styles():
    css = f"""
    <style>
      .mljar-image-card {{
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border: 1px solid {THEME.get('border_color', '#ddd')};
        border-radius: {THEME.get('border_radius', '8px')};
        background: {THEME.get('panel_bg', '#fff')};
        padding: 8px;
        box-sizing: border-box;
        overflow: hidden;
      }}

      .mljar-image-wrap {{
        width: 100%;
        position: relative;
        overflow: hidden;
        border-radius: {THEME.get('border_radius', '8px')};
      }}

      .mljar-image-wrap img {{
        display: block;
        max-width: 100%;
        height: auto;
        object-fit: contain;
      }}

      .mljar-image-caption {{
        font-family: {THEME.get('font_family', 'Arial, sans-serif')};
        font-size: {THEME.get('font_size', '14px')};
        color: {THEME.get('muted_text_color', THEME.get('text_color', '#222'))};
        line-height: 1.3;
      }}

      /* neutralize default ipywidgets margins to prevent x-scroll */
      .mljar-image-card :is(.jupyter-widgets, .widget-box, .widget-hbox, .widget-vbox) {{
        margin-left: 0 !important;
        margin-right: 0 !important;
        max-width: 100%;
        box-sizing: border-box;
      }}
    </style>
    """
    display(widgets.HTML(css))


def _path_to_data_uri(path: str) -> str:
    """Read local file and return a data: URI with guessed MIME type."""
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        # fallback to a safe default
        mime = "image/png"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _img_src(url_or_path: str) -> str:
    """Return an <img> src from URL or local file path (as data URI)."""
    if isinstance(url_or_path, str) and url_or_path.lower().startswith(("http://", "https://")):
        return url_or_path
    if isinstance(url_or_path, str) and os.path.exists(url_or_path):
        return _path_to_data_uri(url_or_path)
    # if it's neither, just return as-is; browser will try to resolve (or show broken-img icon)
    return url_or_path


# ---------- Public API ----------
def ImageCard(src: str, caption: str = "", fit: str = "contain",
              width: str = "100%", height: str | None = None,
              rounded: bool = True, key: str = "") -> widgets.VBox:
    """
    Display an image from URL or local file with a caption.

    Parameters
    ----------
    src : str
        URL (http/https) or local file path.
    caption : str
        Optional caption text shown below the image.
    fit : str
        CSS object-fit value for the image: 'contain', 'cover', 'fill', 'none', 'scale-down'.
    width : str
        CSS width for the outer card (e.g. '100%', '400px').
    height : str | None
        Fixed CSS height for the image area (e.g. '240px'). If None, image is auto height.
    rounded : bool
        Apply theme border radius to the image area.
    key : str
        Stable cache key to reuse the same widget instance.

    Returns
    -------
    ipywidgets.VBox
        The image card widget (already displayed).
    """
    _ensure_global_image_styles()

    code_uid = WidgetsManager.get_code_uid("ImageCard", key=key or src or "image")
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        card = cached
        display(card)
        return card

    # Build <img> tag
    img_src = _img_src(src)
    style_parts = [f"object-fit:{fit};", "width:100%;", "height:auto;"]
    if height:
        # if fixed height desired, let object-fit control cropping/containment
        style_parts = [f"object-fit:{fit};", "width:100%;", f"height:{height};"]
    img_html = f'<img src="{escape(img_src, quote=True)}" alt="image" style={"".join(style_parts)} />'

    # Optional rounded override
    img_wrap = widgets.HTML(
        value=f'<div class="mljar-image-wrap" style="{"border-radius:"+THEME.get("border_radius","8px")+";" if rounded else "border-radius:0;"}">{img_html}</div>'
    )

    # Caption
    cap_html = widgets.HTML(
        value=f'<div class="mljar-image-caption">{escape(caption)}</div>' if caption else ""
    )

    # Card
    children = [img_wrap] + ([cap_html] if caption else [])
    card = widgets.VBox(children, layout=widgets.Layout(width=width))
    card.add_class("mljar-image-card")

    display(card)
    WidgetsManager.add_widget(code_uid, card)
    return card
