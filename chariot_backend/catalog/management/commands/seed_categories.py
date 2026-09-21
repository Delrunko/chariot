from django.core.management.base import BaseCommand
from catalog.models import Categorie, SousCategorie


class Command(BaseCommand):
    help = "Crée la catégorie Maçonnerie/Bâtiment (F4) et ses niveaux de départ. L'admin pourra ensuite en ajouter d'autres librement."

    def handle(self, *args, **options):
        categorie, created = Categorie.objects.get_or_create(
            nom="Enseignement Technique — Maçonnerie / Bâtiment (F4)",
            defaults={"description": "Ouvrages destinés à la filière Maçonnerie / Bâtiment, du collège technique jusqu'à la Terminale F4.", "ordre": 1},
        )
        self.stdout.write(self.style.SUCCESS(f"Catégorie {'créée' if created else 'déjà existante'} : {categorie}"))

        niveaux = [
            "1ère année",
            "2ème année",
            "3ème année",
            "4ème année",
            "Seconde F4",
            "Première F4",
            "Terminale F4",
        ]

        for i, nom in enumerate(niveaux, start=1):
            sous_cat, created = SousCategorie.objects.get_or_create(
                categorie=categorie, nom=nom, defaults={"ordre": i}
            )
            statut = "créée" if created else "déjà existante"
            self.stdout.write(f"  Sous-catégorie {statut} : {sous_cat}")

        self.stdout.write(self.style.SUCCESS("Seed terminé. D'autres catégories/sous-catégories peuvent être ajoutées librement depuis /admin/."))
