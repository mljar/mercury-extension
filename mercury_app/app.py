import json
import logging
import os
import sys
from os.path import join as pjoin

from jupyterlab.commands import (get_app_dir, get_user_settings_dir,
                                 get_workspaces_dir)
from jupyterlab_server import LabServerApp
from traitlets import Bool, Integer

from ._version import __version__
from .custom_contents_handler import MercuryContentsHandler
from .handlers import MercuryHandler
from .idle_timeout import (TimeoutActivityTransform, TimeoutManager,
                           patch_kernel_websocket_handler)
from .notebooks import NotebooksAPIHandler
from .root import RootIndexHandler
from .theme_handler import ThemeHandler

#logging.basicConfig(level=logging.DEBUG, format="%(levelname)s:%(name)s:%(message)s")
# for name in ("mercury.app", "mercury.idle_timeout"):
#     logger = logging.getLogger(name)
#     logger.setLevel(logging.DEBUG)
#     if not logger.handlers:
#         handler = logging.StreamHandler()
#         handler.setFormatter(logging.Formatter("%(levelname)s:%(name)s:%(message)s"))
#         logger.addHandler(handler)
            
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

    aliases = {
        "timeout": "MercuryApp.timeout",
    }

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
