from django.contrib.auth.models import AbstractUser
from django.db import models


class Utilisateur(AbstractUser):
    """
    Utilisateur personnalisé de la plateforme EDS.
    - admin : le vendeur, gère le catalogue
    - client : élève/étudiant qui achète et lit des livres
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        CLIENT = "client", "Client"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CLIENT)
    telephone = models.CharField(max_length=20, blank=True, null=True, help_text="Numéro utilisé pour Orange Money")

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    @property
    def est_admin(self):
        return self.role == self.Role.ADMIN
