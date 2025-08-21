import ipywidgets as widgets
from IPython.display import display, HTML, Javascript
from .manager import WidgetsManager
from .theme import THEME

def _inject_theme():
    css = f"""
    .mljar-output {{
        border-radius: {THEME.get("border_radius", "6px")};
        overflow: hidden;
        border: {"1px solid " + THEME.get("border_color", "#ccc") if THEME.get("border_visible", True) else "none"};
        background-color: {THEME.get("widget_background_color", "#fff")};
        padding: 8px;
        color: {THEME.get("text_color", "#222")};
        font-family: {THEME.get("font_family", "Arial, sans-serif")};
        font-size: {THEME.get("font_size", "14px")};
    }}
    """
    js = f"""
    (function() {{
        let old = document.getElementById("mljar-theme");
        if (old) {{
            old.innerHTML = `{css}`;
        }} else {{
            let style = document.createElement("style");
            style.id = "mljar-theme";
            style.innerHTML = `{css}`;
            document.head.appendChild(style);
        }}
    }})();
    """
    display(Javascript(js))

def Columns(n=2, min_width="240px", gap="16px", key=""):

    _inject_theme() 

    code_uid = WidgetsManager.get_code_uid("Columns", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        box, outs = cached
        display(box)
        return outs

    outs = []
    for _ in range(n):
        out = widgets.Output()
        out.add_class("mljar-output")   
        out.layout.flex = "1 1 0px"
        out.layout.min_width = min_width
        outs.append(out)

    box = widgets.HBox(
        outs,
        layout=widgets.Layout(
            width="100%",
            display="flex",
            flex_flow="row wrap",
            gap=gap,
            align_items="stretch",
        ),
    )

    display(box)
    WidgetsManager.add_widget(code_uid, (box, tuple(outs)))
    return tuple(outs)
