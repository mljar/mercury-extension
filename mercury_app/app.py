import os
import sys
import json
from os.path import join as pjoin
from traitlets import Integer, Bool

import logging
#logging.basicConfig(level=logging.DEBUG, format="%(levelname)s:%(name)s:%(message)s")
# for name in ("mercury.app", "mercury.idle_timeout"):
#     logger = logging.getLogger(name)
#     logger.setLevel(logging.DEBUG)
#     if not logger.handlers:
#         handler = logging.StreamHandler()
#         handler.setFormatter(logging.Formatter("%(levelname)s:%(name)s:%(message)s"))
#         logger.addHandler(handler)
            

from jupyterlab_server import LabServerApp
from jupyterlab.commands import get_app_dir, get_user_settings_dir, get_workspaces_dir

from ._version import __version__
from .handlers import MercuryHandler, MAIN_CONFIG, WELCOME_CONFIG
from .theme_handler import ThemeHandler
from .custom_contents_handler import MercuryContentsHandler

from .idle_timeout import TimeoutManager, TimeoutActivityTransform, patch_kernel_websocket_handler

from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.utils import url_path_join
import tornado.web

from .notebooks_meta import list_notebooks   

class NotebooksAPIHandler(JupyterHandler):
    """API endpoint to return list of notebooks discovered on disk."""

    @tornado.web.authenticated
    def get(self):
        base = self.settings.get("base_url", "") or ""

        # Defaults come from settings; both are optional.
        notebooks_dir = self.settings.get("notebooks_dir", os.getcwd())
        url_prefix = "mercury/"

        # Allow overriding via query params (optional)
        q_dir = self.get_argument("dir", default=None)
        if q_dir:
            notebooks_dir = q_dir
        recursive = self.get_argument("recursive", default="0") in {"1", "true", "True"}

        if not os.path.isdir(notebooks_dir):
            self.set_status(400)
            self.finish(json.dumps({"error": f"Notebooks directory '{notebooks_dir}' does not exist"}))
            return

        items = list_notebooks(notebooks_dir=notebooks_dir, recursive=recursive)

        notebooks = []
        for it in items:
            rel_path = it["rel_path"]
            href = f"{base}{url_prefix}{rel_path}"

            rec = {
                "name": it["name"],
                "description": it["description"],
                "href": href,
            }

            # Copy known extras if present
            extras = it.get("extras", {})
            for k in ("thumbnail_bg", "thumbnail_text", "thumbnail_text_color", "show_code"):
                if k in extras and extras[k] is not None:
                    rec[k] = extras[k]

            if "metadata_error" in it:
                rec["metadata_error"] = it["metadata_error"]

            notebooks.append(rec)

        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps(notebooks))

class RootIndexHandler(JupyterHandler):
    @tornado.web.authenticated
    def get(self):
        base = self.settings.get("base_url", "") or ""

        # Same defaults as the API handler
        notebooks_dir = self.settings.get("notebooks_dir", os.getcwd())
        url_prefix = "mercury/"
        recursive = bool(self.settings.get("notebooks_recursive", False))

        if not os.path.isdir(notebooks_dir):
            # Render an empty page with a friendly message instead of 400
            html = self.render_template(
                "root.html",
                notebooks=[],
                base_url=base,
                error=f"Notebooks directory '{notebooks_dir}' does not exist."
            )
            self.set_header("Content-Type", "text/html; charset=UTF-8")
            self.finish(html)
            return

        items = list_notebooks(notebooks_dir=notebooks_dir, recursive=recursive)

        notebooks = []
        for it in items:
            rel_path = it["rel_path"]
            href = f"{base}{url_prefix}{rel_path}"

            rec = {
                "name": it["name"],
                "description": it["description"],
                "href": href,
            }

            # Copy known extras if present (keeps your template props working)
            extras = it.get("extras", {})
            for k in ("thumbnail_bg", "thumbnail_text", "thumbnail_text_color", "show_code"):
                if k in extras and extras[k] is not None:
                    rec[k] = extras[k]

            if "metadata_error" in it:
                rec["metadata_error"] = it["metadata_error"]

            notebooks.append(rec)

        default_welcome_msg = """
        <p class="lead"><b>Welcome to Mercury.</b> You're viewing notebooks turned into user-friendly apps.</p>
        <p class="lead2">Feel free to interact and explore - everything is designed to be <b>simple and safe</b>.</p>
        """

        html = self.render_template("root.html", notebooks=notebooks, base_url=base, 
                                    title=MAIN_CONFIG.get("title", "Mercury"),           
                                    footer=MAIN_CONFIG.get("footer", "MLJAR - next generation of AI tools"),
                                    header=WELCOME_CONFIG.get("header", "Hi there! 👋"),
                                    message=WELCOME_CONFIG.get("message", default_welcome_msg))
        self.set_header("Content-Type", "text/html; charset=UTF-8")
        self.finish(html)

logger = logging.getLogger("mercury.app")

class SuppressKernelDoesNotExist(logging.Filter):
    def filter(self, record):
        # Don't log if message matches our known error text
        if 'Kernel does not exist:' in str(record.getMessage()):
            return False
        return True

# Apply to the Jupyter server logger (and tornado)
for logger_name in ["tornado.application", "ServerApp"]:
    logger = logging.getLogger(logger_name)
    logger.addFilter(SuppressKernelDoesNotExist())

HERE = os.path.dirname(__file__)
app_dir = get_app_dir()
version = __version__

class MercuryApp(LabServerApp):
    name = "mercury"
    app_name = "Mercury"
    description = "Mercury - Web App from Jupyter Notebook"
    version = version
    app_version = version
    extension_url = "/mercury"
    default_url = "/"
    file_url_prefix = "/mercury"
    load_other_extensions = True
    app_dir = app_dir
    app_settings_dir = pjoin(app_dir, "settings")
    schemas_dir = pjoin(app_dir, "schemas")
    themes_dir = pjoin(app_dir, "themes")
    user_settings_dir = get_user_settings_dir()
    workspaces_dir = get_workspaces_dir()
    subcommands = {}

    timeout = Integer(
        0,
        help="Timeout (in seconds) before shutting down if idle. 0 disables timeout."
    ).tag(config=True)

    show_code = Bool(
        False,  
        help="Show code cells' input area."
    ).tag(config=True)

    def initialize_handlers(self):
        from jupyter_server.base.handlers import path_regex
         # new theme API (must come first)

        self.handlers.append((r"/", RootIndexHandler))
        # Add the notebooks API endpoint
        self.handlers.append(("/mercury/api/notebooks", NotebooksAPIHandler))

        self.handlers.append(("/mercury/api/theme", ThemeHandler))

        # generic Mercury handler (catch-all)
        self.handlers.append((f"/mercury{path_regex}", MercuryHandler))

        if sys.argv[0].endswith("mercury_app/__main__.py"):
            self.handlers.append((r"/api/contents/(.*\.ipynb)$", MercuryContentsHandler))
        super().initialize_handlers()

    def initialize_templates(self):
        from jinja2 import ChoiceLoader, FileSystemLoader
        # Build Jupyter's default env first
        super().initialize_templates()

        # Template & static dirs
        self.static_dir = os.path.join(HERE, "static")
        self.templates_dir = os.path.join(HERE, "templates")
        self.static_paths = [self.static_dir]

        # Inject our templates dir into the live Jinja env 
        web_app = self.serverapp.web_app if hasattr(self, "serverapp") else None
        env = (web_app.settings.get("jinja2_env")
               if web_app else self.settings.get("jinja2_env"))

        if env is not None:
            my_loader = FileSystemLoader(self.templates_dir)
            if isinstance(env.loader, ChoiceLoader):
                # Prepend so our templates override defaults
                env.loader.loaders.insert(0, my_loader)
            else:
                # Wrap existing loader so both work
                env.loader = ChoiceLoader([my_loader, env.loader])

            # (Optional) keep a record for debugging/other extensions
            paths = web_app.settings.get("template_paths", []) if web_app else self.settings.get("template_paths", [])
            if self.templates_dir not in paths:
                paths.insert(0, self.templates_dir)
                if web_app:
                    web_app.settings["template_paths"] = paths
                else:
                    self.settings["template_paths"] = paths
        else:
            # Fallback (shouldn't happen on normal Jupyter Server runs)
            self.template_paths = [self.templates_dir]

    def initialize_settings(self):
        super().initialize_settings()
        self.settings['show_code'] = self.show_code
        self.settings.setdefault("notebooks_dir", os.getcwd())

    def initialize(self, argv=None):
        super().initialize()
        # Only run idle timeout logic if running as main app (not just extension)
        if hasattr(self, 'serverapp') and getattr(self, 'timeout', 0) > 0:
            self._timeout_manager = TimeoutManager(self.timeout, self.serverapp)
            self.serverapp.web_app._timeout_manager = self._timeout_manager
            self.serverapp.web_app.add_transform(TimeoutActivityTransform)
            patch_kernel_websocket_handler()


main = launch_new_instance = MercuryApp.launch_instance

if __name__ == "__main__":
    main()
