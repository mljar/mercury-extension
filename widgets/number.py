import anywidget
import traitlets
import json
from IPython.display import display
from .manager import WidgetsManager, MERCURY_MIMETYPE
from .theme import THEME


def NumberInput(*args, key="", **kwargs):
    code_uid = WidgetsManager.get_code_uid("NumberInput", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        display(cached)
        return cached
    instance = NumberInputWidget(*args, **kwargs)
    WidgetsManager.add_widget(code_uid, instance)
    display(instance)
    return instance


class NumberInputWidget(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
      let container = document.createElement("div");
      container.classList.add("mljar-number-container");

      let topLabel = document.createElement("div");
      topLabel.classList.add("mljar-number-label");
      topLabel.innerHTML = model.get("label") || "Enter number";

      let input = document.createElement("input");
      input.type = "number";
      input.min = model.get("min");
      input.max = model.get("max");
      input.step = model.get("step");
      input.value = model.get("value");
      input.classList.add("mljar-number-input");

      let debounceTimer = null;
      input.addEventListener("input", () => {
        let val = Number(input.value);
        const min = Number(model.get("min"));
        const max = Number(model.get("max"));
        if (!isNaN(min) && val < min) val = min;
        if (!isNaN(max) && val > max) val = max;
        input.value = val;
        model.set("value", val);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => model.save_changes(), 100);
      });

      model.on("change:value", () => {
        input.value = model.get("value");
      });

      container.appendChild(topLabel);
      container.appendChild(input);
      el.appendChild(container);
    }
    export default { render };
    """

    _css = f"""
    .mljar-number-container {{
      display: flex;
      flex-direction: column;
      width: 100%;
      font-family: {THEME.get('font_family', 'Arial, sans-serif')};
      font-size: {THEME.get('font_size', '14px')};
      margin-bottom: 8px;
    }}
    .mljar-number-label {{
      margin-bottom: 4px;
      font-weight: bold;
    }}
    .mljar-number-input {{
      padding: 6px;
      border: 1px solid {THEME.get('border_color', '#ccc')};
      border-radius: {THEME.get('border_radius', '6px')};
    }}
    """

    value = traitlets.Float(0).tag(sync=True)
    min = traitlets.Float(0).tag(sync=True)
    max = traitlets.Float(100).tag(sync=True)
    step = traitlets.Float(1).tag(sync=True)
    label = traitlets.Unicode("Enter number").tag(sync=True)
    custom_css = traitlets.Unicode(default_value="", help="Extra CSS").tag(sync=True)
    position = traitlets.Enum(
        values=["sidebar", "inline", "bottom"],
        default_value="sidebar",
        help="Widget placement: sidebar, inline, or bottom"
    ).tag(sync=True)

    def _repr_mimebundle_(self, **kwargs):
        data = super()._repr_mimebundle_(**kwargs)
        if len(data) > 1:
            mercury_mime = {
                "widget": type(self).__qualname__,
                "model_id": self.model_id,
                "position": self.position
            }
            data[0][MERCURY_MIMETYPE] = json.dumps(mercury_mime, indent=4)
            if "text/plain" in data[0]:
                del data[0]["text/plain"]
        return data
