import os
import tempfile
from unittest.mock import Mock, patch

import requests
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import Utilisateur
from .models import Categorie, Livre, SousCategorie
from .storage_types import get_cloudinary_resource_type

cloudinary_configured = getattr(settings, "CLOUDINARY_STORAGE", None) or any(
    os.environ.get(variable)
    for variable in (
        "CLOUDINARY_URL",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
    )
)
if cloudinary_configured:
    from .storage import TypeAwareCloudinaryMediaStorage
else:
    with patch.dict(
        "os.environ",
        {"CLOUDINARY_URL": "cloudinary://test-key:test-secret@test-cloud"},
    ):
        from .storage import TypeAwareCloudinaryMediaStorage


class CloudinaryResourceTypeTests(SimpleTestCase):
    def test_documents_use_raw_resource_type(self):
        for filename in ("book.pdf", "book.DOCX", "guide.epub"):
            with self.subTest(filename=filename):
                self.assertEqual(get_cloudinary_resource_type(filename), "raw")

    def test_video_files_use_video_resource_type(self):
        for filename in ("lesson.mp4", "lesson.WEBM"):
            with self.subTest(filename=filename):
                self.assertEqual(get_cloudinary_resource_type(filename), "video")

    def test_images_use_image_resource_type(self):
        for filename in ("cover.jpg", "cover.png"):
            with self.subTest(filename=filename):
                self.assertEqual(get_cloudinary_resource_type(filename), "image")


class CloudinaryPrivatePdfStorageTests(SimpleTestCase):
    def test_private_download_url_is_signed_and_short_lived(self):
        storage = TypeAwareCloudinaryMediaStorage()

        with (
            patch("catalog.storage.time.time", return_value=1000),
            patch(
                "cloudinary.utils.private_download_url",
                return_value="https://signed.example/private.pdf",
            ) as private_download_url,
        ):
            signed_url = storage._private_download_url(
                "media/fichiers_proteges/guide",
                "pdf",
            )

        self.assertEqual(signed_url, "https://signed.example/private.pdf")
        private_download_url.assert_called_once_with(
            "media/fichiers_proteges/guide",
            "pdf",
            resource_type="raw",
            type="upload",
            expires_at=1060,
        )

    def test_unauthorized_raw_pdf_uses_short_lived_signed_download(self):
        unauthorized = requests.HTTPError(
            response=Mock(status_code=requests.codes.unauthorized)
        )
        cloudinary_response = Mock(
            status_code=requests.codes.ok,
            content=b"%PDF-1.4\nprivate PDF",
        )
        storage = TypeAwareCloudinaryMediaStorage()

        with (
            patch(
                "catalog.storage.MediaCloudinaryStorage._open",
                side_effect=unauthorized,
            ),
            patch.object(
                storage,
                "_private_download_url",
                return_value="https://signed.example/private.pdf",
            ) as private_download_url,
            patch("catalog.storage.requests.get", return_value=cloudinary_response) as get,
        ):
            fichier = storage._open("fichiers_proteges/guide.pdf")

        self.assertEqual(fichier.read(), b"%PDF-1.4\nprivate PDF")
        self.assertEqual(fichier.name, "fichiers_proteges/guide.pdf")
        private_download_url.assert_called_once_with(
            "media/fichiers_proteges/guide",
            "pdf",
        )
        get.assert_called_once_with(
            "https://signed.example/private.pdf",
            timeout=(5, 30),
        )
        cloudinary_response.raise_for_status.assert_called_once_with()

    def test_non_unauthorized_storage_errors_are_not_retried(self):
        forbidden = requests.HTTPError(
            response=Mock(status_code=requests.codes.forbidden)
        )
        storage = TypeAwareCloudinaryMediaStorage()

        with (
            patch(
                "catalog.storage.MediaCloudinaryStorage._open",
                side_effect=forbidden,
            ),
            patch.object(storage, "_private_download_url") as private_download_url,
            self.assertRaises(requests.HTTPError),
        ):
            storage._open("fichiers_proteges/guide.pdf")

        private_download_url.assert_not_called()


class BookPdfUploadTests(APITestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        self.enterContext(override_settings(MEDIA_ROOT=self.media_dir.name))
        admin = Utilisateur.objects.create_user(
            username="admin-upload",
            password="test-password",
            role=Utilisateur.Role.ADMIN,
        )
        self.client.force_authenticate(user=admin)
        categorie = Categorie.objects.create(nom="Livres")
        sous_categorie = SousCategorie.objects.create(
            categorie=categorie, nom="Technique"
        )
        self.livre = Livre.objects.create(
            titre="Manuel",
            sous_categorie=sous_categorie,
            prix=1000,
            couverture="couvertures/manuel.jpg",
        )

    def test_admin_can_replace_book_pdf_with_multipart_patch(self):
        url = f"/api/books/{self.livre.slug}/"
        pdf = SimpleUploadedFile(
            "manuel.pdf",
            b"%PDF-1.4\nreplacement PDF bytes",
            content_type="application/pdf",
        )

        response = self.client.patch(
            url,
            {"fichier": pdf},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.livre.refresh_from_db()
        self.assertTrue(self.livre.fichier.name.endswith("manuel.pdf"))
        with self.livre.fichier.open("rb") as stored_pdf:
            self.assertEqual(stored_pdf.read(), b"%PDF-1.4\nreplacement PDF bytes")
