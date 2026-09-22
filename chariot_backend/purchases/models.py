from django.conf import settings
from django.db import models
from catalog.models import Livre
from catalog.models import Service




class Achat(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente de paiement"
        PAYE = "paye", "Payé"
        ECHOUE = "echoue", "Échoué"

    class MoyenPaiement(models.TextChoices):
        ORANGE_MONEY = "orange_money", "Orange Money"
        MTN_MOMO = "mtn_momo", "MTN Mobile Money"

    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achats")
    livre = models.ForeignKey(Livre, on_delete=models.PROTECT, related_name="achats")
    moyen_paiement = models.CharField(max_length=20, choices=MoyenPaiement.choices, default=MoyenPaiement.ORANGE_MONEY)
    statut = models.CharField(max_length=15, choices=Statut.choices, default=Statut.EN_ATTENTE)
    reference_transaction = models.CharField(max_length=100, blank=True, help_text="Référence renvoyée par l'agrégateur de paiement")
    montant = models.DecimalField(max_digits=10, decimal_places=0)
    date_achat = models.DateTimeField(auto_now_add=True)
    date_paiement = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date_achat"]
        unique_together = ("utilisateur", "livre")  # un livre n'est acheté qu'une fois par utilisateur
        verbose_name = "Achat"
        verbose_name_plural = "Achats"

    def __str__(self):
        return f"{self.utilisateur} → {self.livre} ({self.get_statut_display()})"


class PaymentConfig(models.Model):
    """Simple singleton model to store merchant codes used to build USSD strings.

    Admin can update the merchant_code and merchant_number via the admin API.
    """
    merchant_code = models.CharField(max_length=20, default="000000")
    merchant_number = models.CharField(max_length=20, default="656877046")

    class Meta:
        verbose_name = "Payment configuration"
        verbose_name_plural = "Payment configuration"

    def __str__(self):
        return f"PaymentConfig (merchant: {self.merchant_number})"


class ServiceAchat(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente de paiement"
        PAYE = "paye", "Payé"
        ECHOUE = "echoue", "Échoué"

    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="service_achats")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="achats_service")
    # Use the same payment methods as for Livre purchases
    moyen_paiement = models.CharField(max_length=20, choices=Achat.MoyenPaiement.choices, default=Achat.MoyenPaiement.ORANGE_MONEY)
    statut = models.CharField(max_length=15, choices=Statut.choices, default=Statut.EN_ATTENTE)
    reference_transaction = models.CharField(max_length=100, blank=True, help_text="Référence renvoyée par l'agrégateur de paiement")
    montant = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True)
    date_achat = models.DateTimeField(auto_now_add=True)
    date_paiement = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date_achat"]
        unique_together = ("utilisateur", "service")
        verbose_name = "Achat de service"
        verbose_name_plural = "Achats de services"

    def __str__(self):
        return f"{self.utilisateur} → {self.service} ({self.get_statut_display()})"
