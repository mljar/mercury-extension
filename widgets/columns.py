import ipywidgets as widgets
from IPython.display import display

from .manager import WidgetsManager

def Columns(n=2, min_width='240px', gap='16px', key=""):
    code_uid = WidgetsManager.get_code_uid("Columns", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        box, outs = cached
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
        out.layout.min_width = min_width
        out.layout.flex = '1 1 0px'
    display(box)
    WidgetsManager.add_widget(code_uid, (box, tuple(outs)))
    return tuple(outs)