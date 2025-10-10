import ipywidgets as widgets
from IPython.display import HTML, display

from .manager import WidgetsManager

from .theme import THEME


def display_style():
    """Inject custom CSS styles for MLJAR widgets based on the active theme."""
    border_radius = THEME.get("border_radius", "4px")

    css = f"""
    <style>
    .mljar-column {{
        border-radius: {border_radius} !important;
    }}
    </style>
    """

    display(HTML(css))
    

def Columns(n=2, min_width='240px', gap='16px', border='1px solid lightgray', key=""):
    """
    Create a responsive row of Output widgets.

    Parameters
    ----------
    n : int
        Number of columns.
    min_width : str
        Minimum width for each column (e.g. '240px').
    gap : str
        Gap between columns (e.g. '16px').
    border : str or None
        CSS border style (e.g. '1px solid lightgray').
        Set to None or '' to disable borders.
    key : str
        Cache key for reuse.
    """
    code_uid = WidgetsManager.get_code_uid("Columns", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        box, outs = cached
        display_style()
        display(box)
        return outs

    outs = [widgets.Output() for _ in range(n)]
    box = widgets.HBox(
        outs,
        layout=widgets.Layout(
            width='100%',
            display='flex',
            flex_flow='row wrap',
            gap=gap,
            align_items='stretch',
        )
    )

    for out in outs:
        # rozmiary / układ
        out.layout.min_width = min_width
        out.layout.flex = '1 1 0px'

        # klasa CSS dla każdej kolumny
        out.add_class('mljar-column')

        # opcjonalne obramowanie
        if border:
            out.layout.border = border
            out.layout.padding = '4px'
            out.layout.box_sizing = 'border-box'

    display_style()
    display(box)
    WidgetsManager.add_widget(code_uid, (box, tuple(outs)))
    return tuple(outs)
