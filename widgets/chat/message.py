import ipywidgets as widgets
from IPython.display import display, HTML as DHTML

class ChatMessage(widgets.HBox):
    def __init__(self, role="user", emoji="👤"):
        super().__init__()

        # Avatar
        avatar_bg = "#84c4ff" if role == "user" else "#eeeeee"
        avatar_html = (
            f'<div style="'
            f'width:36px;height:36px;'
            f'background:{avatar_bg};'
            f'border-radius:12px;'
            f'display:flex;align-items:center;justify-content:center;'
            f'box-shadow:0 1px 4px rgba(60,60,60,0.10);'
            f'">'
            f'<span style="font-size:18px;line-height:1;">{emoji}</span>'
            f'</div>'
        )
        avatar = widgets.HTML(
            value=avatar_html,
            layout=widgets.Layout(margin="0px 8px 8px 0px", align_self="flex-start")
        )

        # Message output
        self.output = widgets.Output(
            layout=widgets.Layout(
                align_self="flex-start",
                margin="8px 0px 0px 0px"
            )
        )

        # Final layout: icon left, message right
        self.children = [avatar, self.output]
        self.layout.align_items = "flex-start"
        # self.layout.width = "100%"
        # self.layout.margin = "5px"

    def set_message(self, text=None, html=None):
        self.output.clear_output(wait=True)
        with self.output:
            if html:
                display(DHTML(html))
            elif text:
                print(text)

    def __enter__(self):
        return self.output.__enter__()
    def __exit__(self, exc_type, exc_val, exc_tb):
        return self.output.__exit__(exc_type, exc_val, exc_tb)
