from rest_framework.test import APITestCase

from accounts.models import Utilisateur
from catalog.models import Categorie, Livre, SousCategorie
from .models import Achat


class MesAchatsViewTests(APITestCase):
    def setUp(self):
        self.client_user = Utilisateur.objects.create_user(
            username="client", password="test-password"
        )
        self.other_user = Utilisateur.objects.create_user(
            username="autre", password="test-password"
        )
        categorie = Categorie.objects.create(nom="Technique")
        sous_categorie = SousCategorie.objects.create(
            categorie=categorie, nom="Maçonnerie"
        )
        self.livre_en_attente = Livre.objects.create(
            titre="Livre en attente",
            sous_categorie=sous_categorie,
            prix=5000,
            couverture="couvertures/livre.jpg",
        )
        self.livre_paye = Livre.objects.create(
            titre="Livre approuvé",
            sous_categorie=sous_categorie,
            prix=7000,
            couverture="couvertures/autre.jpg",
        )
        self.client.force_authenticate(user=self.client_user)

    def test_returns_paid_and_pending_purchases_with_book_details(self):
        Achat.objects.create(
            utilisateur=self.client_user,
            livre=self.livre_en_attente,
            montant=self.livre_en_attente.prix,
            statut=Achat.Statut.EN_ATTENTE,
        )
        Achat.objects.create(
            utilisateur=self.client_user,
            livre=self.livre_paye,
            montant=self.livre_paye.prix,
            statut=Achat.Statut.PAYE,
        )
        Achat.objects.create(
            utilisateur=self.other_user,
            livre=self.livre_en_attente,
            montant=self.livre_en_attente.prix,
            statut=Achat.Statut.EN_ATTENTE,
        )

        response = self.client.get("/api/purchases/mes-achats/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        by_status = {purchase["statut"]: purchase for purchase in response.data}
        self.assertEqual(
            by_status[Achat.Statut.EN_ATTENTE]["livre_detail"]["titre"],
            "Livre en attente",
        )
        self.assertEqual(
            by_status[Achat.Statut.PAYE]["livre_detail"]["titre"],
            "Livre approuvé",
        )
