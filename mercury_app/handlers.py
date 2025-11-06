from pathlib import Path
from typing import Optional

from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.extension.handler import (ExtensionHandlerJinjaMixin,
                                              ExtensionHandlerMixin)
from jupyter_server.utils import ensure_async
from jupyter_server.utils import url_path_join as ujoin
from jupyterlab_server.config import (LabConfig, get_page_config,
                                      recursive_update)
from jupyterlab_server.handlers import _camelCase, is_url
from tornado import web

from ._version import __version__

version = __version__

from pathlib import Path

import toml


def load_config(config_path="config.toml"):
    config_file = Path(config_path)
    if not config_file.exists():
        return {"theme": {}, "main": {}, "welcome": {}}

    config = toml.load(config_file)

    # Ensure missing sections return empty dicts
    return {
        "theme": config.get("theme", {}),
        "main": config.get("main", {}),
        "welcome": config.get("welcome", {})
    }

CONFIG = load_config()

THEME = CONFIG["theme"]
MAIN_CONFIG = CONFIG["main"]
WELCOME_CONFIG = CONFIG["welcome"]


class MercuryHandler(ExtensionHandlerJinjaMixin, ExtensionHandlerMixin, JupyterHandler):
    """Render the Mercury app."""

    def get_page_config(self, notebook_path: Optional[str] = None):
        config = LabConfig()
        app = self.extensionapp
        base_url = self.settings.get("base_url")

        page_config = {
            "appVersion": version,
            "baseUrl": self.base_url,
            "terminalsAvailable": False,
            "token": self.settings["token"],
            "fullStaticUrl": ujoin(self.base_url, "static", self.name),
            "frontendUrl": ujoin(self.base_url, "mercury/"),
            "notebookPath": notebook_path,
            "title": MAIN_CONFIG.get("title", "Mercury"), 
        }

        mathjax_config = self.settings.get("mathjax_config", "TeX-AMS_HTML-full,Safe")
        mathjax_url = self.settings.get(
            "mathjax_url",
            "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js",
        )
        page_config.setdefault("mathjaxConfig", mathjax_config)
        page_config.setdefault("fullMathjaxUrl", mathjax_url)

        for name in config.trait_names():
            page_config[_camelCase(name)] = getattr(app, name)

        for name in config.trait_names():
            if not name.endswith("_url"):
                continue
            full_name = _camelCase("full_" + name)
            full_url = getattr(app, name)
            if not is_url(full_url):
                full_url = ujoin(base_url, full_url)
            page_config[full_name] = full_url

        labextensions_path = app.extra_labextensions_path + app.labextensions_path
        recursive_update(
            page_config,
            get_page_config(
                labextensions_path,
                logger=self.log,
            ),
        )
        return page_config

    @web.authenticated
    async def get(self, path: str = None):
        if not (
            path
            and await ensure_async(self.serverapp.contents_manager.file_exists(path))
            and Path(path).suffix == ".ipynb"
        ):
            message = (
                f"Only Jupyter Notebook can be opened with Mercury; got {path}"
                if path
                else "No Jupyter Notebook specified."
            )
            return self.write(
                self.render_template(
                    "error.html",
                    default_url="https://runmercury.com/",
                    static=self.static_url,
                    page_title="Mercury",
                    status_code=404,
                    status_message=message,
                    advices=[
                        "You must provide a valid Jupyter Notebook path as argument of the application:",
                        "python -m mercury_app <path/to/notebook.ipynb>",
                    ],
                )
            )

        page_config = self.get_page_config(path)
        page_config["theme"] = THEME

        print('*'*22)
        print(page_config)

        return self.write(
            self.render_template(
                "index.html",
                static=self.static_url,
                base_url=self.base_url,
                token=self.settings["token"],
                page_config=page_config,
            )
        )
