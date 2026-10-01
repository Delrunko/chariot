import io
from types import SimpleNamespace
from unittest.mock import Mock, patch

import fitz
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .views import LireLivreView


class LireLivreViewTests(TestCase):
    def test_read_uses_storage_without_local_path(self):
        source = fitz.open()
        source.new_page()
        contenu_pdf = source.tobytes()
        source.close()

        class FichierStocke:
            name = "fichiers_proteges/livre.pdf"

            def open(self, mode):
                return io.BytesIO(contenu_pdf)

            @property
            def path(self):
                raise AssertionError("Le stockage distant ne fournit pas de chemin local.")

        utilisateur = SimpleNamespace(
            is_authenticated=True,
            username="lecteur",
            telephone="",
            get_full_name=lambda: "Lecteur Test",
        )
        acces = SimpleNamespace(
            doit_revalider=False,
            livre=SimpleNamespace(fichier=FichierStocke()),
        )
        acces_query = Mock()
        acces_query.get.return_value = acces
        requete = APIRequestFactory().get(
            "/api/library/1/read/?empreinte_appareil=test"
        )
        force_authenticate(requete, user=utilisateur)

        with patch(
            "library.views.AccesLecture.objects.select_related",
            return_value=acces_query,
        ):
            reponse = LireLivreView.as_view()(requete, livre_id=1)
            pdf_filigrane = b"".join(reponse.streaming_content)

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse["Content-Type"], "application/pdf")
        document = fitz.open(stream=pdf_filigrane, filetype="pdf")
        self.assertEqual(document.page_count, 1)
        document.close()
