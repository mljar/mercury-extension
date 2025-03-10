"""Mercury decorator to mark ipywidgets.Widget instance."""

from __future__ import annotations

import functools
import json
from typing import Any

try:
    from ipywidgets import Widget
except ImportError:
    Widget = None

IPYWIDGET_MIMETYPE = "application/vnd.jupyter.widget-view+json"
MERCURY_MIMETYPE = "application/mercury+json"


def as_controller(widget: Widget) -> Widget:
    """Convert an ipywidget.Widget into a Mercury widget."""
    if Widget is None or not isinstance(widget, Widget):
        raise ValueError(
            f"Widget must be a valid ipywidgets.Widget; got {type(widget).__qualname__}"
        )

    original_repr_mimebundle = widget._repr_mimebundle_

    @functools.wraps(widget._repr_mimebundle_)
    def wrapper_repr_mimebundle(**kwargs):
        orig_mimebundle: dict[str, Any] = original_repr_mimebundle(**kwargs) or {}

        # Append information for mercury has a new mimetype key
        # Another approach could be to set those information as metadata
        # returning a tuple of two dictionaries tuple(orig_mimebundle, metadata)
        #
        # Note: the data are serialized to align with mercury widget. But this
        # sounds sub optimal as the data could be JSON directly; like ipywidgets 
        # does:
        # https://github.com/jupyter-widgets/ipywidgets/blob/303cae4dc268640a01ce08bf6e22da6c5cd201e4/python/ipywidgets/ipywidgets/widgets/widget.py#L815
        orig_mimebundle[MERCURY_MIMETYPE] = json.dumps(
            {
                "widget": type(widget).__qualname__,
                "model_id": widget.model_id,
            }
        )

        return orig_mimebundle

    widget._repr_mimebundle_ = wrapper_repr_mimebundle
    return widget
