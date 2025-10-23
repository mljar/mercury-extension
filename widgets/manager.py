import inspect
import logging
import hashlib 

log = logging.getLogger(__name__)

MERCURY_MIMETYPE = "application/mercury+json"

class WidgetException(Exception):
    pass


class WidgetsManager:
    widgets = {}  # model_id -> widget
    
    # preset_values = {} # url_key -> value
    
    @staticmethod
    def get_code_uid(widget_type="widget", key="", index=None):
        # Find the frame for the user's notebook cell code
        user_frame = None
        for f in inspect.stack():
            # Jupyter executes user code in a temp file like /tmp/ipykernel_.../<cell_id>.py
            if "/tmp/ipykernel_" in f.filename and f.function == "<module>":
                user_frame = f
                break
        if user_frame is None:
            # Fallback to previous approach
            user_frame = inspect.stack()[2]

        code_line = user_frame.lineno
        code_source = None
        try:
            code_source = user_frame.code_context
            if code_source is not None:
                code_source = ''.join(code_source)
        except Exception:
            code_source = None

        cell_hash = (
            hashlib.sha1(code_source.encode('utf-8')).hexdigest()[:8]
            if code_source else "nocell"
        )

        uid = f"{widget_type}.{cell_hash}.{code_line}"
        if index is not None:
            uid += f".{index}"
        if key:
            uid += f".{key}"
        return uid

    @staticmethod
    def add_widget(code_uid, widget):
        WidgetsManager.widgets[code_uid] = widget
        

    @staticmethod
    def get_widget(code_uid):
        return WidgetsManager.widgets.get(code_uid)
    
    @staticmethod
    def clear():
        """
        Reset all ButtonWidget values to False.

        This is useful after a cell re-execution cycle, so that button clicks
        are consumed and no stale True values remain.
        """
        for uid, widget in list(WidgetsManager.widgets.items()):
            try:
                # Compare by class name to avoid import loops
                if type(widget).__name__ == "ButtonWidget":
                    if getattr(widget, "value", None) is True:
                        widget.value = False
                        log.debug(f"Reset ButtonWidget {uid} -> value=False")
            except Exception as e:
                log.warning(f"Failed to reset widget {uid}: {e}")