import anywidget
import traitlets

from .manager import WidgetsManager, MERCURY_MIMETYPE

def TextInput(*args, key="", **kwargs):
    code_uid = WidgetsManager.get_code_uid("TextInput", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        display(cached)
        return cached
    instance = TextInputWidget(*args, **kwargs)
    WidgetsManager.add_widget(code_uid, instance)
    display(instance)
    return instance

class TextInputWidget(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
      // Container
      let container = document.createElement("div");
      container.classList.add("mljar-textinput-container");

      // Label
      let topLabel = document.createElement("div");
      topLabel.classList.add("mljar-textinput-top-label");
      topLabel.innerHTML = model.get("label") || "Enter text";

      // Always Input
      let input = document.createElement("input");
      input.type = "text";
      input.value = model.get("value");
      input.classList.add("mljar-textinput-input");

      let debounceTimer = null;
      input.addEventListener("input", () => {
        model.set("value", input.value);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          model.save_changes();
        }, 100);
      });

      model.on("change:value", () => {
        input.value = model.get("value");
      });

      // Build
      container.appendChild(topLabel);
      container.appendChild(input);
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
    _css = """
    .mljar-textinput-container {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
        min-width: 120px;
    }
    .mljar-textinput-top-label {
        margin-bottom: 6px;
        font-weight: bold;
        text-align: left;
        width: 100%;
    }
    .mljar-textinput-input {
        width: 100%;
        font-size: 1em;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 6px 10px;
        min-height: 1.6em;
        box-sizing: border-box;
    }
    """

    value = traitlets.Unicode("").tag(sync=True)
    label = traitlets.Unicode("Enter text").tag(sync=True)
    custom_css = traitlets.Unicode(default_value="", help="Extra CSS to append to default styles").tag(sync=True)
    position = traitlets.Enum(
        values=["sidebar", "inline", "bottom"],
        default_value="sidebar",
        help="Widget placement: sidebar, inline, or bottom"
    ).tag(sync=True)

    def _repr_mimebundle_(self, **kwargs):
        data = super()._repr_mimebundle_()
        if len(data) > 1:
            mercury_mime = {
                "widget": type(self).__qualname__,
                "model_id": self.model_id,
                "position": self.position
            }
            import json
            data[0][MERCURY_MIMETYPE] = json.dumps(mercury_mime, indent=4)
        return data
