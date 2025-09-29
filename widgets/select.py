import anywidget
import traitlets
import json
from IPython.display import display
from .manager import WidgetsManager, MERCURY_MIMETYPE
from .theme import THEME


def Select(key="", **kwargs):
    code_uid = WidgetsManager.get_code_uid("Select", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        display(cached)
        return cached
    instance = SelectWidget(**kwargs)
    WidgetsManager.add_widget(code_uid, instance)
    display(instance)
    return instance


class SelectWidget(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
      let container = document.createElement("div");
      container.classList.add("mljar-select-container");

      if (model.get("label")) {
        let topLabel = document.createElement("div");
        topLabel.classList.add("mljar-select-label");
        topLabel.innerHTML = model.get("label");
        container.appendChild(topLabel);
      }

      let select = document.createElement("select");
      select.classList.add("mljar-select-input");

      if (model.get("disabled")) {
        select.disabled = true;
      }

      const choices = model.get("choices") || [];
      const currentValue = model.get("value");

      choices.forEach(choice => {
        let option = document.createElement("option");
        option.value = choice;
        option.innerHTML = choice;
        if (choice === currentValue) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      let debounceTimer = null;
      select.addEventListener("change", () => {
        const val = select.value;
        model.set("value", val);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            model.save_changes();
        }, 100);
      });

      model.on("change:value", () => {
        select.value = model.get("value");
      });

      container.appendChild(select);
      el.appendChild(container);

      const css = model.get("custom_css");
      if (css && css.trim().length > 0) {
        let styleTag = document.createElement("style");
        styleTag.textContent = css;
        el.appendChild(styleTag);
      }
    }
    export default { render };
    """

    _css = f"""
    .mljar-select-container {{
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
        font-family: {THEME.get('font_family', 'Arial, sans-serif')};
        font-size: {THEME.get('font_size', '14px')};
        color: {THEME.get('text_color', '#222')};
        margin-bottom: 8px;
    }}

    .mljar-select-label {{
        margin-bottom: 4px;
        font-weight: bold;
    }}

    .mljar-select-input {{
        width: 100%;
        min-width: 120px;
        padding: 6px;
        border-radius: {THEME.get('border_radius', '6px')};
        border: 1px solid {THEME.get('border_color', '#ccc')};
        background: #fff;
    }}

    .mljar-select-input:disabled {{
        background: #f5f5f5;
        color: #888;
    }}
    """

    value = traitlets.Unicode(default_value="").tag(sync=True)
    choices = traitlets.List(traitlets.Unicode(), default_value=[]).tag(sync=True)
    label = traitlets.Unicode(default_value="Select option").tag(sync=True)
    disabled = traitlets.Bool(default_value=False).tag(sync=True)
    hidden = traitlets.Bool(default_value=False).tag(sync=True)
    custom_css = traitlets.Unicode(default_value="", help="Extra CSS").tag(sync=True)
    position = traitlets.Enum(
        values=["sidebar", "inline", "bottom"],
        default_value="sidebar",
        help="Widget placement"
    ).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if (self.value is None or self.value == "") and len(self.choices) > 0:
            self.value = self.choices[0]
        elif self.value not in self.choices and len(self.choices) > 0:
            self.value = self.choices[0]

    def _repr_mimebundle_(self, **kwargs):
        data = super()._repr_mimebundle_(**kwargs)
        if len(data) > 1:
            mercury_mime = {
                "widget": type(self).__qualname__,
                "model_id": self.model_id,
                "position": self.position,
            }
            data[0][MERCURY_MIMETYPE] = json.dumps(mercury_mime, indent=4)
            # if "text/plain" in data[0]:
            #     del data[0]["text/plain"]
        return data
