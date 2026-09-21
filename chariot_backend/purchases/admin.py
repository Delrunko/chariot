from django.contrib import admin
from .models import Achat, ServiceAchat


@admin.register(Achat)
class AchatAdmin(admin.ModelAdmin):
    list_display = ("utilisateur", "livre", "statut", "moyen_paiement", "montant", "date_achat")
    list_filter = ("statut", "moyen_paiement")
    search_fields = ("utilisateur__username", "livre__titre", "reference_transaction")
    readonly_fields = ("date_achat",)


@admin.register(ServiceAchat)
class ServiceAchatAdmin(admin.ModelAdmin):
    list_display = ("utilisateur", "service", "statut", "moyen_paiement", "montant", "date_achat")
    list_filter = ("statut",)
    search_fields = ("utilisateur__username", "service__titre", "reference_transaction")
    readonly_fields = ("date_achat",)