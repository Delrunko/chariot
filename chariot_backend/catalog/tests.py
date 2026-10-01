import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import Utilisateur
from .models import Categorie, Livre, SousCategorie
from .storage_types import get_cloudinary_resource_type


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
