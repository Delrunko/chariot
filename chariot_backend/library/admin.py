from django.contrib import admin
from .models import AccesLecture


@admin.register(AccesLecture)
class AccesLectureAdmin(admin.ModelAdmin):
    list_display = ("utilisateur", "livre", "empreinte_appareil", "actif", "derniere_revalidation", "doit_revalider")
    list_filter = ("actif",)
    search_fields = ("utilisateur__username", "livre__titre")
    readonly_fields = ("jeton", "date_creation")

    def doit_revalider(self, obj):
        return obj.doit_revalider
    doit_revalider.boolean = True
    doit_revalider.short_description = "Revalidation requise"
