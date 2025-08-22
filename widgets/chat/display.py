import ipywidgets as widgets
from IPython.display import display

from .message import ChatMessage

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
