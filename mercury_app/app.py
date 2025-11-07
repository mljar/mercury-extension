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
from .handlers import MercuryHandler, MAIN_CONFIG
from .idle_timeout import (TimeoutActivityTransform, TimeoutManager,
                           patch_kernel_websocket_handler)
from .notebooks import NotebooksAPIHandler
from .root import RootIndexHandler
from .theme_handler import ThemeHandler

from traitlets.config import Config

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

    def initialize(self, argv=None):
        print('initialize')
        # Determine whether token came from CLI or config
        cli_token = None
        if hasattr(self, "cli_config") and isinstance(self.cli_config, Config):
            cli_token = (self.cli_config.get("ServerApp", {}) or {}).get("token")
            if cli_token is None:
                cli_token = (self.cli_config.get("IdentityProvider", {}) or {}).get("token")

        cfg_token = (self.config.get("ServerApp", {}) or {}).get("token")
        if cfg_token is None:
            cfg_token = (self.config.get("IdentityProvider", {}) or {}).get("token")

        # If neither CLI nor config provided a token, set the default to empty
        if cli_token is None and cfg_token is None:
            # set both to be safe across versions
            if "ServerApp" not in self.config:
                self.config.ServerApp = Config()
            self.config.ServerApp.token = ""

            if "IdentityProvider" not in self.config:
                self.config.IdentityProvider = Config()
            self.config.IdentityProvider.token = ""

        # proceed with normal init (now with defaults in place; CLI still overrides)
        super().initialize(argv)

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
        super().initialize_templates()

        self.static_dir = os.path.join(HERE, "static")
        # self.templates_dir = os.path.join(HERE, "templates")

        # Ensure static search path includes yours (without dropping existing ones)
        static_paths = self.static_paths[:] if hasattr(self, "static_paths") else []
        if self.static_dir not in static_paths:
            static_paths.insert(0, self.static_dir)
        self.static_paths = static_paths
        
        
        # from jinja2 import FileSystemLoader, ChoiceLoader
        # my_loader = FileSystemLoader(os.path.join(HERE, "templates"))

        # web_app = getattr(self, "serverapp", None).web_app if hasattr(self, "serverapp") else None
        # print(web_app.settings)
        # env = (web_app.settings.get("jinja2_env")
        #      if web_app else self.settings.get("jinja2_env"))
        # print(env.loader)
        # if isinstance(env.loader, ChoiceLoader):
        #    # put YOUR loader *first*
        #    print('My Loader')
        #    env.loader = ChoiceLoader([my_loader] + [ldr for ldr in env.loader.loaders])
        # else:
        #    print('Default Loader')
        #    env.loader = ChoiceLoader([my_loader, env.loader])

        # # debug
        # print("Using:", env.loader)
    #########################################################################################
    # def initialize_templates(self):
    #     from jinja2 import ChoiceLoader, FileSystemLoader
    #     super().initialize_templates()

    #     self.static_dir = os.path.join(HERE, "static")
    #     self.templates_dir = os.path.join(HERE, "templates")

    #     # Ensure static search path includes yours (without dropping existing ones)
    #     static_paths = self.static_paths[:] if hasattr(self, "static_paths") else []
    #     if self.static_dir not in static_paths:
    #         static_paths.insert(0, self.static_dir)
    #     self.static_paths = static_paths

    #     # Get the single Jinja env used by ExtensionHandlerJinjaMixin
    #     web_app = getattr(self, "serverapp", None).web_app if hasattr(self, "serverapp") else None
    #     env = (web_app.settings.get("jinja2_env")
    #         if web_app else self.settings.get("jinja2_env"))

    #     my_loader = FileSystemLoader(self.templates_dir)

    #     if isinstance(env.loader, ChoiceLoader):
    #         # put YOUR loader *first*
    #         env.loader = ChoiceLoader([my_loader] + [ldr for ldr in env.loader.loaders])
    #     else:
    #         env.loader = ChoiceLoader([my_loader, env.loader])

    #     # Also update template_paths so other helpers/search use yours first
    #     settings = web_app.settings if web_app else self.settings
    #     paths = settings.get("template_paths", [])
    #     if self.templates_dir not in paths:
    #         settings["template_paths"] = [self.templates_dir] + paths

    #     # Debug: print the resolved index.html source path
    #     try:
    #         src, path, _ = env.loader.get_source(env, "index.html")
    #         print("USING TEMPLATE:", path)
    #     except Exception as e:
    #         print("TEMPLATE RESOLVE ERROR:", e)
        
    #     env = self.settings.get("jinja2_env")
    #     try:
    #         src, fname, _ = env.loader.get_source(env, "jupyter_server/browser-open.html")
    #         print("✅ Using browser-open override from:", fname)
    #         print(src[:200])
    #     except Exception as e:
    #         print("❌ Could not resolve browser-open.html:", e)

    def initialize_settings(self):
        super().initialize_settings()
        self.settings.setdefault("notebooks_dir", os.getcwd())

        from jinja2 import FileSystemLoader, ChoiceLoader

        templates_dir = os.path.join(HERE, "templates")
        loader = FileSystemLoader(templates_dir)

        # this is ALWAYS the real env used by render_template
        env = self.settings.get("jinja2_env")
        if env is None:
            print("❌ jinja2_env missing")
            return

        # prepend your loader so it has priority
        if isinstance(env.loader, ChoiceLoader):
            env.loader.loaders.insert(0, loader)
        else:
            env.loader = ChoiceLoader([loader, env.loader])

        if env:
            env.globals.setdefault("page_title", MAIN_CONFIG.get("title", "Mercury"))

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
