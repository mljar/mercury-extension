import anywidget
import traitlets
import json
from .manager import WidgetsManager, MERCURY_MIMETYPE
from .theme import THEME


def JSON(*args, key="", **kwargs):
    code_uid = WidgetsManager.get_code_uid("JSON", key=key)
    cached = WidgetsManager.get_widget(code_uid)
    if cached:
        display(cached)        
        return cached
    instance = JSONViewer(*args, **kwargs)
    WidgetsManager.add_widget(code_uid, instance)
    display(instance)
    return instance


class JSONViewer(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
      // renderjson (embedded) 
      var renderjson=function(){var t=function(){for(var t=[];arguments.length;)t.push(n(s(Array.prototype.shift.call(arguments)),o(Array.prototype.shift.call(arguments))));return t},n=function(){for(var t=Array.prototype.shift.call(arguments),e=0;e<arguments.length;e++)arguments[e].constructor==Array?n.apply(this,[t].concat(arguments[e])):t.appendChild(arguments[e]);return t},e=function(t,n){return t.insertBefore(n,t.firstChild),t},r=function(t,n){var e=n||Object.keys(t);for(var r in e)if(Object.hasOwnProperty.call(t,e[r]))return!1;return!0},o=function(t){return document.createTextNode(t)},s=function(t){var n=document.createElement("span");return t&&(n.className=t),n},l=function(t,n,e){var r=document.createElement("a");return n&&(r.className=n),r.appendChild(o(t)),r.href="#",r.onclick=function(t){return e(),t&&t.stopPropagation(),!1},r};function a(i,c,u,p,y){var _=u?"":c,f=function(r,a,i,c,u){var f,g=s(c),h=function(){f||n(g.parentNode,f=e(u(),l(y.hide,"disclosure",(function(){f.style.display="none",g.style.display="inline"})))),f.style.display="inline",g.style.display="none"};n(g,l(y.show,"disclosure",h),t(c+" syntax",r),l(a,null,h),t(c+" syntax",i));var d=n(s(),o(_.slice(0,-1)),g);return p>0&&"string"!=c&&h(),d};return null===i?t(null,_,"keyword","null"):void 0===i?t(null,_,"keyword","undefined"):"string"==typeof i&&i.length>y.max_string_length?f('"',i.substr(0,y.max_string_length)+" ...",'"',"string",(function(){return n(s("string"),t(null,_,"string",JSON.stringify(i)))})):"object"!=typeof i||[Number,String,Boolean,Date].indexOf(i.constructor)>=0?t(null,_,typeof i,JSON.stringify(i)):i.constructor==Array?0==i.length?t(null,_,"array syntax","[]"):f("[",y.collapse_msg(i.length),"]","array",(function(){for(var e=n(s("array"),t("array syntax","[",null,"\\n")),r=0;r<i.length;r++)n(e,a(y.replacer.call(i,r,i[r]),c+"    ",!1,p-1,y),r!=i.length-1?t("syntax",","):[],o("\\n"));return n(e,t(null,c,"array syntax","]")),e})):r(i,y.property_list)?t(null,_,"object syntax","{}"):f("{",y.collapse_msg(Object.keys(i).length),"}","object",(function(){var e=n(s("object"),t("object syntax","{",null,"\\n"));for(var r in i)var l=r;var u=y.property_list||Object.keys(i);for(var _ in y.sort_objects&&(u=u.sort()),u){(r=u[_])in i&&n(e,t(null,c+"    ","key",'"'+r+'"',"object syntax",": "),a(y.replacer.call(i,r,i[r]),c+"    ",!0,p-1,y),r!=l?t("syntax",","):[],o("\\n"))}return n(e,t(null,c,"object syntax","}")),e}))}var i=function t(e){var r=new Object(t.options);r.replacer="function"==typeof r.replacer?r.replacer:function(t,n){return n};var o=n(document.createElement("pre"),a(e,"",!1,r.show_to_level,r));return o.className="renderjson",o};return i.set_icons=function(t,n){return i.options.show=t,i.options.hide=n,i},i.set_show_to_level=function(t){return i.options.show_to_level="string"==typeof t&&"all"===t.toLowerCase()?Number.MAX_VALUE:t,i},i.set_max_string_length=function(t){return i.options.max_string_length="string"==typeof t&&"none"===t.toLowerCase()?Number.MAX_VALUE:t,i},i.set_sort_objects=function(t){return i.options.sort_objects=t,i},i.set_replacer=function(t){return i.options.replacer=t,i},i.set_collapse_msg=function(t){return i.options.collapse_msg=t,i},i.set_property_list=function(t){return i.options.property_list=t,i},i.set_show_by_default=function(t){return i.options.show_to_level=t?Number.MAX_VALUE:0,i},i.options={},i.set_icons("⊕","⊖"),i.set_show_by_default(!1),i.set_sort_objects(!1),i.set_max_string_length("none"),i.set_replacer(void 0),i.set_property_list(void 0),i.set_collapse_msg((function(t){return t+" item"+(1==t?"":"s")})),i}();

      // DOM
      const container = document.createElement("div");
      container.classList.add("mljar-json-container");

      const labelEl = document.createElement("div");
      labelEl.classList.add("mljar-json-label");
      if (model.get("label")) {
        labelEl.innerHTML = model.get("label");
        container.appendChild(labelEl);
      }

      const holder = document.createElement("div");
      holder.classList.add("mljar-json-holder");
      container.appendChild(holder);

      el.appendChild(container);

      // draw
      function draw() {
        holder.innerHTML = "";
        const lvl = model.get("level") ?? 1;
        renderjson.set_show_to_level(lvl);
        try {
          const raw = model.get("data") || "{}";
          const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
          holder.appendChild(renderjson(obj));
        } catch (e) {
          const pre = document.createElement("pre");
          pre.textContent = "Invalid JSON";
          holder.appendChild(pre);
        }
      }

      draw();

      // sync
      model.on("change:data", draw);
      model.on("change:level", draw);
      model.on("change:label", () => {
        if (model.get("label")) {
          if (!container.contains(labelEl)) container.insertBefore(labelEl, holder);
          labelEl.innerHTML = model.get("label");
        } else if (container.contains(labelEl)) {
          container.removeChild(labelEl);
        }
      });

      // custom css
      const css = model.get("custom_css");
      if (css && css.trim().length > 0) {
        const styleTag = document.createElement("style");
        styleTag.textContent = css;
        el.appendChild(styleTag);
      }
    }
    export default { render };
    """

    _css = f"""
    .mljar-json-container {{
      display: flex;
      flex-direction: column;
      width: 100%;
      font-family: {THEME.get('font_family', 'Arial, monospace')};
      font-size: {THEME.get('font_size', '14px')};
      color: {THEME.get('text_color', '#222')};
      margin-bottom: 8px;
      box-sizing: border-box;
    }}
    .mljar-json-label {{
      margin-bottom: 6px;
      font-weight: bold;
    }}
    .mljar-json-holder pre.renderjson {{
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }}
    /* renderjson */
    .renderjson .key {{ color: #2684ff; }}
    .renderjson .string {{ color: #fe46a5; }}
    .renderjson .number {{ color: #0f9b8e; }}
    .renderjson .boolean {{ color: #111; }}
    .renderjson .syntax {{ color: #666; }}
    .renderjson .disclosure {{ color: #666; font-size: 120%; text-decoration: none; }}
    """

    # traits
    data = traitlets.Unicode(default_value="{}").tag(sync=True)
    label = traitlets.Unicode(default_value="").tag(sync=True)
    level = traitlets.Int(default_value=1).tag(sync=True)
    custom_css = traitlets.Unicode(default_value="", help="Extra CSS").tag(sync=True)
    position = traitlets.Enum(
        values=["sidebar", "inline", "bottom"],
        default_value="inline",
        help="Widget placement"
    ).tag(sync=True)

    def __init__(self, json_data=None, **kwargs):
        super().__init__(**kwargs)
        if json_data is None:
            self.data = "{}"
        else:
            if isinstance(json_data, (dict, list)):
                self.data = json.dumps(json_data)
            else:
                self.data = str(json_data)

    def _repr_mimebundle_(self, **kwargs):
        data = super()._repr_mimebundle_(**kwargs)
        if len(data) > 1:
            mercury_mime = {
                "widget": type(self).__qualname__,
                "model_id": self.model_id,
                "position": self.position
            }
            data[0][MERCURY_MIMETYPE] = mercury_mime
            if "text/plain" in data[0]:
                del data[0]["text/plain"]
        return data
