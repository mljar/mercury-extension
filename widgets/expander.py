import anywidget
import traitlets
import ipywidgets as widgets
from IPython.display import display

from .manager import WidgetsManager, MERCURY_MIMETYPE
from .theme import THEME

def _ensure_global_expander_styles():
    css = f"""
    <style>
      .mljar-expander-box {{
        width: 100%;
        border: 1px solid {THEME.get('border_color', '#ddd')};
        border-radius: {THEME.get('border_radius', '8px')};
        background: {THEME.get('panel_bg', '#fff')};
        overflow: hidden;
      }}

      /* Smoother expand/collapse
         - single primary animator: max-height
         - gentle "spring" easing
         - perf hints via will-change + content-visibility
      */
      .mljar-expander-content {{
        width: 100%;
        position: relative;
        box-sizing: border-box;
        overflow: hidden;
        max-height: 0;
        opacity: 0;
        padding: 0 10px;
        /* MAIN transition: use a springy cubic-bezier */
        transition:
          max-height 220ms cubic-bezier(0.22, 1, 0.36, 1),
          padding-top 220ms cubic-bezier(0.22, 1, 0.36, 1),
          padding-bottom 220ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 120ms linear;
        will-change: max-height, padding-top, padding-bottom;
        content-visibility: auto;          /* paint only when visible */
        contain-intrinsic-size: 1px 200px; /* prevents layout jank while closed */
      }}

      .mljar-expander-content > * {{
        overflow: hidden;
        min-height: 0;
        box-sizing: border-box;
      }}

      /* Divider fades in; doesn't affect layout */
      .mljar-expander-content::before {{
        content: "";
        position: absolute;
        left: 0; right: 0; top: 0;
        height: 1px;
        background: {THEME.get('border_color', '#ddd')};
        opacity: 0;
        transition: opacity 220ms linear;
        pointer-events: none;
      }}

      /* OPEN: effectively "auto" height without the pop */
      .mljar-expander-content.is-open {{
        max-height: 1000vh;
        opacity: 1;
        padding-top: 10px;
        padding-bottom: 10px;
      }}
      .mljar-expander-content.is-open::before {{
        opacity: 1;
      }}

      /* Respect users who prefer reduced motion */
      @media (prefers-reduced-motion: reduce) {{
        .mljar-expander-content {{
          transition: none;
        }}
        .mljar-expander-content::before {{
          transition: none;
        }}
      }}
    </style>
    """
    style_html = widgets.HTML(css)
    display(style_html)


def Expander(label="Details", expanded=False, key=""):
    """
    Displays an expander with one unified border and smooth animation.

    IMPORTANT: We DO NOT display() on the cached path to avoid duplicates.
    Use a stable `key` to make re-runs reuse the same cached instance.
    """
    _ensure_global_expander_styles()

    code_uid = WidgetsManager.get_code_uid("Expander", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        # Don't display again — that would append another copy in output.
        # Just return the existing Output area so user can write to it.
        _box, out, _header, _content_box = cached
        display(_box)
        return out

    header = _ExpanderHeaderWidget(label=label, expanded=expanded)

    out = widgets.Output()
    out.layout.width = "100%"

    content_box = widgets.Box([out], layout=widgets.Layout(width="100%"))
    content_box.add_class("mljar-expander-content")
    if expanded:
        content_box.add_class("is-open")

    def _on_expand_change(change):
        if change["new"]:
            content_box.add_class("is-open")
        else:
            content_box.remove_class("is-open")
    header.observe(_on_expand_change, names="expanded")

    box = widgets.VBox([header, content_box], layout=widgets.Layout(width="100%"))
    box.add_class("mljar-expander-box")

    # Only display on first creation
    display(box)
    WidgetsManager.add_widget(code_uid, (box, out, header, content_box))
    return out


class _ExpanderHeaderWidget(anywidget.AnyWidget):
    label = traitlets.Unicode("Details").tag(sync=True)
    expanded = traitlets.Bool(False).tag(sync=True)
    custom_css = traitlets.Unicode(default_value="").tag(sync=True)
    position = traitlets.Enum(
        values=["sidebar", "inline", "bottom"],
        default_value="sidebar",
        help="Widget placement: sidebar, inline, or bottom",
    ).tag(sync=True)

    _esm = """
    function render({ model, el }) {
      const header = document.createElement("button");
      header.type = "button";
      header.classList.add("mljar-expander-header");
      header.setAttribute("aria-expanded", String(model.get("expanded")));

      const icon = document.createElement("span");
      icon.classList.add("mljar-expander-icon");
      const text = document.createElement("span");
      text.classList.add("mljar-expander-label");
      text.textContent = model.get("label") || "Details";

      header.appendChild(icon);
      header.appendChild(text);
      el.appendChild(header);

      function syncUI() {
        const isOpen = !!model.get("expanded");
        header.setAttribute("aria-expanded", String(isOpen));
        header.classList.toggle("is-open", isOpen);
      }
      syncUI();

      header.addEventListener("click", () => {
        const next = !model.get("expanded");
        model.set("expanded", next);
        model.save_changes();
      });

      model.on("change:expanded", syncUI);
      model.on("change:label", () => {
        text.textContent = model.get("label") || "Details";
      });

      const css = model.get("custom_css");
      if (css && css.trim().length > 0) {
        const styleTag = document.createElement("style");
        styleTag.textContent = css;
        el.appendChild(styleTag);
      }
    }
    export default { render };
    """

    _css = f"""
    .mljar-expander-header {{
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      background: {THEME.get('panel_bg_hover', '#f7f7f9')};
      border: 0;
      padding: 8px 10px;
      cursor: pointer;
      text-align: left;
      font-family: {THEME.get('font_family', 'Arial, sans-serif')};
      font-size: {THEME.get('font_size', '14px')};
      font-weight: {THEME.get('font_weight', '600')};
      color: {THEME.get('text_color', '#222')};
      transition: background 0.15s ease;
      position: relative;
    }}
    .mljar-expander-header:hover {{
      background: {THEME.get('panel_bg_hover_2', '#efefef')};
    }}
    .mljar-expander-icon {{
      display: inline-block;
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid {THEME.get('primary_color', '#007bff')};
      transform: rotate(0deg);
      transition: transform 0.15s ease;
    }}
    .mljar-expander-header.is-open .mljar-expander-icon {{
      transform: rotate(180deg);
    }}
    .mljar-expander-label {{
      flex: 1 1 auto;
    }}
    """

    def _repr_mimebundle_(self, **kwargs):
        data = super()._repr_mimebundle_()
        if len(data) > 1:
            import json
            mercury_mime = {
                "widget": type(self).__qualname__,
                "model_id": self.model_id,
                "position": self.position,
            }
            data[0][MERCURY_MIMETYPE] = json.dumps(mercury_mime, indent=4)
        return data
