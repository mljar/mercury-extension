from django.contrib import admin
from django.utils.safestring import mark_safe
from .models import Notebook

@admin.register(Notebook)
class NotebookAdmin(admin.ModelAdmin):
    list_display = (
        "name", "description", "status", "port", "pid",
        "file_path", "thumbnail_image", "thumbnail_bg", "thumbnail_text", "thumbnail_text_color"
    )
    search_fields = ("name", "description", "file_path")
    list_filter = ("status",)
    readonly_fields = ("port", "pid", "thumbnail_preview")  # <-- add method here!

    def thumbnail_preview(self, obj):
        if obj.thumbnail_image:
            return mark_safe(f'<img src="{obj.thumbnail_image}" width="40" height="40" />')
        elif obj.thumbnail_bg and obj.thumbnail_text:
            return mark_safe(
                f'<div style="width:40px;height:40px;background:{obj.thumbnail_bg};color:{obj.thumbnail_text_color or "#fff"};display:flex;align-items:center;justify-content:center;font-size:22px;border-radius:8px;">{obj.thumbnail_text}</div>'
            )
        else:
            return ""
    thumbnail_preview.short_description = "Thumbnail"

    fields = (
        "name", "description", "file_path", "status", "port", "pid",
        "thumbnail_image", "thumbnail_bg", "thumbnail_text", "thumbnail_text_color"
        # Do NOT add 'thumbnail_preview' here!
    )
