import anywidget
import traitlets
from IPython.display import display

from .manager import WidgetsManager, MERCURY_MIMETYPE

# Helper class for per-file access
class UploadedFile:
    def __init__(self, name, value):
        self.name = name
        self.value = bytes(value)

    def __repr__(self):
        return f"UploadedFile(name={self.name!r}, value=<{len(self.value)} bytes>)"

class FileWidget(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
      el.innerHTML = ""; // clear

      let container = document.createElement("div");
      container.classList.add("mljar-file-container");

      let label = document.createElement("div");
      label.classList.add("mljar-file-label");
      label.innerHTML = model.get("label") || "File upload";

      // Dropzone
      let dropzone = document.createElement("div");
      dropzone.classList.add("mljar-file-dropzone");
      dropzone.innerHTML = `
        <div>Drag and drop files here</div>
        <div class="mljar-file-drop-hint">Limit ${model.get("max_file_size")} per file</div>
      `;

      // Browse button
      let browseBtn = document.createElement("button");
      browseBtn.classList.add("mljar-file-browse-btn");
      browseBtn.textContent = "Browse files";

      // Hidden input[type=file]
      let input = document.createElement("input");
      input.type = "file";
      input.disabled = model.get("disabled");
      input.multiple = model.get("multiple");
      input.style.display = "none";

      if (model.get("hidden")) {
        container.style.display = "none";
      }

      browseBtn.onclick = () => input.click();

      // File list
      let fileList = document.createElement("ul");
      fileList.classList.add("mljar-file-list");

      // Add files to model
      function handleFiles(files) {
        const filesArr = Array.from(files);
        filesArr.forEach(file => {
          // File size check
          const maxSize = model.get("max_file_size");
          let allowed = true;
          if (maxSize.endsWith("MB")) {
            allowed = file.size <= parseInt(maxSize) * 1024 * 1024;
          } else if (maxSize.endsWith("GB")) {
            allowed = file.size <= parseInt(maxSize) * 1024 * 1024 * 1024;
          } else if (maxSize.endsWith("KB")) {
            allowed = file.size <= parseInt(maxSize) * 1024;
          }
          if (!allowed) {
            alert("File " + file.name + " is too large!");
            return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => {
            let newVals = [...model.get("values")];
            let newNames = [...model.get("filenames")];
            newVals.push(Array.from(new Uint8Array(evt.target.result)));
            newNames.push(file.name);
            model.set("values", newVals);
            model.set("filenames", newNames);
            model.save_changes();
          };
          reader.readAsArrayBuffer(file);
        });
      }

      input.addEventListener("change", () => {
        handleFiles(input.files);
      });

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        handleFiles(e.dataTransfer.files);
      });

      // File list rendering
      function updateList() {
        fileList.innerHTML = "";
        const files = model.get("filenames");
        for (let i = 0; i < files.length; ++i) {
          let li = document.createElement("li");
          li.classList.add("mljar-file-list-item");
          li.innerHTML = `<span class="mljar-file-icon">📄</span> ${files[i]}`;
          let remove = document.createElement("button");
          remove.classList.add("mljar-file-remove-btn");
          remove.textContent = "×";
          remove.onclick = () => {
            let newVals = [...model.get("values")];
            let newNames = [...model.get("filenames")];
            newVals.splice(i, 1);
            newNames.splice(i, 1);
            model.set("values", newVals);
            model.set("filenames", newNames);
            model.save_changes();
          };
          li.appendChild(remove);
          fileList.appendChild(li);
        }
      }
      model.on("change:values", updateList);
      model.on("change:filenames", updateList);

      // Build widget
      dropzone.appendChild(browseBtn);
      container.appendChild(label);
      container.appendChild(dropzone);
      container.appendChild(input);
      container.appendChild(fileList);
      el.appendChild(container);

      // ---- read cell id (no DOM modifications) ----
      const ID_ATTR = 'data-cell-id';
      const hostWithId = el.closest(`[${ID_ATTR}]`);
      const cellId = hostWithId ? hostWithId.getAttribute(ID_ATTR) : null;

      if (cellId) {
        model.set('cell_id', cellId);
        model.save_changes();
        model.send({ type: 'cell_id_detected', value: cellId });
      } else {
        // handle case where the attribute appears slightly later
        const mo = new MutationObserver(() => {
          const host = el.closest(`[${ID_ATTR}]`);
          const newId = host?.getAttribute(ID_ATTR);
          if (newId) {
            model.set('cell_id', newId);
            model.save_changes();
            model.send({ type: 'cell_id_detected', value: newId });
            mo.disconnect();
          }
        });
        mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: [ID_ATTR] });
      }

      // Style
      const css = `
        .mljar-file-container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
            margin-bottom: 1em;
          }
          .mljar-file-label {
            font-weight: 600;
            margin-bottom: 8px;
          }
          .mljar-file-dropzone {
            border: 2px dashed #bbb;
            border-radius: 14px;
            padding: 18px 18px 18px 18px;
            width: 100%;
            max-width: 700px;
            min-width: 220px;
            background: #fafbfc;
            position: relative;
            margin-bottom: 12px;
            transition: border-color 0.2s;
            box-sizing: border-box;
          }
          .mljar-file-dropzone.dragover {
            border-color: #00b1e4;
            background: #e9f6fa;
          }
          .mljar-file-drop-icon {
            font-size: 2.3em;
            margin-bottom: 8px;
          }
          .mljar-file-drop-hint {
            font-size: 0.93em;
            color: #666;
            margin-top: 3px;
          }
          .mljar-file-browse-btn {
            background: #fff;
            color: #00b1e4;
            border: 2px solid #00b1e4;
            border-radius: 10px !important;
            padding: 6px 18px;
            font-size: 1.08em;
            font-weight: 600;
            cursor: pointer;
            margin-top: 12px;
            transition: background 0.2s, color 0.2s;
            position: absolute;
            right: 18px;
            bottom: 18px;
          }
          .mljar-file-browse-btn:hover {
            background: #00b1e4;
            color: #fff;
          }
          .mljar-file-list {
            list-style: none;
            margin: 0;
            padding: 0;
            width: 100%;
            max-width: 700px;
          }
          .mljar-file-list-item {
            display: flex;
            align-items: center;
            margin-bottom: 2px;
            font-size: 1.06em;
          }
          .mljar-file-icon {
            margin-right: 7px;
          }
          .mljar-file-remove-btn {
            margin-left: 8px;
            background: none;
            border: none;
            color: #f44;
            font-size: 1.1em;
            cursor: pointer;
            font-weight: 700;
          }
          /* Responsive tweaks */
          @media (max-width: 800px) {
            .mljar-file-dropzone,
            .mljar-file-list {
              max-width: 100%;
            }
            .mljar-file-dropzone {
              padding: 30px 8px 14px 8px;
            }
          }
          @media (max-width: 500px) {
            .mljar-file-dropzone {
              font-size: 0.93em;
              padding: 16px 4px 8px 4px;
              border-radius: 9px;
              min-width: unset;
            }
            .mljar-file-browse-btn {
              font-size: 1em;
              padding: 8px 10px;
              position: static !important;
              width: 100%;
              margin-top: 10px;
              margin-bottom: 0;
              display: block;
            }
            .mljar-file-drop-icon {
              display: none !important;
            }
          }
        `;

      let styleTag = document.createElement("style");
      styleTag.textContent = css;
      el.appendChild(styleTag);

      // Optional: apply custom CSS if provided
      const extraCSS = model.get("custom_css");
      if (extraCSS && extraCSS.trim().length > 0) {
        let extra = document.createElement("style");
        extra.textContent = extraCSS;
        el.appendChild(extra);
      }

      updateList();
    }
    export default { render };
    """
    label = traitlets.Unicode("Choose a file").tag(sync=True)
    max_file_size = traitlets.Unicode("100MB").tag(sync=True)
    disabled = traitlets.Bool(False).tag(sync=True)
    hidden = traitlets.Bool(False).tag(sync=True)
    multiple = traitlets.Bool(False).tag(sync=True)
    key = traitlets.Unicode("").tag(sync=True)
    values = traitlets.List(traitlets.List(traitlets.Int())).tag(sync=True)  # List of file bytes as int lists
    filenames = traitlets.List(traitlets.Unicode()).tag(sync=True)
    custom_css = traitlets.Unicode(default_value="", help="Extra CSS to append to default styles").tag(sync=True)
    position = traitlets.Enum(
        values=["sidebar", "inline", "bottom"],
        default_value="sidebar",
        help="Widget placement: sidebar, inline, or bottom"
    ).tag(sync=True)
    # NEW: synced cell id
    cell_id = traitlets.Unicode(allow_none=True).tag(sync=True)

    # ---- Streamlit-like API ----
    @property
    def value(self):
        if self.values and self.values[0]:
            return bytes(self.values[0])
        return None

    @property
    def name(self):
        if self.filenames:
            return self.filenames[0]
        return None

    def __iter__(self):
        return (
            UploadedFile(name, value)
            for name, value in zip(self.filenames, self.values)
        )

    @property
    def files(self):
        return [UploadedFile(name, value) for name, value in zip(self.filenames, self.values)]

    @property
    def values_bytes(self):
        return [bytes(val) for val in self.values]

    @property
    def names(self):
        return self.filenames.copy()

    @property
    def key_value(self):
        return self.key

    def _repr_mimebundle_(self, **kwargs):
        data = super()._repr_mimebundle_(**kwargs)
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

def File(label="Choose a file", max_file_size="100MB", key="", disabled=False, hidden=False, multiple=False):
    code_uid = WidgetsManager.get_code_uid("File", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        display(cached)
        return cached
    instance = FileWidget(
        label=label,
        max_file_size=max_file_size,
        disabled=disabled,
        hidden=hidden,
        multiple=multiple,
        key=key,
    )
    WidgetsManager.add_widget(code_uid, instance)
    display(instance)
    return instance
