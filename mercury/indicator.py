class Indicator:
    GREEN = "#00B275"
    RED = "#FF6384"
    BG_GREEN = "rgba(0, 178, 117, 0.12)"
    BG_RED = "rgba(255, 99, 132, 0.13)"

    def __init__(
        self,
        value,
        label="",
        delta=None,
        background_color="#fff",
        border_color="#ebebeb",
        value_color="#222",
        label_color="#555"
    ):
        self.value = value
        self.label = label
        self.delta = delta
        self.background_color = background_color
        self.border_color = border_color
        self.value_color = value_color
        self.label_color = label_color
        self.position = None

    def styles(self):
        return """
        <style scoped>
        .mljar-indicator-row {
            width: 100%;
            display: flex;
            flex-direction: row;
            gap: 5px;
            justify-content: flex-start;
        }
        @media (max-width: 800px) {
            .mljar-indicator-row {
                flex-direction: column;
            }
        }
        .mljar-indicator-card {
            flex: 1 1 0;
            background: var(--bg, #fff);
            border: 1px solid var(--border, #ebebeb);
            border-radius: 12px;
            padding: 26px 24px 18px 24px;
            margin: 8px;
            text-align: center;                
            min-width: 180px;
            max-width: 240px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .mljar-indicator-title {
            font-size: 1.3em !important;
            color: var(--label, #555);
            margin-bottom: 10px;
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif !important;
        }
        .mljar-indicator-value {
            font-size: 2.7em;
            color: var(--value, #222);
            font-family: 'Menlo', 'Consolas', monospace;
            margin-bottom: 12px;
            letter-spacing: 1px;
        }
        .mljar-indicator-delta {
            display: inline-block;
            padding: 0.28em 1.1em 0.28em 1.1em;
            font-size: 1em;
            border-radius: 2em;
            margin-bottom: 4px;
            font-family: 'Menlo', monospace;
            font-weight: bold;
        }
        .mljar-indicator-delta.up {
            background: var(--bg-green, rgba(0,178,117,0.12));
            color: var(--green, #00B275);
        }
        .mljar-indicator-delta.down {
            background: var(--bg-red, rgba(255,99,132,0.13));
            color: var(--red, #FF6384);
        }
        </style>
        """

    def _repr_html_(self):
        if isinstance(self.value, list):
            cards = ""
            for v in self.value:
                if isinstance(v, Indicator):
                    cards += v._repr_html_()
            return f"{self.styles()}<div class='mljar-indicator-row'>{cards}</div>"

        delta_html = ""
        if self.delta is not None:
            try:
                d = float(self.delta)
                up = d > 0
                delta_text = f"<span style='font-size:1.15em'>{'&#8593;' if up else '&#8595;'}</span> {abs(d)}%"
                cls = "mljar-indicator-delta up" if up else "mljar-indicator-delta down"
                delta_html = f"<div class='{cls}'>{delta_text}</div>"
            except Exception:
                delta_html = f"<div class='mljar-indicator-delta'>{self.delta}</div>"

        label_html = f"<div class='mljar-indicator-title'>{self.label}</div>" if self.label else ""
        value_html = f"<div class='mljar-indicator-value'>{self.value}</div>"

        return f"""{self.styles()}
<div class="mljar-indicator-card"
     style="--bg:{self.background_color};--border:{self.border_color};--value:{self.value_color};--label:{self.label_color};--green:{self.GREEN};--bg-green:{self.BG_GREEN};--red:{self.RED};--bg-red:{self.BG_RED}">
    {label_html}
    {value_html}
    {delta_html}
</div>
"""

