import os
import time

import requests
from cloudinary_storage.storage import MediaCloudinaryStorage
from django.core.files.base import ContentFile

from .storage_types import get_cloudinary_resource_type


class TypeAwareCloudinaryMediaStorage(MediaCloudinaryStorage):
    def _get_resource_type(self, name):
        return get_cloudinary_resource_type(name)

    def _private_download_url(self, public_id, file_format):
        from cloudinary.utils import private_download_url

        return private_download_url(
            public_id,
            file_format,
            resource_type="raw",
            type="upload",
            expires_at=int(time.time()) + 60,
        )

    def _open(self, name, mode="rb"):
        try:
            return super()._open(name, mode)
        except requests.HTTPError as error:
            response = error.response
            if (
                self._get_resource_type(name) != "raw"
                or response is None
                or response.status_code != requests.codes.unauthorized
            ):
                raise

            public_id, extension = os.path.splitext(
                self._prepend_prefix(self._normalise_name(name))
            )
            if not extension:
                raise

            signed_url = self._private_download_url(
                public_id,
                extension.lstrip("."),
            )
            response = requests.get(signed_url, timeout=(5, 30))
            response.raise_for_status()
            fichier = ContentFile(response.content)
            fichier.name = name
            fichier.mode = mode
            return fichier
