from jupyter_server.base.handlers import APIHandler
import json
import tornado

from .handlers import THEME  

class ThemeHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps(THEME))
