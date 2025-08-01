import os
from django.core.management.base import BaseCommand
from notebooks.models import Notebook

class Command(BaseCommand):
    help = "Import .ipynb notebooks from a folder (default: current directory). Interactively confirms each."

    def add_arguments(self, parser):
        parser.add_argument(
            'folder',
            nargs='?',
            type=str,
            default='.',
            help='Path to the folder with .ipynb files (default: current directory)'
        )

    def handle(self, *args, **options):
        folder = options['folder']
        folder = os.path.abspath(folder)

        if not os.path.isdir(folder):
            self.stdout.write(self.style.ERROR(f"Folder '{folder}' does not exist!"))
            return

        # List all .ipynb files
        notebooks = [f for f in os.listdir(folder) if f.lower().endswith('.ipynb')]
        if not notebooks:
            self.stdout.write(self.style.WARNING("No .ipynb files found in the folder."))
            return

        self.stdout.write(self.style.NOTICE(f"Found {len(notebooks)} notebook(s) in '{folder}':"))
        for i, fname in enumerate(notebooks, 1):
            self.stdout.write(f"{i}. {fname}")

        # Interactive add
        for fname in notebooks:
            already = Notebook.objects.filter(file_path=os.path.join(folder, fname)).exists()
            if already:
                self.stdout.write(self.style.WARNING(f"Notebook '{fname}' already exists in DB. Skipping."))
                continue

            confirm = input(f"Add '{fname}'? [y/N]: ").strip().lower()
            if confirm != 'y':
                self.stdout.write(self.style.WARNING(f"Skipped '{fname}'."))
                continue

            name = input(f"Name for '{fname}' (default: filename): ").strip() or fname.replace('.ipynb', '')
            desc = input("Description (optional): ").strip()
            nb = Notebook.objects.create(
                name=name,
                description=desc,
                file_path=os.path.join(folder, fname)
            )
            self.stdout.write(self.style.SUCCESS(f"Added '{fname}' as '{nb.name}' (id={nb.id})."))
