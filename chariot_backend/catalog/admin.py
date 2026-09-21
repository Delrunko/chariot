from django.contrib import admin
from django.utils.html import format_html
from .models import Categorie, SousCategorie, Livre, LivreImage, Service, ServiceImage


class SousCategorieInline(admin.TabularInline):
    model = SousCategorie
    extra = 1
    prepopulated_fields = {"slug": ("nom",)}


@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display = ("nom", "type_categorie", "ordre", "active", "nb_sous_categories")
    list_filter = ("type_categorie", "active")
    list_editable = ("ordre", "active")
    prepopulated_fields = {"slug": ("nom",)}
    inlines = [SousCategorieInline]

    def nb_sous_categories(self, obj):
        return obj.sous_categories.count()
    nb_sous_categories.short_description = "Sous-catégories"


@admin.register(SousCategorie)
class SousCategorieAdmin(admin.ModelAdmin):
    list_display = ("nom", "categorie", "ordre", "active")
    list_filter = ("categorie", "active")
    list_editable = ("ordre", "active")
    prepopulated_fields = {"slug": ("nom",)}
    search_fields = ("nom",)


class LivreImageInline(admin.TabularInline):
    model = LivreImage
    extra = 1
    fields = ("image", "ordre", "apercu")
    readonly_fields = ("apercu",)

    def apercu(self, obj):
        if obj.pk and obj.image:
            return format_html('<img src="{}" style="height:50px;border-radius:4px;" />', obj.image.url)
        return "—"
    apercu.short_description = "Aperçu"


@admin.register(Livre)
class LivreAdmin(admin.ModelAdmin):
    list_display = ("titre", "sous_categorie", "type_categorie", "prix", "disponible", "mis_en_avant", "apercu_couverture")
    list_filter = ("sous_categorie__categorie", "sous_categorie", "disponible", "mis_en_avant")
    list_editable = ("disponible", "mis_en_avant")
    search_fields = ("titre", "description")
    prepopulated_fields = {"slug": ("titre",)}
    autocomplete_fields = ["sous_categorie"]
    inlines = [LivreImageInline]

    def apercu_couverture(self, obj):
        if obj.couverture:
            return format_html('<img src="{}" style="height:50px;border-radius:4px;" />', obj.couverture.url)
        return "—"
    apercu_couverture.short_description = "Couverture"

    def type_categorie(self, obj):
        return obj.sous_categorie.categorie.get_type_categorie_display()
    type_categorie.short_description = "Type"


class ServiceImageInline(admin.TabularInline):
    model = ServiceImage
    extra = 1
    fields = ("image", "ordre", "apercu")
    readonly_fields = ("apercu",)

    def apercu(self, obj):
        if obj.pk and obj.image:
            return format_html('<img src="{}" style="height:50px;border-radius:4px;" />', obj.image.url)
        return "—"
    apercu.short_description = "Aperçu"


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("titre", "sous_categorie", "prix", "disponible", "apercu_couverture", "whatsapp_phone")
    list_filter = ("sous_categorie__categorie", "sous_categorie", "disponible")
    search_fields = ("titre", "description", "whatsapp_phone")
    prepopulated_fields = {"slug": ("titre",)}
    autocomplete_fields = ["sous_categorie"]
    inlines = [ServiceImageInline]

    def apercu_couverture(self, obj):
        if obj.couverture:
            return format_html('<img src="{}" style="height:50px;border-radius:4px;" />', obj.couverture.url)
        return "—"
    apercu_couverture.short_description = "Couverture"

    def get_fieldsets(self, request, obj=None):
        """
        Show additional fields (document, video_url) for categories that need them.
        Hide the document field for 'hotellerie' services and for 'eloquence' since the UX
        requested both Hôtellerie and Éloquence share the same (no-PDF) form.
        """
        base_fields = ("titre", "slug", "description", "sous_categorie", "prix", "couverture", "disponible", "whatsapp_phone")
        fieldsets = [
            (None, {"fields": base_fields}),
        ]

        cat_slug = None
        if obj and getattr(obj, 'sous_categorie', None) and getattr(obj.sous_categorie, 'categorie', None):
            cat_slug = getattr(obj.sous_categorie.categorie, 'slug', None)

        if cat_slug == 'hotellerie':
            return fieldsets

        fieldsets.append(("Options additionnelles", {"fields": ("document", "video", "video_url")}))
        return fieldsets

    def get_fields(self, request, obj=None):
        fields = ["titre", "slug", "description", "sous_categorie", "prix", "couverture", "disponible", "whatsapp_phone"]
        if obj:
            try:
                cat_slug = obj.sous_categorie.categorie.slug
            except Exception:
                cat_slug = None
            if cat_slug != 'hotellerie':
                # allow both a file upload and/or a URL for video
                fields += ["document", "video", "video_url"]
        # When creating a new Service we default to the Hôtellerie-style form (no document)
        return fields

    class Media:
        js = ()  # placeholder: can add admin JS later if you want a dynamic toggle


# Proxy admin for Éloquence so the admin gets a dedicated section
from .models import Eloquence

@admin.register(Eloquence)
class EloquenceAdmin(ServiceAdmin):
    """Admin view showing only Services whose parent category slug is 'eloquence'.
    Uses the same form as ServiceAdmin (i.e., without the document field).
    """
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(sous_categorie__categorie__slug='eloquence')

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Limit the sous_categorie dropdown to sous-catégories belonging to the Éloquence category
        if db_field.name == 'sous_categorie':
            kwargs['queryset'] = SousCategorie.objects.filter(categorie__slug='eloquence')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_add_permission(self, request):
        # allow adding via this proxy — admin will choose the correct sous_categorie under Eloquence
        return True

    def save_model(self, request, obj, form, change):
        # Ensure that when saving via the Eloquence admin, the underlying category is Éloquence.
        # If the admin didn't pick a sous_categorie, we leave it to normal validation; otherwise we accept the choice.
        super().save_model(request, obj, form, change)
