from django.apps import AppConfig


class PurchasesConfig(AppConfig):
    name = 'purchases'

    def ready(self):
        # Import signal handlers to ensure they are registered when the app is ready
        try:
            import purchases.signals  # noqa: F401
        except Exception:
            # Avoid breaking startup if signals cannot be imported for any reason
            pass
