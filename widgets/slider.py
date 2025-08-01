import anywidget
import traitlets

from .manager import WidgetsManager, MERCURY_MIMETYPE

def Slider(*args, key="", **kwargs):
    code_uid = WidgetsManager.get_code_uid("Slider", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        display(cached)
        return cached
    instance = SliderWidget(*args, **kwargs)
    WidgetsManager.add_widget(code_uid, instance)
    display(instance)
    return instance

class SliderWidget(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
      // Container for the whole widget
      let container = document.createElement("div");
      container.classList.add("mljar-slider-container");

      // Top label (left-aligned)
      let topLabel = document.createElement("div");
      topLabel.classList.add("mljar-slider-top-label");
      topLabel.innerHTML = model.get("label") || "Select number";

      // Row: slider and value label
      let sliderRow = document.createElement("div");
      sliderRow.classList.add("mljar-slider-row");

      // Slider input
      let slider = document.createElement("input");
      slider.type = "range";
      slider.min = model.get("min");
      slider.max = model.get("max");
      slider.value = model.get("value");
      slider.classList.add("mljar-slider-input");

      // Value label (to the right of slider)
      let valueLabel = document.createElement("span");
      valueLabel.classList.add("mljar-slider-value-label");
      valueLabel.innerHTML = model.get("value");

      //slider.addEventListener("input", () => {
      //  model.set("value", Number(slider.value));
      //  model.save_changes();
      //});
      let debounceTimer = null;
      slider.addEventListener("input", () => {
        model.set("value", Number(slider.value));
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            model.save_changes();
        }, 100);
      });

      model.on("change:value", () => {
        slider.value = model.get("value");
        valueLabel.innerHTML = model.get("value");
      });

      // Assemble row
      sliderRow.appendChild(slider);
      sliderRow.appendChild(valueLabel);

      // Build structure
      container.appendChild(topLabel);
      container.appendChild(sliderRow);
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
    .mljar-slider-container {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
        min-width: 120px;
    }
    .mljar-slider-top-label {
        margin-bottom: 6px;
        font-weight: bold;
        text-align: left;
        width: 100%;
    }
    .mljar-slider-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100%;
    }
    .mljar-slider-input {
        flex: 1 1 auto;
        min-width: 60px;
        max-width: 100%;
        margin-right: 16px;
    }
    .mljar-slider-value-label {
        font-weight: bold;
        font-size: 1.1em;
        min-width: 32px;
        text-align: left;
        margin-left: 8px;
        white-space: nowrap;
    }
    """
    

    value = traitlets.Int(0).tag(sync=True)
    min = traitlets.Int(0).tag(sync=True)
    max = traitlets.Int(100).tag(sync=True)
    label = traitlets.Unicode("Select number").tag(sync=True)
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
            #if "text/plain" in data:
            #    del data["text/plain"]

        return data
