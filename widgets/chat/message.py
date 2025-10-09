import ipywidgets as widgets
from IPython.display import display, HTML as DHTML, Javascript, Markdown

MSG_CSS_CLASS = "mljar-chat-msg"

class Message(widgets.HBox):
    def __init__(self, role="user", emoji="👤"):
        super().__init__()
        avatar_bg = "#84c4ff" if role == "user" else "#eeeeee"
        avatar_html = (
            f'<div style="width:36px;height:36px;background:{avatar_bg};'
            f'border-radius:12px;display:flex;align-items:center;justify-content:center;'
            f'box-shadow:0 1px 4px rgba(60,60,60,0.10);">'
            f'<span style="font-size:18px;line-height:1;">{emoji}</span>'
            f'</div>'
        )
        avatar = widgets.HTML(
            value=avatar_html,
            layout=widgets.Layout(margin="0 8px 8px 0", align_self="flex-start"),
        )
        self.output = widgets.Output(
            layout=widgets.Layout(
                align_self="flex-start",
                margin="8px 0 0 0",
                overflow_y="visible",
                overflow_x="visible",
            )
        )
        self.output.add_class(MSG_CSS_CLASS)
        self.children = [avatar, self.output]
        self.layout.align_items = "flex-start"

        # Buffers + mode
        self._mode = None  # one of {"markdown","html","text", None}
        self._md_buffer = ""
        self._html_buffer = ""
        self._text_buffer = ""

    # ------- internal helpers -------

    def _render(self):
        """Re-render the current buffer based on mode."""
        self.output.clear_output(wait=True)
        with self.output:
            if self._mode == "markdown":
                display(Markdown(self._md_buffer))
            elif self._mode == "html":
                display(DHTML(self._html_buffer))
            elif self._mode == "text":
                print(self._text_buffer)

    def _set_mode(self, mode):
        """Switch rendering mode and reset other buffers if needed."""
        if mode not in {"markdown","html","text"}:
            raise ValueError("mode must be 'markdown', 'html', or 'text'")
        if self._mode != mode:
            # switching mode: keep only the relevant buffer
            if mode == "markdown":
                self._md_buffer = ""
            elif mode == "html":
                self._html_buffer = ""
            elif mode == "text":
                self._text_buffer = ""
            self._mode = mode

    # ------- public API -------

    def set_message(self, text=None, html=None, markdown=None):
        """Replace content entirely (choose one of text/html/markdown)."""
        if sum(v is not None for v in (text, html, markdown)) != 1:
            raise ValueError("Provide exactly one of text=, html=, markdown=")

        if markdown is not None:
            self._set_mode("markdown")
            self._md_buffer = markdown
        elif html is not None:
            self._set_mode("html")
            self._html_buffer = html
        elif text is not None:
            self._set_mode("text")
            self._text_buffer = text

        self._render()

    def append_markdown(self, chunk: str):
        """Append a markdown chunk and re-render."""
        self._set_mode("markdown")
        self._md_buffer += chunk
        self._render()

    def append_text(self, chunk: str):
        """Append plain text (no markdown/HTML parsing) and re-render."""
        self._set_mode("text")
        self._text_buffer += chunk
        self._render()

    def append_html(self, chunk: str):
        """Append raw HTML and re-render."""
        self._set_mode("html")
        self._html_buffer += chunk
        self._render()

    def set_bouncing_text(self, text: str, color="#444"):
        """Render any string with bouncing animation per character."""
        spans = []
        for i, ch in enumerate(text):
            # use &nbsp; for spaces so they are visible
            safe_ch = ch if ch != " " else "&nbsp;"
            spans.append(
                f'<span style="animation-delay:{i*0.1:.1f}s">{safe_ch}</span>'
            )
        joined = "".join(spans)
        html = f"""
        <style>
        .bounce-text span {{
            display: inline-block;
            animation: bounce 1.4s infinite;
            font-weight: bold;
            font-size: 1em;
            color: {color};
        }}
        @keyframes bounce {{
            0%, 80%, 100% {{ transform: translateY(0); }}
            40% {{ transform: translateY(-6px); }}
        }}
        </style>
        <div class="bounce-text">{joined}</div>
        """
        self.set_message(html=html)

    def set_gradient_text(self, text: str, colors=None, speed=0.85):
        """
        Render any string with letters cycling through colors.
        - text: string to render
        - colors: list of CSS colors to cycle through (default: light gradient)
        - speed: duration of full cycle in seconds
        """
        if colors is None:
            colors = ["#666", "#999", "#bbb", "#999"]  # subtle gray gradient

        # Create keyframes for gradient animation
        stops = " ".join(f"{i*100//(len(colors)-1)}% {{ color: {c}; }}" 
                         for i, c in enumerate(colors))
        style = f"""
        <style>
        @keyframes colorwave {{
          {stops}
        }}
        .gradient-text span {{
          display:inline-block;
          animation: colorwave {speed}s infinite;
        }}
        </style>
        """

        spans = []
        for i, ch in enumerate(text):
            safe_ch = ch if ch != " " else "&nbsp;"
            spans.append(
                f'<span style="animation-delay:{i*0.1:.1f}s">{safe_ch}</span>'
            )

        html = style + f'<div class="gradient-text">{"".join(spans)}</div>'
        self.set_message(html=html)

    def clear(self):
        self.output.clear_output(wait=True)
    
    def __enter__(self):
        return self.output.__enter__()
    def __exit__(self, exc_type, exc_val, exc_tb):
        return self.output.__exit__(exc_type, exc_val, exc_tb)

