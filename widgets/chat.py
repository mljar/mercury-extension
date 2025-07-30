import ipywidgets as widgets
from IPython.display import display

class ChatMessage(widgets.HBox):
    def __init__(self, role="user", emoji="👤", max_width="900px"):
        super().__init__()

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
        ) if emoji else ""

        avatar = widgets.HTML(
            value=avatar_html,
            layout=widgets.Layout(
                #width="44px",
                #height="44px",
                #min_width="44px",
                #max_width="44px",
                margin="0 5px 0 0",
                align_self="flex-start"
            )
        ) if emoji else None

        # ---- Bubble wrapper (for style only) ----
        self.output = widgets.Output()

        bubble_html_style = (
            "background:#fff;"
            "border-radius:13px;"
            "box-shadow:0 2px 12px rgba(60,60,60,0.10);"
            "padding:14px 20px;"
            "margin:7px 0;"
            "color:#232323;"
            "font-family:inherit;"
            "font-size:1.04em;"
            "white-space:normal;"
            "word-break:break-word;"
        )

        # This HTML just acts as a wrapper for style
        self.bubble_wrapper = widgets.HTML(
            value=f'<div style="{bubble_html_style}"></div>',
            layout=widgets.Layout(
                min_width="100px",
                max_width=max_width,
                width="auto",
                flex="1 1 auto",
                align_self="flex-start"
            )
        )

        # Place output **on top of** the HTML styled bubble via VBox, and make wrapper transparent so only Output is visible inside styled div
        self.bubble = widgets.Box(
            [self.output],
            layout=widgets.Layout(
                min_width="100px",
                max_width=max_width,
                width="auto",
                flex="1 1 auto",
                align_self="flex-start",
                padding="5px 0px 0px 0px",
                margin="0"
            )
        )

        # We'll use HBox to put avatar, then a "bubble container" (which is a styled HTML bubble that *contains* Output)
        class BubbleContainer(widgets.Box):
            def __init__(self, bubble_widget):
                super().__init__([bubble_widget])
                self.add_class("bubble-container")
                self.layout = widgets.Layout(
                    min_width="100px",
                    max_width=max_width,
                    width="auto",
                    flex="1 1 auto",
                    align_self="flex-start",
                    padding="0",
                    margin="0"
                )
            def _repr_html_(self):
                # Trick: style parent div, but return children as content
                return f'<div style="{bubble_html_style}">{self.children[0]._repr_html_()}</div>'

        bubble_container = BubbleContainer(self.bubble)

        spacer = widgets.Box(layout=widgets.Layout(flex="1 1 0%", width="0px"))
        self.children = [avatar, bubble_container, spacer] if avatar else [bubble_container, spacer]
        self.layout.align_items = "flex-start"
        self.layout.width = "100%"
        self.layout.margin = "5px"

    def set_message(self, text=None, html=None):
        """For convenience: print Markdown, text, or HTML into the output."""
        self.output.clear_output(wait=True)
        with self.output:
            if html:
                from IPython.display import HTML as DHTML
                display(DHTML(html))
            elif text:
                print(text)

    def __enter__(self):
        return self.output.__enter__()
    def __exit__(self, exc_type, exc_val, exc_tb):
        return self.output.__exit__(exc_type, exc_val, exc_tb)

class ChatDisplay:
    def __init__(self, placeholder="💬 No messages yet. Start the conversation!"):
        self.messages = []
        self.placeholder_label = widgets.HTML(
            f'''
            <div style="
              color:#b5b5b5;
              text-align:center;
              padding:40px 0;
              font-size:1.1em;
              background:#fff;
            ">
              {placeholder}
            </div>
            '''
        )
        self.vbox = widgets.VBox(
            [self.placeholder_label],
            layout=widgets.Layout(
                width='100%',
                padding='4px 4px',
                background_color='#fff'
            )
        )
        display(self.vbox)

    def add(self, message: ChatMessage):
        self.messages.append(message)
        self.vbox.children = self.messages or [self.placeholder_label]

    def clear(self):
        self.messages.clear()
        self.vbox.children = [self.placeholder_label]
