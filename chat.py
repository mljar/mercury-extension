import ipywidgets as widgets
from IPython.display import display, HTML

class ChatMessage(widgets.HBox):
    def __init__(
        self, 
        role="user", 
        emoji=None,
        bubble_color=None,
        text_color=None,
        max_width="700px",
        border_color=None,
    ):
        super().__init__()

        # Defaults for color and border
        if bubble_color is None:
            bubble_color = "#eaf7ff" if role == "user" else "#f5f1ff"
        if text_color is None:
            text_color = "#222"
        if border_color is None:
            border_color = "#aad7ff" if role == "user" else "#ccb7fa"

        # "bubble" is a Box with both HTML (for text) and Output (for rich content)
        self.text_html = widgets.HTML()  # for set_message (plain or simple html)
        self.output = widgets.Output()   # for any print/display/plots

        bubble = widgets.VBox(
            [self.text_html, self.output],
            layout=widgets.Layout(
                min_width="80px",
                max_width=max_width,
                width="100%",
                padding="12px 18px",
                background_color=bubble_color,
                color=text_color,
                border_radius="17px",
                border=f"1.5px solid {border_color}",
                box_shadow="0 2px 8px #0001",
                margin="5px 0 5px 0",
                overflow="visible",
                flex="1 1 auto",
                align_self="flex-start",
            )
        )

        # Optional avatar (emoji)
        avatar = None
        if emoji:
            avatar = widgets.HTML(
                value=f'<div style="font-size:28px; width:40px; height:40px; background:#ececec;'
                      'border-radius:50%; display:flex; align-items:center; justify-content:center;'
                      'box-shadow:0 2px 8px #0001;">'
                      f'{emoji}</div>',
                layout=widgets.Layout(
                    min_width="44px", max_width="44px", width="44px",
                    margin="0 10px 0 0" if role == "ai" else "0 0 0 10px",
                    align_self="flex-start"
                )
            )

        spacer = widgets.Box(layout=widgets.Layout(flex="1 1 0%", width="0px"))

        # Arrange: AI left (avatar | bubble | spacer), User right (spacer | bubble | avatar)
        if role == "ai":
            self.children = ([avatar, bubble, spacer] if avatar else [bubble, spacer])
        else:
            self.children = ([spacer, bubble, avatar] if avatar else [spacer, bubble])

        self.layout.align_items = "flex-start"
        self.layout.width = '100%'
        self.layout.margin = "0"

    def set_message(self, text=None, html=None):
        """Set the plain text or HTML for the bubble (optional)."""
        if html:
            self.text_html.value = html
        elif text:
            # Escape for html safety
            self.text_html.value = f"<pre style='margin:0; font-size:1em; background:none; border:none; color:inherit'>{text}</pre>"
        else:
            self.text_html.value = ""

    def __enter__(self):
        return self.output.__enter__()
    def __exit__(self, exc_type, exc_val, exc_tb):
        return self.output.__exit__(exc_type, exc_val, exc_tb)

class ChatDisplay:
    def __init__(self, placeholder="No messages yet. Start the conversation!"):
        self.messages = []
        self.placeholder = placeholder
        self.placeholder_label = widgets.HTML(
            f'<div style="color:#bbb; text-align:center; padding:48px 0; font-size:1.2em;">'
            f'💬 {self.placeholder}</div>'
        )
        self.vbox = widgets.VBox(
            [self.placeholder_label],
            layout=widgets.Layout(width='100%', padding='8px 4px')
        )
        display(self.vbox)

    def add(self, message):
        self.messages.append(message)
        self.vbox.children = self.messages or [self.placeholder_label]

    def clear(self):
        self.messages.clear()
        self.vbox.children = [self.placeholder_label]
