import ipywidgets as widgets
from IPython.display import display

class Columns:
    def __new__(cls, n=2, min_width='240px', gap='16px'):
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
            out.layout.flex = '1 1 0px'  # Equal width, flexible
        display(box)
        return tuple(outs)