from cloudinary_storage.storage import MediaCloudinaryStorage

from .storage_types import get_cloudinary_resource_type


class TypeAwareCloudinaryMediaStorage(MediaCloudinaryStorage):
    def _get_resource_type(self, name):
        return get_cloudinary_resource_type(name)
