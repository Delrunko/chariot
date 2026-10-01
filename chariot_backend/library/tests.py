import io
from types import SimpleNamespace
from unittest.mock import Mock, mock_open, patch
from urllib.parse import quote

import fitz
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from chariot_backend.settings import _cloudinary_config_from_env
from .models import AccesLecture
from .views import LireLivreView, RevaliderAccesView


class CloudinaryConfigurationTests(TestCase):
    def test_cloudinary_url_is_parsed_for_media_storage(self):
        config = _cloudinary_config_from_env(
            {
                "CLOUDINARY_URL": (
                    "cloudinary://api-key:"
                    f"{quote('secret/with+symbols', safe='')}@my-cloud"
                )
            }
        )

        self.assertEqual(
            config,
            {
                "cloud_name": "my-cloud",
                "api_key": "api-key",
                "api_secret": "secret/with+symbols",
            },
        )

    def test_individual_cloudinary_variables_are_supported(self):
        config = _cloudinary_config_from_env(
            {
                "CLOUDINARY_CLOUD_NAME": "my-cloud",
                "CLOUDINARY_API_KEY": "api-key",
                "CLOUDINARY_API_SECRET": "api-secret",
            }
        )

        self.assertEqual(
            config,
            {
                "cloud_name": "my-cloud",
                "api_key": "api-key",
                "api_secret": "api-secret",
            },
        )

    def test_partial_cloudinary_configuration_fails_loudly(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured, "Configure CLOUDINARY_URL"
        ):
            _cloudinary_config_from_env({"CLOUDINARY_CLOUD_NAME": "my-cloud"})


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
            pk=1,
            actif=True,
            doit_revalider=False,
            livre=SimpleNamespace(fichier=FichierStocke()),
        )
        acces_creation = Mock()
        acces_creation.select_related.return_value.get.side_effect = [
            AccesLecture.DoesNotExist,
            acces,
        ]
        acces_creation.get_or_create.return_value = (acces, True)
        requete = APIRequestFactory().get(
            "/api/library/1/read/?empreinte_appareil=test"
        )
        force_authenticate(requete, user=utilisateur)

        with (
            patch("library.views.Achat.objects.filter") as achats,
            patch("library.views.AccesLecture.objects", acces_creation),
        ):
            achats.return_value.exists.return_value = True
            reponse = LireLivreView.as_view()(requete, livre_id=1)
            pdf_filigrane = b"".join(reponse.streaming_content)

        acces_creation.get_or_create.assert_called_once_with(
            utilisateur=utilisateur,
            livre_id=1,
            empreinte_appareil="test",
            defaults={"actif": True},
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse["Content-Type"], "application/pdf")
        document = fitz.open(stream=pdf_filigrane, filetype="pdf")
        self.assertEqual(document.page_count, 1)
        document.close()

    def test_read_does_not_grant_access_without_paid_purchase(self):
        utilisateur = SimpleNamespace(is_authenticated=True)
        requete = APIRequestFactory().get(
            "/api/library/1/read/?empreinte_appareil=test"
        )
        force_authenticate(requete, user=utilisateur)

        with patch("library.views.Achat.objects.filter") as achats:
            achats.return_value.exists.return_value = False
            reponse = LireLivreView.as_view()(requete, livre_id=1)

        self.assertEqual(reponse.status_code, 404)

    def test_read_reports_remote_storage_failure_without_server_error(self):
        fichier = Mock()
        fichier.open.side_effect = OSError("Remote PDF not found")
        acces = SimpleNamespace(
            pk=1,
            actif=True,
            doit_revalider=False,
            livre=SimpleNamespace(fichier=fichier),
        )
        acces_manager = Mock()
        acces_manager.select_related.return_value.get.return_value = acces
        utilisateur = SimpleNamespace(
            is_authenticated=True,
            pk=7,
            username="lecteur",
            telephone="",
            get_full_name=lambda: "Lecteur Test",
        )
        requete = APIRequestFactory().get(
            "/api/library/1/read/?empreinte_appareil=test"
        )
        force_authenticate(requete, user=utilisateur)

        with (
            patch("library.views.Achat.objects.filter") as achats,
            patch("library.views.AccesLecture.objects", acces_manager),
        ):
            achats.return_value.exists.return_value = True
            reponse = LireLivreView.as_view()(requete, livre_id=1)

        self.assertEqual(reponse.status_code, 503)
        self.assertEqual(
            reponse.data["detail"],
            "Le fichier PDF est indisponible sur le stockage distant.",
        )

    def test_read_reports_invalid_pdf_without_server_error(self):
        fichier = Mock()
        fichier.open = mock_open(read_data=b"not a PDF")
        acces = SimpleNamespace(
            pk=1,
            actif=True,
            doit_revalider=False,
            livre=SimpleNamespace(fichier=fichier),
        )
        acces_manager = Mock()
        acces_manager.select_related.return_value.get.return_value = acces
        utilisateur = SimpleNamespace(
            is_authenticated=True,
            pk=7,
            username="lecteur",
            telephone="",
            get_full_name=lambda: "Lecteur Test",
        )
        requete = APIRequestFactory().get(
            "/api/library/1/read/?empreinte_appareil=test"
        )
        force_authenticate(requete, user=utilisateur)

        with (
            patch("library.views.Achat.objects.filter") as achats,
            patch("library.views.AccesLecture.objects", acces_manager),
        ):
            achats.return_value.exists.return_value = True
            reponse = LireLivreView.as_view()(requete, livre_id=1)

        self.assertEqual(reponse.status_code, 422)

    def test_revalidation_reactivates_existing_access_for_paid_purchase(self):
        utilisateur = SimpleNamespace(is_authenticated=True)
        acces = SimpleNamespace(revalider=Mock())
        acces_manager = Mock()
        acces_manager.get_or_create.return_value = (acces, False)
        requete = APIRequestFactory().post(
            "/api/library/1/revalider/",
            {"empreinte_appareil": "test"},
            format="json",
        )
        force_authenticate(requete, user=utilisateur)

        with (
            patch("library.views.Achat.objects.filter") as achats,
            patch("library.views.AccesLecture.objects", acces_manager),
            patch("library.views.AccesLectureSerializer") as serializer,
        ):
            achats.return_value.exists.return_value = True
            serializer.return_value.data = {"id": 1}
            reponse = RevaliderAccesView.as_view()(requete, livre_id=1)

        acces.revalider.assert_called_once_with()
        self.assertEqual(reponse.status_code, 200)

    def test_revalider_reactivates_an_inactive_access(self):
        acces = AccesLecture(actif=False)
        acces.save = Mock()

        acces.revalider()

        self.assertTrue(acces.actif)
        acces.save.assert_called_once_with(
            update_fields=["actif", "derniere_revalidation"]
        )
