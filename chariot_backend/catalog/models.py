from django.db import models
from django.utils.text import slugify


class Categorie(models.Model):
    """
    Grande famille de niveau (ex: Enseignement Technique - Maçonnerie)
    ou grande famille de service (ex: Hôtellerie).
    Entièrement créable/modifiable par l'admin depuis le back-office :
    aucun niveau n'est codé en dur dans l'application.
    """
    TYPE_LIVRE = "livre"
    TYPE_SERVICE = "service"
    TYPE_CHOICES = [
        (TYPE_LIVRE, "Livre"),
        (TYPE_SERVICE, "Service"),
    ]

    nom = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    description = models.TextField(blank=True)
    type_categorie = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        default=TYPE_LIVRE,
        help_text="Détermine si cette catégorie regroupe des livres ou des services",
    )
    ordre = models.PositiveIntegerField(default=0, help_text="Ordre d'affichage dans le menu")
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["ordre", "nom"]
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nom)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nom


class SousCategorie(models.Model):
    """
    Niveau précis rattaché à une catégorie
    (ex: 1ère année, Seconde F4, Terminale F4...).
    Créable librement par l'admin, sans limite de nombre.
    """
    categorie = models.ForeignKey(Categorie, on_delete=models.CASCADE, related_name="sous_categories")
    nom = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, blank=True)
    ordre = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["ordre", "nom"]
        unique_together = ("categorie", "nom")
        verbose_name = "Sous-catégorie"
        verbose_name_plural = "Sous-catégories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.categorie.nom}-{self.nom}")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.categorie.nom} — {self.nom}"


class Livre(models.Model):
    """
    Un ouvrage vendu sur la plateforme, OU une prestation de service
    (selon le type de la sous-catégorie/catégorie parente).
    Le fichier réel n'est jamais exposé par une URL publique directe :
    il est servi via l'API (voir app `library`) pour permettre le
    contrôle d'accès et la mise en cache chiffrée côté client.
    Pour un service, le champ `fichier` reste vide : la demande
    passe par WhatsApp plutôt que par un téléchargement.
    """
    titre = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    sous_categorie = models.ForeignKey(SousCategorie, on_delete=models.PROTECT, related_name="livres")
    prix = models.DecimalField(max_digits=10, decimal_places=0, help_text="Prix en FCFA")
    couverture = models.ImageField(upload_to="couvertures/%Y/%m/", help_text="Photo de couverture / illustration principale")
    fichier = models.FileField(
        upload_to="fichiers_proteges/%Y/%m/",
        blank=True,
        null=True,
        help_text="Fichier réel, jamais exposé publiquement. Laisser vide pour un service.",
    )
    disponible = models.BooleanField(default=True)
    mis_en_avant = models.BooleanField(default=False, help_text="Afficher en priorité dans la vitrine")
    date_ajout = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_ajout"]
        verbose_name = "Livre"
        verbose_name_plural = "Livres"

    @property
    def est_service(self):
        return self.sous_categorie.categorie.type_categorie == Categorie.TYPE_SERVICE

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.titre)
            slug = base_slug
            i = 1
            while Livre.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f"{base_slug}-{i}"
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.titre} ({self.sous_categorie})"


class LivreImage(models.Model):
    """
    Image supplémentaire pour la galerie d'un livre ou d'un service
    (en plus de la `couverture` principale). Utile notamment pour les
    services (ex: Hôtellerie) qui ont souvent plusieurs photos.
    """
    livre = models.ForeignKey(Livre, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="galerie/%Y/%m/")
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]
        verbose_name = "Image de galerie"
        verbose_name_plural = "Images de galerie"

    def __str__(self):
        return f"Image {self.ordre} — {self.livre.titre}"


class Testimonial(models.Model):
    """Témoignage déposé par un visiteur/client et affiché sur la page d'accueil."""
    nom = models.CharField(max_length=120, blank=True, help_text="Nom ou pseudo du visiteur")
    message = models.TextField(help_text="Le texte du témoignage")
    rating = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Note optionnelle (1-5)")
    approved = models.BooleanField(default=True, help_text="Si vrai, le témoignage est visible publiquement")
    date_created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_created"]
        verbose_name = "Témoignage"
        verbose_name_plural = "Témoignages"

    def __str__(self):
        return f"{self.nom or 'Anonyme'} — {self.message[:30]}"


class Service(models.Model):
    """Modèle explicit pour représenter une prestation/service distincte des livres.

    Utilise la même hiérarchie de catégories/sous-catégories que les livres.
    L'admin peut ajouter plusieurs images via ServiceImage (galerie) et un
    numéro WhatsApp/Contact spécifique à chaque service.
    """
    titre = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    sous_categorie = models.ForeignKey(SousCategorie, on_delete=models.PROTECT, related_name="services")
    prix = models.DecimalField(max_digits=10, decimal_places=0, help_text="Prix en FCFA")
    couverture = models.ImageField(upload_to="services/couvertures/%Y/%m/", help_text="Image de couverture principale")
    # optional document and video for categories like 'Eloquence'
    document = models.FileField(upload_to="services/documents/%Y/%m/", null=True, blank=True, help_text="Document attaché (PDF, DOCX, ...)")
    # New field: allow direct video uploads for Éloquence (file). Keep video_url for URL fallback.
    video = models.FileField(upload_to="services/videos/%Y/%m/", null=True, blank=True, help_text="Fichier vidéo (mp4, webm, ...) pour les éléments d'Éloquence")
    video_url = models.URLField(max_length=500, blank=True, help_text="URL vers une vidéo (YouTube, Vimeo, etc.)")
    disponible = models.BooleanField(default=True)
    date_ajout = models.DateTimeField(auto_now_add=True)
    whatsapp_phone = models.CharField(max_length=32, blank=True, help_text="Numéro utilisé pour le contact WhatsApp (ex: 2376...)")

    class Meta:
        ordering = ["-date_ajout"]
        verbose_name = "Service"
        verbose_name_plural = "Services"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.titre)
            slug = base_slug
            i = 1
            while Service.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f"{base_slug}-{i}"
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.titre} ({self.sous_categorie})"


# Proxy model to provide a dedicated admin section for Éloquence
class Eloquence(Service):
    class Meta:
        proxy = True
        verbose_name = "Élément d'Éloquence"
        verbose_name_plural = "Éléments d'Éloquence"

class ServiceImage(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="services/galerie/%Y/%m/")
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]
        verbose_name = "Image de service"
        verbose_name_plural = "Images de service"

    def __str__(self):
        return f"Image {self.ordre} — {self.service.titre}"


# ------------------------- Quote / Devis model -------------------------

class Quote(models.Model):
    """Enregistrement d'une demande de devis envoyée par un visiteur.

    Le backend tente de générer un PDF (quote.pdf_file) contenant le
    détail du devis, le logo et un filigrane. Si la génération échoue
    (par ex. package reportlab absent), la requête est quand même enregistrée.
    """
    client_name = models.CharField(max_length=200)
    client_email = models.EmailField(blank=True)
    client_phone = models.CharField(max_length=50, blank=True)
    message = models.TextField(blank=True)
    categorie = models.ForeignKey(Categorie, on_delete=models.SET_NULL, null=True, blank=True)
    # Structured items stored as JSON: [{id, titre, type, quantite, prix}]
    try:
        from django.db.models import JSONField as DjangoJSONField
    except Exception:
        DjangoJSONField = None

    if DjangoJSONField is not None:
        items = DjangoJSONField(default=list, blank=True)
    else:
        # Fallback to TextField storing JSON string
        items = models.TextField(blank=True, help_text="Liste des éléments demandés (texte ou JSON string).")

    event_date = models.DateField(null=True, blank=True)
    address = models.CharField(max_length=300, blank=True)
    prix_estime = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, help_text='Prix estimé en FCFA (optionnel)')

    created_at = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to="quotes/%Y/%m/", null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Devis"
        verbose_name_plural = "Devis"

    def __str__(self):
        return f"Devis {self.id} — {self.client_name} ({self.created_at:%Y-%m-%d})"


class QuoteImage(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='quotes/images/%Y/%m/')

    class Meta:
        verbose_name = 'Image de devis'
        verbose_name_plural = 'Images de devis'

    def __str__(self):
        return f"Image {self.id} — Devis {self.quote_id}"

class VisitCounter(models.Model):
    """Compteur de visites simple, incrémenté à chaque chargement du site."""
    count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Compteur de visites"
        verbose_name_plural = "Compteur de visites"

    def __str__(self):
        return f"{self.count} visites"