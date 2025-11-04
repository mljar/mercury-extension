from django.conf import settings
from django.contrib import admin
from django.shortcuts import render
from django.urls import path, re_path, include

urlpatterns = []

if settings.SERVE_STATIC:
    def index(request):
        return render(request, "index.html")
    def notebook_index(request):
        return render(request, "notebook/index.html")

    urlpatterns += [
        path("", index),
        re_path(r"^notebook", notebook_index),
    ]

urlpatterns += [
    path('admin/', admin.site.urls),
    path('', include('notebooks.urls')),
]

admin.site.site_header = "🎉 Mercury Admin Panel"