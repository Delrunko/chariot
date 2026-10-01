from django.test import SimpleTestCase

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
