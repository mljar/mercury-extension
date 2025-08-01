# Generated by Django 4.2.7 on 2025-08-01 14:23

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Notebook",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("file_path", models.CharField(max_length=500)),
                ("port", models.IntegerField(blank=True, null=True)),
                ("pid", models.IntegerField(blank=True, null=True)),
                ("status", models.CharField(default="stopped", max_length=20)),
                (
                    "thumbnail_image",
                    models.CharField(
                        blank=True,
                        help_text="Path or URL to thumbnail image. If set, used as thumbnail.",
                        max_length=500,
                        null=True,
                    ),
                ),
                (
                    "thumbnail_bg",
                    models.CharField(
                        blank=True,
                        default="#4ade80",
                        help_text="Background color in hex, e.g., #4ade80",
                        max_length=20,
                        null=True,
                    ),
                ),
                (
                    "thumbnail_text",
                    models.CharField(
                        blank=True,
                        help_text="Emoji or short text for thumbnail",
                        max_length=10,
                        null=True,
                    ),
                ),
                (
                    "thumbnail_text_color",
                    models.CharField(
                        blank=True,
                        default="#ffffff",
                        help_text="Text color in hex, e.g., #ffffff",
                        max_length=20,
                        null=True,
                    ),
                ),
                (
                    "token",
                    models.CharField(
                        blank=True,
                        help_text="Security token for app access",
                        max_length=64,
                        null=True,
                    ),
                ),
                (
                    "started_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When the notebook app was started",
                        null=True,
                    ),
                ),
            ],
        ),
    ]
