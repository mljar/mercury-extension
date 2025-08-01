from django.db import models

class Notebook(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file_path = models.CharField(max_length=500)  # Path to .ipynb file
    port = models.IntegerField(null=True, blank=True)
    pid = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, default='stopped')

    # Thumbnail options
    thumbnail_image = models.CharField(
        max_length=500, blank=True, null=True,
        help_text="Path or URL to thumbnail image. If set, used as thumbnail."
    )
    thumbnail_bg = models.CharField(
        max_length=20, blank=True, null=True, default='#4ade80',
        help_text="Background color in hex, e.g., #4ade80"
    )
    thumbnail_text = models.CharField(
        max_length=10, blank=True, null=True,
        help_text="Emoji or short text for thumbnail"
    )
    thumbnail_text_color = models.CharField(
        max_length=20, blank=True, null=True, default='#ffffff',
        help_text="Text color in hex, e.g., #ffffff"
    )

    token = models.CharField(
        max_length=64, blank=True, null=True, help_text="Security token for app access"
    )

    started_at = models.DateTimeField(
        null=True, blank=True, help_text="When the notebook app was started"
    )

    def __str__(self):
        return self.name
