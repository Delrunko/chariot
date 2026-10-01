from pathlib import PurePosixPath


RAW_FILE_EXTENSIONS = frozenset({".pdf", ".doc", ".docx", ".epub", ".txt"})
VIDEO_FILE_EXTENSIONS = frozenset({".mp4", ".mov", ".webm", ".m4v"})


def get_cloudinary_resource_type(name):
    extension = PurePosixPath(name).suffix.casefold()
    if extension in RAW_FILE_EXTENSIONS:
        return "raw"
    if extension in VIDEO_FILE_EXTENSIONS:
        return "video"
    return "image"
