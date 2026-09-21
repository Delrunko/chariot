import uuid
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone
from catalog.models import Livre

# Durée avant qu'une revalidation en ligne soit redemandée à l'utilisateur
DUREE_VALIDITE_HORS_LIGNE = timedelta(days=21)


class AccesLecture(models.Model):
    """
    Représente le droit d'un utilisateur à lire un livre acheté depuis
    un appareil donné, y compris hors-ligne. Le jeton est vérifié par
    l'API avant de délivrer le contenu chiffré à mettre en cache côté
    client (PWA). La revalidation périodique limite les usages abusifs
    (compte partagé, appareil perdu/volé) sans bloquer un usage normal.
    """
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="acces_lecture")
    livre = models.ForeignKey(Livre, on_delete=models.CASCADE, related_name="acces_lecture")
    jeton = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    empreinte_appareil = models.CharField(max_length=255, help_text="Identifiant technique du navigateur/appareil")
    date_creation = models.DateTimeField(auto_now_add=True)
    derniere_revalidation = models.DateTimeField(auto_now_add=True)
    actif = models.BooleanField(default=True)

    class Meta:
        unique_together = ("utilisateur", "livre", "empreinte_appareil")
        verbose_name = "Accès de lecture"
        verbose_name_plural = "Accès de lecture"

    def __str__(self):
        return f"{self.utilisateur} — {self.livre} ({'actif' if self.actif else 'révoqué'})"

    @property
    def doit_revalider(self):
        return timezone.now() - self.derniere_revalidation > DUREE_VALIDITE_HORS_LIGNE

    def revalider(self):
        self.derniere_revalidation = timezone.now()
        self.save(update_fields=["derniere_revalidation"])
