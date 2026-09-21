from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    list_display = ("username", "email", "role", "telephone", "is_staff")
    list_filter = ("role", "is_staff")
    fieldsets = UserAdmin.fieldsets + (
        ("EDS", {"fields": ("role", "telephone")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("EDS", {"fields": ("role", "telephone")}),
    )
