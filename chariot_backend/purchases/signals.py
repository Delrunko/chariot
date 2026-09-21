from django.conf import settings
from django.core.mail import send_mail
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ServiceAchat

try:
    from accounts.models import Utilisateur
except Exception:
    Utilisateur = None


@receiver(post_save, sender=ServiceAchat)
def notify_admins_on_service_achat(sender, instance, created, **kwargs):
    """Notify admin users by email when a new ServiceAchat is created in EN_ATTENTE state.

    This is a lightweight notification intended for development/ops so admins are
    made aware that a purchase requires validation. Emails are sent with
    fail_silently=True to avoid impacting the payment flow if mail is not
    configured.
    """
    try:
        if not created:
            return

        if instance.statut != ServiceAchat.Statut.EN_ATTENTE:
            return

        if Utilisateur is None:
            return

        admins = Utilisateur.objects.filter(role=Utilisateur.Role.ADMIN)
        recipients = [a.email for a in admins if a.email]
        if not recipients:
            return

        subject = f"Nouvel achat en attente — {instance.service.titre}"
        body_lines = [
            f"Utilisateur: {instance.utilisateur.username}",
            f"Service: {instance.service.titre}",
            f"Montant: {instance.montant} FCFA",
            f"Référence: {instance.reference_transaction or '—'}",
            f"Date: {instance.date_achat}",
            "",
            "Connectez-vous au tableau d'administration pour confirmer ou rejeter cet achat.",
        ]
        body = "\n".join(body_lines)

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com')
        send_mail(subject, body, from_email, recipients, fail_silently=True)
    except Exception:
        # Never raise from signal — keep fail-safe behaviour
        return
