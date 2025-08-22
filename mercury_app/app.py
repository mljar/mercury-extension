import os
import sys
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
from .handlers import MercuryHandler
from .theme_handler import ThemeHandler
from .custom_contents_handler import MercuryContentsHandler

from .idle_timeout import TimeoutManager, TimeoutActivityTransform, patch_kernel_websocket_handler

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
    default_url = "/mercury"
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
        self.handlers.append(("/mercury/api/theme", ThemeHandler))

        # generic Mercury handler (catch-all)
        self.handlers.append((f"/mercury{path_regex}", MercuryHandler))

        if sys.argv[0].endswith("mercury_app/__main__.py"):
            self.handlers.append((r"/api/contents/(.*\.ipynb)$", MercuryContentsHandler))
        super().initialize_handlers()

    def initialize_templates(self):
        super().initialize_templates()
        self.static_dir = os.path.join(HERE, "static")
        self.templates_dir = os.path.join(HERE, "templates")
        self.static_paths = [self.static_dir]
        self.template_paths = [self.templates_dir]

    def initialize_settings(self):
        super().initialize_settings()
        self.settings['show_code'] = self.show_code
        self.settings.update({
            "headers": {
                "Content-Security-Policy": "frame-ancestors 'self' http://localhost:3000",
                "Access-Control-Allow-Origin": "http://localhost:3000"
            }
        })

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
