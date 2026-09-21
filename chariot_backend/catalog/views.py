from django.db.models import Q
from rest_framework import viewsets, permissions
from django.db.models.deletion import ProtectedError
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Categorie, SousCategorie, Livre, Testimonial, Service, ServiceImage, Quote, VisitCounter
from .serializers import (
    CategorieSerializer,
    SousCategorieSerializer,
    LivreDetailSerializer,
    LivreListSerializer,
    LivreWriteSerializer,
    TestimonialSerializer,
    ServiceListSerializer,
    ServiceDetailSerializer,
    ServiceWriteSerializer,
    ServiceImageSerializer,
    QuoteSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Seul un utilisateur avec role=admin peut créer/modifier le catalogue."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "est_admin", False))


class CategorieViewSet(viewsets.ModelViewSet):
    """
    Catégories + sous-catégories, entièrement gérables par l'admin
    depuis l'API (ou l'interface /admin/) — rien n'est codé en dur.
    """
    queryset = Categorie.objects.filter(active=True).prefetch_related("sous_categories")
    serializer_class = CategorieSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"


class SousCategorieViewSet(viewsets.ModelViewSet):
    queryset = SousCategorie.objects.filter(active=True)
    serializer_class = SousCategorieSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"


class LivreViewSet(viewsets.ModelViewSet):
    """
    Catalogue des livres. La liste sert aussi de VITRINE : tous les
    livres disponibles sont visibles (achetés ou non), mais le champ
    `fichier` n'est jamais exposé — la lecture passe par `library`.
    """
    queryset = Livre.objects.filter(disponible=True).select_related("sous_categorie__categorie")
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return LivreWriteSerializer
        if self.action == "retrieve":
            return LivreDetailSerializer
        return LivreListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        sous_categorie = self.request.query_params.get("sous_categorie")
        categorie = self.request.query_params.get("categorie")
        search = self.request.query_params.get("search")

        if sous_categorie:
            qs = qs.filter(sous_categorie__slug=sous_categorie)
        if categorie:
            qs = qs.filter(sous_categorie__categorie__slug=categorie)
        if search:
            terme = search.strip()
            if terme:
                qs = qs.filter(
                    Q(titre__icontains=terme)
                    | Q(description__icontains=terme)
                    | Q(sous_categorie__nom__icontains=terme)
                    | Q(sous_categorie__categorie__nom__icontains=terme)
                )
        return qs

    def destroy(self, request, *args, **kwargs):
        """Override destroy to return a friendly error if related Purchases (Achat) protect the Livre from deletion."""
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as e:
            instance = self.get_object()
            try:
                achat_count = instance.achats.count()
            except Exception:
                achat_count = None
            detail = "Impossible de supprimer ce livre car il existe des achats associés."
            if achat_count:
                detail += f" ({achat_count} achat(s) référencent ce livre)"
            return Response({"detail": detail}, status=400)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def vitrine(self, request):
        """
        Endpoint public dédié à la page d'accueil : livres mis en avant
        en premier, utilisé pour les bannières publicitaires.
        """
        qs = self.get_queryset().order_by("-mis_en_avant", "-date_ajout")[:20]
        serializer = LivreListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)


class TestimonialViewSet(viewsets.ModelViewSet):
    """Permet aux visiteurs d'envoyer un témoignage et à tous de les lire.

    POST: créer un témoignage (approuvé par défaut afin d'être visible immédiatement)
    GET: lister tous les témoignages approuvés (ou tous si admin)
    """
    queryset = Testimonial.objects.all()
    serializer_class = TestimonialSerializer
    lookup_field = "id"

    def get_permissions(self):
        if self.action in ["list", "retrieve", "create"]:
            return [permissions.AllowAny()]
        return [IsAdminOrReadOnly()]

    def get_queryset(self):
        qs = super().get_queryset()
        if not (self.request.user and getattr(self.request.user, "est_admin", False)):
            qs = qs.filter(approved=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(approved=True)


from rest_framework.parsers import MultiPartParser, FormParser

class ServiceViewSet(viewsets.ModelViewSet):
    """Endpoints pour gérer les services et leur galerie d'images."""
    queryset = Service.objects.filter(disponible=True).select_related("sous_categorie__categorie")
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ServiceWriteSerializer
        if self.action == "retrieve":
            return ServiceDetailSerializer
        return ServiceListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        sous_categorie = self.request.query_params.get("sous_categorie")
        categorie = self.request.query_params.get("categorie")
        search = self.request.query_params.get("search")

        if sous_categorie:
            qs = qs.filter(sous_categorie__slug=sous_categorie)
        if categorie:
            qs = qs.filter(sous_categorie__categorie__slug=categorie)
        if search:
            terme = search.strip()
            if terme:
                qs = qs.filter(
                    Q(titre__icontains=terme)
                    | Q(description__icontains=terme)
                    | Q(sous_categorie__nom__icontains=terme)
                    | Q(sous_categorie__categorie__nom__icontains=terme)
                )
        return qs

    def create(self, request, *args, **kwargs):
        """Override create to accept multiple uploaded images under 'images'."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        images = request.FILES.getlist("images")
        for idx, f in enumerate(images):
            ServiceImage.objects.create(service=instance, image=f, ordre=idx)

        return Response(ServiceDetailSerializer(instance, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrReadOnly])
    def images(self, request, slug=None):
        """Upload additional images to an existing service."""
        service = self.get_object()
        files = request.FILES.getlist("images")
        created = []
        start = service.images.count()
        for i, f in enumerate(files):
            obj = ServiceImage.objects.create(service=service, image=f, ordre=start + i)
            created.append(obj)
        return Response(ServiceImageSerializer(created, many=True, context={"request": request}).data)


# ------------------------- Quote API -------------------------
from rest_framework.parsers import MultiPartParser, FormParser

class QuoteViewSet(viewsets.ModelViewSet):
    """Endpoints pour recevoir une demande de devis et générer un PDF.

    Notes:
    - La création et la lecture publique restent ouvertes (AllowAny) pour que
      la page catalogue puisse envoyer des devis sans authentification.
    - Les opérations destructrices (update/destroy) sont réservées aux admins.
    """
    queryset = Quote.objects.all()
    serializer_class = QuoteSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create"):
            return [permissions.AllowAny()]
        return [IsAdminOrReadOnly()]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            instance = self.get_object()
            detail = "Impossible de supprimer ce devis (relation protégée)."
            return Response({"detail": detail}, status=400)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        images = request.FILES.getlist("images")
        for f in images:
            from .models import QuoteImage
            QuoteImage.objects.create(quote=instance, image=f)

        items_val = instance.items
        try:
            import json
            if isinstance(items_val, str) and items_val:
                items_parsed = json.loads(items_val)
            else:
                items_parsed = items_val or []
        except Exception:
            items_parsed = []

        try:
            from io import BytesIO
            from django.core.files.base import ContentFile

            try:
                from reportlab.pdfgen import canvas
                from reportlab.lib.pagesizes import A4
                from reportlab.lib.utils import ImageReader
                from reportlab.lib.colors import Color
            except Exception:
                raise

            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=A4)
            width, height = A4

            try:
                import os
                from django.conf import settings
                logo_path = os.path.join(settings.BASE_DIR, "static", "logo.png")
                if os.path.exists(logo_path):
                    img = ImageReader(logo_path)
                    c.drawImage(img, 40, height - 120, width=120, preserveAspectRatio=True, mask='auto')
            except Exception:
                pass

            c.setFont("Helvetica-Bold", 18)
            c.drawString(40, height - 150, f"Devis #{instance.id}")

            c.setFont("Helvetica", 11)
            y = height - 180
            c.drawString(40, y, f"Client: {instance.client_name}")
            y -= 16
            if instance.client_phone:
                c.drawString(40, y, f"Tél: {instance.client_phone}")
                y -= 16
            if instance.client_email:
                c.drawString(40, y, f"Email: {instance.client_email}")
                y -= 20

            if instance.categorie:
                c.drawString(40, y, f"Catégorie: {instance.categorie.nom}")
                y -= 16
            if instance.event_date:
                c.drawString(40, y, f"Date souhaitée: {instance.event_date}")
                y -= 16
            if instance.address:
                c.drawString(40, y, f"Lieu: {instance.address}")
                y -= 20

            c.drawString(40, y, "Détails:")
            y -= 16
            text = c.beginText(40, y)
            text.setFont("Helvetica", 10)

            if isinstance(items_parsed, (list, tuple)) and items_parsed:
                total = 0
                for it in items_parsed:
                    titre = it.get('titre') if isinstance(it, dict) else str(it)
                    qty = int(it.get('quantite', 1)) if isinstance(it, dict) else 1
                    prix = float(it.get('prix', 0)) if isinstance(it, dict) else 0
                    line = f"- {titre}  x{qty}  @ {int(prix)} FCFA"
                    text.textLine(line)
                    total += qty * prix
                text.textLine("")
                text.textLine(f"Total estimé: {int(total)} FCFA")
            else:
                raw = (instance.items if isinstance(instance.items, str) else None) or instance.message or ""
                for line in str(raw).splitlines():
                    text.textLine(line)

            c.drawText(text)

            try:
                c.saveState()
                watermark_color = Color(0, 0, 0, alpha=0.05)
                c.setFillColor(watermark_color)
                c.translate(width / 2, height / 2)
                c.rotate(45)
                c.setFont("Helvetica-Bold", 60)
                c.drawCentredString(0, 0, "Ets DOUMBOU SERVICES EXPRESS")
                c.restoreState()
            except Exception:
                pass

            c.showPage()
            c.save()
            pdf_value = buffer.getvalue()
            buffer.close()

            filename = f"devis_{instance.id}.pdf"
            instance.pdf_file.save(filename, ContentFile(pdf_value))
            instance.save()
        except Exception:
            pass

        return Response(QuoteSerializer(instance, context={"request": request}).data, status=201)


# ------------------------- Visit Counter API -------------------------
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.db import transaction


@api_view(["GET"])
@permission_classes([AllowAny])
def visit_counter(request):
    """
    Retourne le nombre de visites et l'incrémente de +1
    UNIQUEMENT si c'est la première visite dans cette session.
    """
    # 1. S'assurer que la session existe
    if not request.session.session_key:
        request.session.create()

    # 2. Vérifier si l'utilisateur a déjà été compté dans cette session
    if not request.session.get('has_visited'):
        with transaction.atomic():
            # Verrouillage de la ligne pour éviter les race conditions
            counter, created = VisitCounter.objects.select_for_update().get_or_create(
                id=1,
                defaults={"count": 200}
            )
            counter.count += 1
            counter.save()

        # 3. Marquer la session comme ayant déjà visité
        request.session['has_visited'] = True

    # 4. Renvoyer le compteur actuel
    current_count = VisitCounter.objects.values_list('count', flat=True).get(id=1)

    return Response({"count": current_count})