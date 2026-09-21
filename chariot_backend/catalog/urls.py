from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    CategorieViewSet, SousCategorieViewSet, LivreViewSet,
    TestimonialViewSet, ServiceViewSet, QuoteViewSet, visit_counter,
)

router = DefaultRouter()
router.register("categories", CategorieViewSet, basename="categorie")
router.register("sous-categories", SousCategorieViewSet, basename="souscategorie")
router.register("books", LivreViewSet, basename="livre")
router.register("services", ServiceViewSet, basename="service")
router.register("testimonials", TestimonialViewSet, basename="testimonial")
router.register("quotes", QuoteViewSet, basename="quote")

urlpatterns = router.urls + [
    path("visit-counter/", visit_counter),
]